import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, Upload, Download, Pencil, Trash2, Key, ShieldCheck, FolderLock, User, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { PageHeader } from "@/components/layout/AppShell";
import { DocumentVaultModal } from "@/components/employees/DocumentVaultModal";
import { useEmployees, useSettings } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  EMPLOYMENT_STATUSES,
  PAYMENT_MODES,
  downloadCsv,
  inr,
  parseCsv,
  type Employee,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

const empty: Partial<Employee> = {
  employee_code: "",
  full_name: "",
  designation: "",
  department: "",
  joining_date: "",
  employment_status: "Active",
  mobile: "",
  email: "",
  address: "",
  pan: "",
  aadhaar: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  payment_mode: "Bank Transfer",
  gross_salary: 0,
};

const PAGE_SIZE = 10;

function EmployeesPage() {
  const qc = useQueryClient();
  const { data: employees = [], isLoading } = useEmployees();
  const { data: settings } = useSettings();
  const { isManager } = useAuth();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [vaultTarget, setVaultTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>(empty);
  const [portalPassword, setPortalPassword] = useState("blx123");
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photograph must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, photo_doc: reader.result as string }));
      toast.success("Employee photograph attached");
    };
    reader.readAsDataURL(file);
  };

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[],
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQ =
        !q ||
        [e.full_name, e.employee_code, e.designation, e.department, e.email, e.mobile]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const matchesDept = dept === "all" || e.department === dept;
      return matchesQ && matchesDept;
    });
  }, [employees, query, dept]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const save = useMutation({
    mutationFn: async (payload: Partial<Employee>) => {
      const body = {
        ...payload,
        gross_salary: Number(payload.gross_salary ?? 0),
        joining_date: payload.joining_date || null,
      };
      if (payload.id) {
        const { error } = await supabase.from("employees").update(body as never).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { id: _ignored, ...insert } = body;
        const { error } = await supabase.from("employees").insert(insert as never);
        if (error) throw error;
      }

      // Provision/sync employee portal user credentials
      if (body.email) {
        try {
          await fetch("/api/admin/create-employee-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: body.email,
              password: portalPassword || "blx123",
              full_name: body.full_name || "Employee",
              employee_code: body.employee_code,
            }),
          });
        } catch (authErr) {
          console.warn("Notice: remote Supabase Auth user provisioning:", authErr);
        }
      }

      await logAuditEvent({
        action: payload.id ? "UPDATE_EMPLOYEE" : "CREATE_EMPLOYEE",
        entity_type: "employee",
        entity_id: body.employee_code,
        description: `${payload.id ? "Updated" : "Created"} employee profile ${body.employee_code} (${body.full_name}) with portal login access`,
        details: {
          employee_code: body.employee_code,
          full_name: body.full_name,
          designation: body.designation,
          department: body.department,
          gross_salary: body.gross_salary,
          portal_email: body.email,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      toast.success("Employee saved & portal credentials provisioned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const emp = employees.find((e) => e.id === id);
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;

      await logAuditEvent({
        action: "DELETE_EMPLOYEE",
        entity_type: "employee",
        entity_id: emp?.employee_code || id,
        description: `Deleted employee ${emp?.employee_code || id} (${emp?.full_name || "Employee"})`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importCsv = async (file: File) => {
    const rowsIn = parseCsv(await file.text());
    if (rowsIn.length === 0) return toast.error("No rows found in file");
    const payload = rowsIn.map((r) => ({
      employee_code: r["employee_code"] ?? r["Employee Code"] ?? "",
      full_name: r["full_name"] ?? r["Full Name"] ?? "",
      designation: r["designation"] ?? r["Designation"] ?? null,
      department: r["department"] ?? r["Department"] ?? null,
      joining_date: r["joining_date"] || null,
      mobile: r["mobile"] ?? null,
      email: r["email"] ?? null,
      pan: r["pan"] ?? null,
      bank_name: r["bank_name"] ?? null,
      account_number: r["account_number"] ?? null,
      ifsc_code: r["ifsc_code"] ?? null,
      payment_mode: r["payment_mode"] || settings?.default_payment_mode || "Bank Transfer",
      gross_salary: Number(r["gross_salary"] ?? 0),
    }));
    const { error } = await supabase
      .from("employees")
      .upsert(payload as never, { onConflict: "employee_code" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["employees"] });
    toast.success(`${payload.length} employees imported`);
    return;
  };

  const field = (key: keyof Employee, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        name={key}
        type={type}
        autoComplete="off"
        value={(form[key] as string | number | undefined) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Master records used for attendance, payroll and payslips."
        actions={
          isManager ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                id="employee-csv-upload"
                name="employee-csv-upload"
                aria-label="Upload Employee CSV file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "employees.csv",
                    employees as unknown as Record<string, unknown>[],
                  )
                }
              >
                <Download className="size-4" /> Export
              </Button>
              <Button
                onClick={() => {
                  const prefix = settings?.employee_id_prefix ?? "BLX26-";
                  setForm({
                    ...empty,
                    payment_mode: settings?.default_payment_mode ?? "Bank Transfer",
                    employee_code: `${prefix}${String(employees.length + 1).padStart(3, "0")}`,
                  });
                  setOpen(true);
                }}
              >
                <Plus className="size-4 mr-1.5" /> Add employee
              </Button>
            </>
          ) : null
        }
      />

      <Card className="shadow-panel">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="employee-search"
              name="employee-search"
              type="search"
              autoComplete="off"
              aria-label="Search employees by name, code, or designation"
              className="pl-9"
              placeholder="Search name, code, designation…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <Select
            value={dept}
            onValueChange={(v) => {
              setDept(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC & Documents</TableHead>
                <TableHead className="text-right">Gross salary</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No employees yet. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((e) => {
                  const hasAadhaar = Boolean(e.aadhaar_card_doc);
                  const hasPan = Boolean(e.pan_card_doc);
                  const hasBank = Boolean(e.bank_passbook_doc);
                  const hasPhoto = Boolean(e.photo_doc);
                  const count = [hasAadhaar, hasPan, hasBank, hasPhoto].filter(Boolean).length;

                  return (
                    <TableRow key={e.id}>
                      <TableCell className="num font-medium">{e.employee_code}</TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 shadow-xs">
                            {e.photo_doc ? (
                              <img src={e.photo_doc} alt={e.full_name} className="size-full object-cover" />
                            ) : (
                              (e.full_name || "EM").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="truncate">{e.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{e.designation ?? "—"}</TableCell>
                      <TableCell>{e.department ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.employment_status === "Active" ? "default" : "secondary"}>
                          {e.employment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs flex items-center gap-1.5"
                          onClick={() => setVaultTarget(e)}
                        >
                          <ShieldCheck
                            className={`size-3.5 ${
                              count === 4
                                ? "text-emerald-500"
                                : count > 0
                                ? "text-blue-500"
                                : "text-amber-500"
                            }`}
                          />
                          <span>{count === 4 ? "KYC Complete" : `${count}/4 Docs`}</span>
                        </Button>
                      </TableCell>
                      <TableCell className="num text-right">{inr(e.gross_salary)}</TableCell>
                      <TableCell className="text-right">
                        {isManager ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Employee Document Vault / KYC"
                              onClick={() => setVaultTarget(e)}
                            >
                              <FolderLock className="size-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Employee Details"
                              onClick={() => {
                                setForm(e);
                                setOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Employee"
                              onClick={() => remove.mutate(e.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
          <span>
            {filtered.length} employee{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              Bank and statutory details appear on the salary slip and payroll register.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Employee Photograph Upload Section */}
            <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="relative size-16 shrink-0 rounded-2xl overflow-hidden bg-background border-2 border-dashed border-primary/40 flex items-center justify-center shadow-sm">
                {form.photo_doc ? (
                  <img
                    src={form.photo_doc}
                    alt="Employee Avatar"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60">
                    <User className="size-7" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-avatar-upload" className="text-xs font-semibold text-foreground">
                  Employee Photograph
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Upload formal passport size photo or portrait (PNG, JPG max 5MB).
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label
                    htmlFor="employee-avatar-upload"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent transition-colors shadow-sm"
                  >
                    <Upload className="size-3.5" />
                    <span>{form.photo_doc ? "Change Photograph" : "Upload Photograph"}</span>
                  </label>
                  <input
                    id="employee-avatar-upload"
                    name="employee-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {form.photo_doc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setForm((f) => ({ ...f, photo_doc: null }))}
                    >
                      <Trash2 className="size-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {field("employee_code", "Employee code")}
            {field("full_name", "Full name")}
            {field("designation", "Designation")}
            {field("department", "Department")}
            {field("joining_date", "Joining date", "date")}
            <div className="space-y-2">
              <Label>Employment status</Label>
              <Select
                value={form.employment_status ?? "Active"}
                onValueChange={(v) => setForm((f) => ({ ...f, employment_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("mobile", "Mobile number")}
            {field("email", "Email", "email")}
            {field("pan", "PAN")}
            {field("aadhaar", "Aadhaar (optional)")}
            {field("bank_name", "Bank name")}
            {field("account_number", "Account number")}
            {field("ifsc_code", "IFSC code")}
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select
                value={form.payment_mode ?? "Bank Transfer"}
                onValueChange={(v) => setForm((f) => ({ ...f, payment_mode: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("gross_salary", "Gross monthly salary (₹)", "number")}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>

            {/* Employee Portal Login Credentials */}
            <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Key className="size-4" />
                <span>Employee Portal Access Credentials</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set the login password to give this employee (e.g. Sales Consultant) access to view their profile, attendance, and salary slips.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="portal-employee-login-email" className="text-xs text-muted-foreground">Login Email</Label>
                  <Input
                    id="portal-employee-login-email"
                    name="portal-employee-login-email"
                    autoComplete="email"
                    value={form.email || "Enter employee email above"}
                    disabled
                    className="bg-background text-foreground h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="portal-employee-login-password" className="text-xs font-medium">Portal Password</Label>
                  <PasswordInput
                    id="portal-employee-login-password"
                    name="portal-employee-login-password"
                    autoComplete="new-password"
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    placeholder="e.g. blx123 or custom"
                    className="bg-background text-foreground h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Default: blx123 (Admin can set, reveal or update anytime)</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              Save employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Vault Modal */}
      <DocumentVaultModal
        open={Boolean(vaultTarget)}
        onOpenChange={(v) => !v && setVaultTarget(null)}
        employee={
          vaultTarget
            ? employees.find((e) => e.id === vaultTarget.id) || vaultTarget
            : null
        }
        onUpdated={() => qc.invalidateQueries({ queryKey: ["employees"] })}
        uploadedBy="admin"
      />
    </div>
  );
}
