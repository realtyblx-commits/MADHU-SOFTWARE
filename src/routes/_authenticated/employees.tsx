import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, Upload, Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
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
  const [form, setForm] = useState<Partial<Employee>>(empty);
  const fileRef = useRef<HTMLInputElement>(null);

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
        const { error } = await supabase.from("employees").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { id: _ignored, ...insert } = body;
        const { error } = await supabase.from("employees").insert(insert as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      toast.success("Employee saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
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
        type={type}
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
                  setForm({
                    ...empty,
                    payment_mode: settings?.default_payment_mode ?? "Bank Transfer",
                    employee_code: `BLX${String(employees.length + 1).padStart(3, "0")}`,
                  });
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> Add employee
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
            <SelectTrigger className="w-48">
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
                <TableHead className="text-right">Gross salary</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No employees yet. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="num font-medium">{e.employee_code}</TableCell>
                    <TableCell>{e.full_name}</TableCell>
                    <TableCell>{e.designation ?? "—"}</TableCell>
                    <TableCell>{e.department ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.employment_status === "Active" ? "default" : "secondary"}>
                        {e.employment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-right">{inr(e.gross_salary)}</TableCell>
                    <TableCell className="text-right">
                      {isManager ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
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
                            onClick={() => remove.mutate(e.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
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
    </div>
  );
}
