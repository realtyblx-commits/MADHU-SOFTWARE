import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  IndianRupee,
  Users,
  Clock,
  UserX,
  FileText,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PayslipRecord, formatIndianCurrency, downloadCsv, MONTHS, mapPayrollToPayslip } from "@/lib/payroll";
import { logAuditEvent } from "@/lib/audit";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6"];

function ReportsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartTheme = useMemo(
    () => ({
      gridStroke: isDark ? "#334155" : "#e2e8f0",
      axisStroke: isDark ? "#94a3b8" : "#64748b",
      tooltipContent: {
        backgroundColor: isDark ? "#0d1527" : "#ffffff",
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        borderRadius: "0.75rem",
        fontSize: "12px",
        color: isDark ? "#f8fafc" : "#0f172a",
        boxShadow: isDark
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
          : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      },
      tooltipLabel: {
        color: isDark ? "#f8fafc" : "#0f172a",
        fontWeight: 700,
        marginBottom: "6px",
      },
      tooltipItem: {
        color: isDark ? "#f8fafc" : "#0f172a",
        fontSize: "12px",
        padding: "2px 0",
      },
    }),
    [isDark],
  );

  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");

  // Fetch all payslips and legacy payroll rows
  const { data: payslips = [], isLoading } = useQuery<PayslipRecord[]>({
    queryKey: ["reports_payslips"],
    queryFn: async () => {
      const psRes = await supabase.from("payslips").select("*");
      const psList = ((psRes.data || []) as any[]).map((row) => ({
        ...row,
        employee_id: row.employee_id_snapshot || row.employee_id,
        employee_name: row.employee_name_snapshot || row.employee_name || "Employee",
        absent_days: Number(row.absent_days_snapshot ?? row.absent_days ?? 0),
        late_minutes: Number(row.late_minutes_snapshot ?? row.late_minutes ?? 0),
        payment_mode: row.payment_mode_snapshot || row.payment_mode || "Bank Transfer",
        office_timing: row.office_timing_snapshot || row.office_timing || "10:30 AM - 6:30 PM",
        designation: row.designation_snapshot || row.designation,
        department: row.department_snapshot || row.department,
      })) as unknown as PayslipRecord[];
      const prRes = await supabase.from("payroll").select("*, employees(*)");
      const prData = (prRes.data || []) as any[];

      const prMapped: PayslipRecord[] = prData.map(mapPayrollToPayslip);

      const map = new Map<string, PayslipRecord>();
      psList.forEach((p) => map.set(p.id, p));
      prMapped.forEach((p) => {
        if (!map.has(p.id)) map.set(p.id, p);
      });
      return Array.from(map.values());
    },
  });

  // Filtered rows
  const filtered = useMemo(() => {
    return payslips.filter((p) => {
      // Extract year & month from start date or created_at
      const dateStr = p.salary_period_start || p.created_at;
      const d = new Date(dateStr);
      const y = isNaN(d.getFullYear()) ? "2026" : String(d.getFullYear());
      const m = isNaN(d.getMonth()) ? 0 : d.getMonth() + 1;

      if (selectedYear !== "ALL" && y !== selectedYear) return false;
      if (selectedMonth !== "ALL" && String(m) !== selectedMonth) return false;
      if (selectedEmployee !== "ALL" && p.employee_name !== selectedEmployee) return false;
      return true;
    });
  }, [payslips, selectedYear, selectedMonth, selectedEmployee]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    let totalGross = 0;
    let totalAbsentDeduction = 0;
    let totalLateDeduction = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalAbsentDays = 0;
    let totalLateMinutes = 0;

    filtered.forEach((p) => {
      totalGross += Number(p.gross_salary) || 0;
      totalAbsentDeduction += Number(p.absent_deduction) || 0;
      totalLateDeduction += Number(p.late_deduction) || 0;
      totalDeductions += Number(p.total_deduction) || 0;
      totalNet += Number(p.net_salary) || 0;
      totalAbsentDays += Number(p.absent_days) || 0;
      totalLateMinutes += Number(p.late_minutes) || 0;
    });

    return {
      count: filtered.length,
      totalGross,
      totalAbsentDeduction,
      totalLateDeduction,
      totalDeductions,
      totalNet,
      totalAbsentDays,
      totalLateMinutes,
    };
  }, [filtered]);

  // Employee unique names
  const employeeNames = useMemo(() => {
    const s = new Set<string>();
    payslips.forEach((p) => p.employee_name && s.add(p.employee_name));
    return Array.from(s).sort();
  }, [payslips]);

  // Chart 1: Gross vs Net by Employee
  const grossVsNetData = useMemo(() => {
    return filtered.slice(0, 10).map((p) => ({
      name: p.employee_name.split(" ")[0] || p.employee_id,
      gross: p.gross_salary,
      net: p.net_salary,
      deductions: p.total_deduction,
    }));
  }, [filtered]);

  // Chart 2: Deductions Breakdown
  const deductionsBreakdown = useMemo(() => {
    return [
      { name: "Absent Deductions", value: summary.totalAbsentDeduction },
      { name: "Late Deductions", value: summary.totalLateDeduction },
    ].filter((d) => d.value > 0);
  }, [summary]);

  // Chart 3: Monthly Trend Data
  const monthlyTrendData = useMemo(() => {
    const map = new Map<string, { month: string; gross: number; deductions: number; net: number }>();
    MONTHS.forEach((m, idx) => {
      map.set(String(idx + 1), { month: m.slice(0, 3), gross: 0, deductions: 0, net: 0 });
    });

    filtered.forEach((p) => {
      const d = new Date(p.salary_period_start || p.created_at);
      const mKey = String(d.getMonth() + 1);
      const curr = map.get(mKey);
      if (curr) {
        curr.gross += Number(p.gross_salary) || 0;
        curr.deductions += Number(p.total_deduction) || 0;
        curr.net += Number(p.net_salary) || 0;
      }
    });

    return Array.from(map.values());
  }, [filtered]);

  // Chart 4: Attendance Analysis
  const attendanceData = useMemo(() => {
    return filtered.slice(0, 10).map((p) => ({
      name: p.employee_name.split(" ")[0] || p.employee_id,
      absentDays: p.absent_days,
      lateMinutes: p.late_minutes,
    }));
  }, [filtered]);

  // Export CSV
  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.info("No report data available to export.");
      return;
    }
    const rows = filtered.map((p) => ({
      "Payslip No": p.payslip_number,
      "Employee ID": p.employee_id,
      "Employee Name": p.employee_name,
      "Salary Period": p.salary_period_label || `${p.salary_period_start} - ${p.salary_period_end}`,
      "Gross Salary (INR)": p.gross_salary,
      "Absent Deduction (INR)": p.absent_deduction,
      "Late Deduction (INR)": p.late_deduction,
      "Total Deduction (INR)": p.total_deduction,
      "Net Salary (INR)": p.net_salary,
      "Absent Days": p.absent_days,
      "Late Minutes": p.late_minutes,
      "Payment Status": p.payment_status,
      "Date": p.created_at,
    }));
    downloadCsv(`BLX_Payroll_Report_${selectedYear}.csv`, rows);
    logAuditEvent({
      action: "EXPORT_DATA",
      entity_type: "reports",
      description: `Exported BLX Payroll Report (${selectedYear}) with ${rows.length} records`,
      details: { count: rows.length, year: selectedYear },
    });
    toast.success("Payroll report exported to CSV.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive analysis of BLX Realty salary disbursements, attendance deductions, and historical trends."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="size-4 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4 mr-1.5" /> Print Report
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="no-print p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Select Year</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Years</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block mb-1">Select Month</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Months</SelectItem>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={m} value={String(idx + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block mb-1">Filter Employee</span>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Employee" />
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
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Gross Salary</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-foreground">
              ₹ {formatIndianCurrency(summary.totalGross)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <IndianRupee className="size-3.5 text-primary" /> Across {summary.count} payslips
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-destructive">
              - ₹ {formatIndianCurrency(summary.totalDeductions)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Absent: ₹{formatIndianCurrency(summary.totalAbsentDeduction)} · Late: ₹
            {formatIndianCurrency(summary.totalLateDeduction)}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Net Disbursed</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-primary">
              ₹ {formatIndianCurrency(summary.totalNet)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <IndianRupee className="size-3.5 text-primary" /> Net payable to staff
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Attendance Penalties</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-foreground">
              {summary.totalAbsentDays} d · {summary.totalLateMinutes} m
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3.5 text-warning" /> Absent days & late minutes
          </CardContent>
        </Card>
      </div>

      {/* 4 Interactive Charts */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground shadow-sm">
          <BarChart3 className="size-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-lg">No payroll data available yet.</p>
          <p className="text-sm mt-1">
            Create payslips or generate monthly payroll to see comprehensive interactive charts and deductions breakdowns.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart A: Gross vs Net Salary */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">A. Gross Salary vs Net Salary</CardTitle>
              <CardDescription>Comparison of employee earnings before and after deductions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grossVsNetData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={isDark ? 0.25 : 0.7} />
                    <XAxis dataKey="name" fontSize={12} stroke={chartTheme.axisStroke} />
                    <YAxis fontSize={12} stroke={chartTheme.axisStroke} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        `₹ ${formatIndianCurrency(val)}`,
                        name === "gross" ? "Gross Salary" : "Net Salary",
                      ]}
                      contentStyle={chartTheme.tooltipContent}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                    />
                    <Legend />
                    <Bar dataKey="gross" name="Gross Salary" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Salary" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Chart B: Deductions Breakdown */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">B. Deductions Analysis</CardTitle>
              <CardDescription>Ratio of absent day deductions vs late arrival penalties.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full flex items-center justify-center">
                {deductionsBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deductions recorded in selected period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deductionsBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {deductionsBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`₹ ${formatIndianCurrency(val)}`, "Deduction"]}
                        contentStyle={chartTheme.tooltipContent}
                        labelStyle={chartTheme.tooltipLabel}
                        itemStyle={chartTheme.tooltipItem}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart C: Monthly Payroll Trend */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">C. Monthly Payroll Trend ({selectedYear})</CardTitle>
              <CardDescription>Gross payroll, total deductions, and net disbursements across months.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={isDark ? 0.25 : 0.7} />
                    <XAxis dataKey="month" fontSize={12} stroke={chartTheme.axisStroke} />
                    <YAxis fontSize={12} stroke={chartTheme.axisStroke} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        `₹ ${formatIndianCurrency(val)}`,
                        name === "gross" ? "Gross Salary" : name === "deductions" ? "Total Deductions" : "Net Disbursed",
                      ]}
                      contentStyle={chartTheme.tooltipContent}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="gross" name="Gross" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="deductions" name="Deductions" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="net" name="Net Disbursed" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Chart D: Attendance Analysis */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">D. Attendance Penalty Analysis</CardTitle>
              <CardDescription>Absent days and late arrival minutes beyond 10:45 AM.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={isDark ? 0.25 : 0.7} />
                    <XAxis dataKey="name" fontSize={12} stroke={chartTheme.axisStroke} />
                    <YAxis yAxisId="left" orientation="left" stroke="#ef4444" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} />
                    <Tooltip
                      contentStyle={chartTheme.tooltipContent}
                      labelStyle={chartTheme.tooltipLabel}
                      itemStyle={chartTheme.tooltipItem}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="absentDays" name="Absent Days" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="lateMinutes" name="Late Minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
