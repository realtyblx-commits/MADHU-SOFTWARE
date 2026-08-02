import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Download, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useEmployees, useSettings, monthRange } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  MONTHS,
  computePayroll,
  downloadCsv,
  inr,
  monthLabel,
  payslipNumber,
  type AttendanceRow,
  type PayrollRow,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollPage,
});

function PayrollPage() {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const { data: employees = [] } = useEmployees();
  const { data: settings } = useSettings();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: payrolls = [] } = useQuery({
    queryKey: ["payroll", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("period_month", month)
        .eq("period_year", year);
      if (error) throw error;
      return (data ?? []) as unknown as PayrollRow[];
    },
  });

  const byEmployee = useMemo(() => {
    const map = new Map<string, PayrollRow>();
    for (const p of payrolls) map.set(p.employee_id, p);
    return map;
  }, [payrolls]);

  const generate = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Company settings not loaded");
      const { from, to } = monthRange(month, year);
      const { data: attendance, error: attErr } = await supabase
        .from("attendance")
        .select("employee_id, status, late_minutes")
        .gte("attendance_date", from)
        .lte("attendance_date", to);
      if (attErr) throw attErr;

      const grouped = new Map<string, Pick<AttendanceRow, "status" | "late_minutes">[]>();
      for (const a of attendance ?? []) {
        const list = grouped.get(a.employee_id) ?? [];
        list.push(a as unknown as Pick<AttendanceRow, "status" | "late_minutes">);
        grouped.set(a.employee_id, list);
      }

      const rows = employees
        .filter((e) => e.employment_status !== "Exited")
        .filter((e) => !byEmployee.get(e.id)?.locked)
        .map((e) => {
          const c = computePayroll(
            Number(e.gross_salary),
            grouped.get(e.id) ?? [],
            settings,
            month,
            year,
          );
          const existing = byEmployee.get(e.id);
          const additionalEarnings = Number(existing?.additional_earnings ?? 0);
          const additionalDeductions = Number(existing?.additional_deductions ?? 0);
          const totalDeduction = c.absentDeduction + c.lateDeduction + additionalDeductions;
          return {
            employee_id: e.id,
            period_month: month,
            period_year: year,
            payslip_number: payslipNumber(e.employee_code, month, year),
            gross_salary: Number(e.gross_salary),
            total_days: c.totalDays,
            payable_days: c.payableDays,
            present_days: c.presentDays,
            absent_days: c.absentDays,
            late_minutes: c.lateMinutes,
            per_day_salary: c.perDaySalary,
            absent_deduction: c.absentDeduction,
            late_deduction: c.lateDeduction,
            additional_earnings: additionalEarnings,
            additional_deductions: additionalDeductions,
            total_deduction: totalDeduction,
            net_salary: Math.max(
              0,
              Number(e.gross_salary) + additionalEarnings - totalDeduction,
            ),
            payment_mode: e.payment_mode,
            status: "Generated",
          };
        });

      if (rows.length === 0) throw new Error("Nothing to generate — all records are locked");
      const { error } = await supabase
        .from("payroll")
        .upsert(rows as never, { onConflict: "employee_id,period_month,period_year" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(`Payroll generated for ${count} employee${count === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("payroll").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = payrolls.reduce(
    (acc, p) => ({
      gross: acc.gross + Number(p.gross_salary),
      deductions: acc.deductions + Number(p.total_deduction),
      net: acc.net + Number(p.net_salary),
    }),
    { gross: 0, deductions: 0, net: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Payroll processing"
        description={`Generate salary for ${monthLabel(month, year)} from attendance, late marks and leave.`}
        actions={
          isManager ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    `payroll_${MONTHS[month - 1]}_${year}.csv`,
                    payrolls as unknown as Record<string, unknown>[],
                  )
                }
              >
                <Download className="size-4" /> Export register
              </Button>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Play className="size-4" /> Generate payroll
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {[
          { label: "Total gross", value: totals.gross },
          { label: "Total deductions", value: totals.deductions },
          { label: "Net payable", value: totals.net },
        ].map((t) => (
          <Card key={t.label} className="p-5 shadow-panel">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className="num mt-2 text-xl font-semibold">{inr(t.value)}</p>
          </Card>
        ))}
      </div>

      <Card className="shadow-panel">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Payable days</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Add employees to run payroll.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e) => {
                  const p = byEmployee.get(e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <p className="font-medium">{e.full_name}</p>
                        <p className="num text-xs text-muted-foreground">{e.employee_code}</p>
                      </TableCell>
                      <TableCell className="num text-right">{inr(e.gross_salary)}</TableCell>
                      <TableCell className="num text-right">
                        {p ? `${p.payable_days}/${p.total_days}` : "—"}
                      </TableCell>
                      <TableCell className="num text-right">{p?.absent_days ?? "—"}</TableCell>
                      <TableCell className="num text-right">
                        {p ? `${p.late_minutes} min` : "—"}
                      </TableCell>
                      <TableCell className="num text-right">
                        {p ? inr(p.total_deduction) : "—"}
                      </TableCell>
                      <TableCell className="num text-right font-semibold">
                        {p ? inr(p.net_salary) : "—"}
                      </TableCell>
                      <TableCell>
                        {p ? (
                          <Badge variant={p.locked ? "default" : "secondary"}>
                            {p.locked ? "Locked" : p.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p ? (
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon">
                              <Link to="/payslips/$id" params={{ id: p.id }}>
                                <FileText className="size-4" />
                              </Link>
                            </Button>
                            {isManager ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={p.locked ? "Unlock" : "Lock payroll"}
                                onClick={() =>
                                  update.mutate({
                                    id: p.id,
                                    patch: {
                                      locked: !p.locked,
                                      status: p.locked ? "Generated" : "Finalized",
                                    },
                                  })
                                }
                              >
                                <Lock
                                  className={
                                    p.locked ? "size-4 text-primary" : "size-4 text-muted-foreground"
                                  }
                                />
                              </Button>
                            ) : null}
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
      </Card>
    </div>
  );
}
