import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  PlusCircle,
  Search,
  Download,
  Printer,
  Edit3,
  Trash2,
  Filter,
  RotateCcw,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PayslipRecord, formatIndianCurrency, downloadCsv, mapPayrollToPayslip, formatSalaryMonthYear } from "@/lib/payroll";
import { downloadPayslipPDF } from "@/lib/pdf-generator";
import { dispatchPayslipNotification } from "@/lib/notifications";
import { logAuditEvent } from "@/lib/audit";
import { PayslipDocument } from "@/components/payslips/PayslipDocument";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/payslips/")({
  component: PayslipsListPage,
});

function PayslipsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: employees = [] } = useEmployees();

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<PayslipRecord | null>(null);
  const [activeDownloadTarget, setActiveDownloadTarget] = useState<PayslipRecord | null>(null);
  const hiddenPrintRef = useRef<HTMLDivElement>(null);

  // Fetch payslips (combined from payslips table and legacy payroll table)
  const { data: payslips = [], isLoading, refetch } = useQuery<PayslipRecord[]>({
    queryKey: ["payslips"],
    queryFn: async () => {
      // 1. Get from payslips table
      const psRes = await supabase
        .from("payslips")
        .select("*")
        .order("created_at", { ascending: false });
      const psList = (psRes.data || []) as unknown as PayslipRecord[];

      // 2. Get from payroll table
      const prRes = await supabase
        .from("payroll")
        .select("*, employees(*)")
        .order("created_at", { ascending: false });
      const prData = (prRes.data || []) as any[];

      const prMapped: PayslipRecord[] = prData.map(mapPayrollToPayslip);

      // Merge and deduplicate by id
      const map = new Map<string, PayslipRecord>();
      psList.forEach((p) => map.set(p.id, p));
      prMapped.forEach((p) => {
        if (!map.has(p.id)) map.set(p.id, p);
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("payslips").delete().eq("id", id);
      await supabase.from("payroll").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Payslip deleted successfully.");
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error("Failed to delete: " + err.message);
    },
  });

  const currentEmp = useMemo(() => {
    if (isAdmin) return null;
    return employees.find(
      (e) =>
        e.email?.toLowerCase() === user?.email?.toLowerCase() ||
        e.user_id === user?.id
    );
  }, [isAdmin, employees, user]);

  const scopedPayslips = useMemo(() => {
    if (isAdmin || !currentEmp) return payslips;
    return payslips.filter(
      (p) =>
        p.employee_id === currentEmp.employee_code ||
        p.employee_id === currentEmp.id ||
        p.employee_name.toLowerCase() === currentEmp.full_name.toLowerCase()
    );
  }, [payslips, isAdmin, currentEmp]);

  // Unique employee names for filtering
  const employeeNames = useMemo(() => {
    const set = new Set<string>();
    scopedPayslips.forEach((p) => {
      if (p.employee_name) set.add(p.employee_name);
    });
    return Array.from(set).sort();
  }, [scopedPayslips]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return scopedPayslips.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.employee_name.toLowerCase().includes(q) ||
        p.employee_id.toLowerCase().includes(q) ||
        p.payslip_number.toLowerCase().includes(q);

      const matchStatus =
        selectedStatus === "ALL" || (p.status || "Generated") === selectedStatus;

      const matchEmp =
        selectedEmployee === "ALL" || p.employee_name === selectedEmployee;

      return matchSearch && matchStatus && matchEmp;
    });
  }, [scopedPayslips, search, selectedStatus, selectedEmployee]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast.info("No payslips to export.");
      return;
    }
    const rows = filteredRows.map((p) => ({
      "Payslip No": p.payslip_number,
      "Employee ID": p.employee_id,
      "Employee Name": p.employee_name,
      "Salary Period": p.salary_period_label || `${p.salary_period_start} - ${p.salary_period_end}`,
      "Gross Salary": p.gross_salary,
      "Absent Deduction": p.absent_deduction,
      "Late Deduction": p.late_deduction,
      "Total Deduction": p.total_deduction,
      "Net Salary": p.net_salary,
      "Payment Mode": p.payment_mode,
      "Payment Status": p.payment_status,
      Status: p.status || "Generated",
      "Created At": p.created_at,
    }));
    downloadCsv(`BLX_Payslips_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Payslip register exported to CSV.");
  };

  // Direct PDF download from list
  const triggerPdfDownload = async (payslip: PayslipRecord) => {
    setActiveDownloadTarget(payslip);
    setTimeout(async () => {
      if (hiddenPrintRef.current) {
        try {
          toast.info("Generating PDF...");
          await downloadPayslipPDF(
            hiddenPrintRef.current,
            `Payslip_${payslip.payslip_number}.pdf`
          );
          dispatchPayslipNotification({
            action: "downloaded",
            employeeName: payslip.employee_name,
            employeeCode: payslip.employee_id,
            payslipNumber: payslip.payslip_number,
            period: payslip.salary_period_label,
          });
          await logAuditEvent({
            action: "DOWNLOAD_PDF",
            entity_type: "payslip",
            entity_id: payslip.payslip_number,
            description: `Exported PDF for payslip ${payslip.payslip_number} (${payslip.employee_name})`,
          });
          toast.success("PDF downloaded successfully.");
        } catch (e: any) {
          toast.error("Download failed: " + e.message);
        } finally {
          setActiveDownloadTarget(null);
        }
      }
    }, 100);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslip Management"
        description="Generate, search, preview, print and download official employee salary slips."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCcw className="size-4 mr-1.5" /> Refresh Data
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="size-4 mr-1.5" /> Export CSV
            </Button>
            {isAdmin && (
              <Button asChild size="sm" className="bg-primary text-primary-foreground font-semibold">
                <Link to="/payslips/create">
                  <PlusCircle className="size-4 mr-1.5" /> Create Payslip
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-payslips"
              name="search-payslips"
              type="search"
              autoComplete="off"
              aria-label="Search payslips by name, ID or slip number"
              className="pl-9"
              placeholder="Search by name, ID or slip number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Employees</SelectItem>
              {employeeNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="Generated">Generated</SelectItem>
              <SelectItem value="Finalized">Finalized</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {(search || selectedEmployee !== "ALL" || selectedStatus !== "ALL") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSelectedEmployee("ALL");
                setSelectedStatus("ALL");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Payslips Table */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Payslip No.</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Salary Month / Period</TableHead>
                <TableHead className="text-right">Gross Salary</TableHead>
                <TableHead className="text-right">Total Deduction</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Loading payslips…
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    <FileText className="size-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-medium text-base">No payslips found.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Create Payslip" to enter payroll data and generate your first salary slip.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">
                      {p.payslip_number}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.employee_id}
                    </TableCell>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground">
                        {formatSalaryMonthYear(p.salary_period_start, p.salary_period_end, p.salary_period_label)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.salary_period_start && p.salary_period_end
                          ? `${p.salary_period_start} to ${p.salary_period_end}`
                          : p.salary_period_label || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ₹ {formatIndianCurrency(p.gross_salary)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">
                      - ₹ {formatIndianCurrency(p.total_deduction)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-primary">
                      ₹ {formatIndianCurrency(p.net_salary)}
                    </TableCell>
                    <TableCell className="text-xs">{p.payment_mode}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "Finalized" ? "default" : "secondary"}>
                        {p.status || "Generated"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          title="View / PDF Preview"
                          className="h-8 w-8"
                        >
                          <Link to="/payslips/$id" params={{ id: p.id }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download PDF"
                          className="h-8 w-8"
                          onClick={() => triggerPdfDownload(p)}
                        >
                          <Download className="size-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              title="Edit Payslip"
                              className="h-8 w-8"
                            >
                              <Link to="/payslips/$id" params={{ id: p.id }}>
                                <Edit3 className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Payslip"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Hidden container used for off-screen PDF rasterization */}
      {activeDownloadTarget && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <PayslipDocument ref={hiddenPrintRef} data={activeDownloadTarget} />
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payslip {deleteTarget?.payslip_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payslip for{" "}
              <strong>{deleteTarget?.employee_name}</strong>? This action will recalculate
              dashboard statistics and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
