import React, { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FileText,
  Wallet,
  Clock,
  Calendar,
  CalendarCheck,
  Plus,
  UserPlus,
  BarChart3,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  Building2,
  Inbox,
  AlertCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayslipRecord, formatIndianCurrency, mapPayrollToPayslip } from "@/lib/payroll";
import { syncLateAttendanceNotifications } from "@/lib/notifications";
import { useTheme } from "@/components/theme-provider";

import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isAdmin } = useAuth();
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
        fontSize: "11px",
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
        fontSize: "11px",
        padding: "2px 0",
      },
    }),
    [isDark],
  );

  const today = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(
    () => today.toLocaleString("en-US", { month: "short", year: "numeric" }),
    [today],
  );

  // Filter states for UI dropdowns
  const [periodFilter, setPeriodFilter] = useState("all");
  const [barPeriod, setBarPeriod] = useState("6m");
  const [deductionFilter, setDeductionFilter] = useState("all");
  const [trendRange, setTrendRange] = useState("6m");
  const [attPeriod, setAttPeriod] = useState("all");

  // Query actual live database records
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard_live_metrics"],
    queryFn: async () => {
      const [empRes, psRes, prRes, attRes] = await Promise.all([
        supabase.from("employees").select("*"),
        supabase.from("payslips").select("*"),
        supabase.from("payroll").select("*, employees(*)"),
        supabase.from("attendance").select("*"),
      ]);

      const employees = (empRes.data ?? []) as any[];
      const psList = (psRes.data ?? []) as unknown as PayslipRecord[];
      const prList = (prRes.data ?? []) as any[];
      const attendance = (attRes.data ?? []) as any[];

      // Merge payslips from both storage sources
      const allMap = new Map<string, PayslipRecord>();
      psList.forEach((p) => allMap.set(p.id, p));
      prList.forEach((r) => {
        if (!allMap.has(r.id)) {
          allMap.set(r.id, mapPayrollToPayslip(r));
        }
      });
      const allPayslips = Array.from(allMap.values());

      return {
        employees,
        allPayslips,
        attendance,
      };
    },
  });

  const rawEmployees = data?.employees ?? [];
  const rawPayslips = data?.allPayslips ?? [];
  const rawAttendance = data?.attendance ?? [];

  // Automatically sync late attendance records beyond 10:45 AM to notification center
  React.useEffect(() => {
    if (rawAttendance.length > 0 && rawEmployees.length > 0) {
      syncLateAttendanceNotifications(rawAttendance as any, rawEmployees as any);
    }
  }, [rawAttendance, rawEmployees]);

  const currentEmp = useMemo(() => {
    if (isAdmin) return null;
    return rawEmployees.find(
      (e: any) =>
        e.email?.toLowerCase() === user?.email?.toLowerCase() ||
        e.user_id === user?.id
    );
  }, [isAdmin, rawEmployees, user]);

  const employees = rawEmployees;
  const allPayslips = useMemo(() => {
    if (isAdmin || !currentEmp) return rawPayslips;
    return rawPayslips.filter(
      (p) =>
        p.employee_id === currentEmp.employee_code ||
        p.employee_id === currentEmp.id ||
        p.employee_name.toLowerCase() === currentEmp.full_name.toLowerCase()
    );
  }, [rawPayslips, isAdmin, currentEmp]);

  const attendance = useMemo(() => {
    if (isAdmin || !currentEmp) return rawAttendance;
    return rawAttendance.filter((a: any) => a.employee_id === currentEmp.id);
  }, [rawAttendance, isAdmin, currentEmp]);

  // Filter payslips based on top period selector
  const filteredPayslips = useMemo(() => {
    if (periodFilter === "all") return allPayslips;
    return allPayslips.filter((p) => {
      const pDate = new Date(p.salary_period_start || p.created_at || Date.now());
      if (periodFilter === "current") {
        return (
          pDate.getMonth() === today.getMonth() &&
          pDate.getFullYear() === today.getFullYear()
        );
      }
      return p.salary_period_label === periodFilter;
    });
  }, [allPayslips, periodFilter, today]);

  // Aggregate strict real numbers from filtered payslips
  const {
    totalGross,
    totalDeductions,
    totalNet,
    totalAbsentDeductions,
    totalLateDeductions,
    totalAbsentDays,
    totalLateMinutes,
  } = useMemo(() => {
    let gross = 0;
    let ded = 0;
    let net = 0;
    let absDed = 0;
    let lateDed = 0;
    let absDays = 0;
    let lateMins = 0;

    filteredPayslips.forEach((p) => {
      gross += Number(p.gross_salary) || 0;
      ded += Number(p.total_deduction) || 0;
      net += Number(p.net_salary) || 0;
      absDed += Number(p.absent_deduction) || 0;
      lateDed += Number(p.late_deduction) || 0;
      absDays += Number((p as any).absent_days_snapshot ?? p.absent_days) || 0;
      lateMins += Number((p as any).late_minutes_snapshot ?? p.late_minutes) || 0;
    });

    // Also include any loose attendance entries not yet processed into payslips
    attendance.forEach((a) => {
      if (a.status === "Absent") absDays += 1;
      if (Number(a.late_minutes) > 0) lateMins += Number(a.late_minutes);
    });

    return {
      totalGross: gross,
      totalDeductions: ded,
      totalNet: net,
      totalAbsentDeductions: absDed,
      totalLateDeductions: lateDed,
      totalAbsentDays: absDays,
      totalLateMinutes: lateMins,
    };
  }, [filteredPayslips, attendance]);

  // Dynamic Upcoming Payroll Calculation
  const { nextPayrollDateFormatted, daysRemaining } = useMemo(() => {
    // Next payroll date is 1st of upcoming month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffMs = nextMonth.getTime() - today.getTime();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const formatted = nextMonth.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return {
      nextPayrollDateFormatted: formatted,
      daysRemaining: String(days).padStart(2, "0"),
    };
  }, [today]);

  // Dynamic Attendance Rate
  const attendanceRate = useMemo(() => {
    if (employees.length === 0) return 0;
    const totalPotentialDays = Math.max(1, employees.length * 30);
    const rate = Math.max(
      0,
      Math.min(
        100,
        Math.round(((totalPotentialDays - totalAbsentDays) / totalPotentialDays) * 100),
      ),
    );
    return rate;
  }, [employees.length, totalAbsentDays]);

  // Month buckets for charts (last 6 months dynamically computed)
  const monthBuckets = useMemo(() => {
    const monthsToShow = barPeriod === "3m" ? 3 : 6;
    const result: {
      month: string;
      rawMonth: number;
      rawYear: number;
      gross: number;
      net: number;
      deductions: number;
    }[] = [];

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      result.push({
        month: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        rawMonth: d.getMonth(),
        rawYear: d.getFullYear(),
        gross: 0,
        net: 0,
        deductions: 0,
      });
    }

    // Populate with real database records
    allPayslips.forEach((p) => {
      const pDate = new Date(p.salary_period_start || p.created_at || Date.now());
      const bucket = result.find(
        (b) => b.rawMonth === pDate.getMonth() && b.rawYear === pDate.getFullYear(),
      );
      if (bucket) {
        // Values in Lakhs (₹1,00,000) for clean chart display
        bucket.gross += (Number(p.gross_salary) || 0) / 100000;
        bucket.net += (Number(p.net_salary) || 0) / 100000;
        bucket.deductions += (Number(p.total_deduction) || 0) / 100000;
      }
    });

    return result.map((b) => ({
      ...b,
      gross: Number(b.gross.toFixed(2)),
      net: Number(b.net.toFixed(2)),
      deductions: Number(b.deductions.toFixed(2)),
    }));
  }, [allPayslips, today, barPeriod]);

  // Deductions Donut Data from real deductions
  const deductionsDonutData = useMemo(() => {
    const total = totalAbsentDeductions + totalLateDeductions;
    if (total === 0) {
      return [{ name: "No Deductions", value: 1, color: "#1e293b" }];
    }
    return [
      { name: "Absent Deduction", value: totalAbsentDeductions, color: "#f97316" },
      { name: "Late Deduction", value: totalLateDeductions, color: "#eab308" },
    ];
  }, [totalAbsentDeductions, totalLateDeductions]);

  const totalDeductionsSum = totalAbsentDeductions + totalLateDeductions;
  const absentDeductionPct =
    totalDeductionsSum > 0
      ? ((totalAbsentDeductions / totalDeductionsSum) * 100).toFixed(1)
      : "0.0";
  const lateDeductionPct =
    totalDeductionsSum > 0
      ? ((totalLateDeductions / totalDeductionsSum) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-5 pb-10">
      {/* Top Welcome Header Bar with Interactive Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <span>Namaskara Guru,</span>
            <span className="text-amber-400">🙏</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
            {isAdmin ? "BLX Admin Bossu" : currentEmp?.full_name || user?.email || "BLX Employee"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin ? "Here's what's happening with your payroll today." : "Here is your personal attendance and payroll summary."}
          </p>
        </div>

        {/* Dynamic Period Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 w-44 rounded-xl border-border/80 bg-card text-xs font-medium" aria-label="Select period filter">
              <Calendar className="size-3.5 text-muted-foreground mr-1.5" />
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods (Lifetime)</SelectItem>
              <SelectItem value="current">Current Month ({currentMonthLabel})</SelectItem>
              <SelectItem value="May 2026">May 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: 6 Top KPI Cards (100% Real Live Database Data) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Employees */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-blue-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-500 mb-2">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Employees</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {employees.length}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold mt-1">
                <TrendingUp className="size-2.5" />
                <span>{employees.length} Active Employees</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Payslips Generated */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-purple-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-600/15 text-purple-400 mb-2">
              <FileText className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Payslips Generated</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {filteredPayslips.length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {periodFilter === "all" ? "Total Generated" : "This Period"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Current Payroll (Net Disbursed) */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-amber-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 mb-2">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Current Payroll</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5 truncate">
                ₹{formatIndianCurrency(totalNet)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {periodFilter === "all" ? "Total Net Disbursed" : currentMonthLabel}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Total Gross Salary */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-emerald-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 mb-2">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Gross Salary</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5 truncate">
                ₹{formatIndianCurrency(totalGross)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Base Earnings</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Total Deductions */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-rose-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 mb-2">
              <TrendingDown className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Deductions</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5 truncate">
                ₹{formatIndianCurrency(totalDeductions)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Absent + Late</p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Total Net Salary */}
        <Card className="shadow-sm border-border/70 bg-card hover:border-purple-500/50 hover:shadow-md transition-all duration-200">
          <CardContent className="p-3.5 flex flex-col justify-between h-full">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400 mb-2">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Net Salary</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5 truncate">
                ₹{formatIndianCurrency(totalNet)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Payable Balance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: 2 Penalty Cards + ⚡ Quick Actions Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Left 2 Cards: Real Absent Days & Late Minutes */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          <Card className="shadow-sm border-border/70 bg-card hover:border-rose-500/40 transition-colors">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 mb-2">
                <Calendar className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Absent Days</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {totalAbsentDays}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Recorded Absences</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/70 bg-card hover:border-amber-500/40 transition-colors">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 mb-2">
                <Clock className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Late Minutes</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {totalLateMinutes}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Beyond 10:45 AM</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Card: Quick Actions Block */}
        <div className="lg:col-span-7">
          <Card className="shadow-sm border-border/70 bg-card h-full">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-3">
                <span className="text-blue-500">⚡</span>
                <span>Quick Actions</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {isAdmin ? (
                  <>
                    {/* 1. Create Payslip */}
                    <Link
                      to="/payslips/create"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-blue-600/10 hover:border-blue-500/40 transition-all text-center"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-110 mb-2">
                        <Plus className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">Create Payslip</span>
                    </Link>

                    {/* 2. Add Employee */}
                    <Link
                      to="/employees"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-purple-600/10 hover:border-purple-500/40 transition-all text-center"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 transition-transform group-hover:scale-110 mb-2">
                        <UserPlus className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">Add Employee</span>
                    </Link>

                    {/* 3. Mark Attendance */}
                    <Link
                      to="/attendance"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-emerald-600/10 hover:border-emerald-500/40 transition-all text-center"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 transition-transform group-hover:scale-110 mb-2">
                        <CalendarCheck className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">Mark Attendance</span>
                    </Link>

                    {/* 4. Generate Report */}
                    <Link
                      to="/reports"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-amber-600/10 hover:border-amber-500/40 transition-all text-center"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/30 transition-transform group-hover:scale-110 mb-2">
                        <BarChart3 className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">Generate Report</span>
                    </Link>
                  </>
                ) : (
                  <>
                    {/* Employee Quick Actions */}
                    <Link
                      to="/payslips"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-blue-600/10 hover:border-blue-500/40 transition-all text-center col-span-2 sm:col-span-2"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-110 mb-2">
                        <FileText className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">My Payslips & PDFs</span>
                    </Link>

                    <Link
                      to="/attendance"
                      className="group flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-emerald-600/10 hover:border-emerald-500/40 transition-all text-center col-span-2 sm:col-span-2"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 transition-transform group-hover:scale-110 mb-2">
                        <CalendarCheck className="size-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">My Attendance Records</span>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3: 3 Analytics Charts (Built from Live Records) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Chart 1: Gross vs Net Salary */}
        <Card className="shadow-sm border-border/70 bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-foreground">Gross vs Net Salary</CardTitle>
            <Select value={barPeriod} onValueChange={setBarPeriod}>
              <SelectTrigger className="h-7 w-28 text-[10px] rounded-md bg-muted/40 border-border/60" aria-label="Select gross vs net range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-600" />
                  <span>Gross Salary</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Net Salary</span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/80">(₹ in Lakhs)</span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthBuckets} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={isDark ? 0.25 : 0.7} vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} stroke={chartTheme.axisStroke} />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    stroke={chartTheme.axisStroke}
                    tickFormatter={(v) => `${v}L`}
                  />
                  <Tooltip
                    formatter={(val: any, name: string) => [
                      `₹${Number(val).toFixed(2)} Lakhs`,
                      name === "gross" ? "Gross Salary" : "Net Salary",
                    ]}
                    contentStyle={chartTheme.tooltipContent}
                    labelStyle={chartTheme.tooltipLabel}
                    itemStyle={chartTheme.tooltipItem}
                  />
                  <Bar dataKey="gross" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="net" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Deductions Analysis */}
        <Card className="shadow-sm border-border/70 bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-foreground">Deductions Analysis</CardTitle>
            <Select value={deductionFilter} onValueChange={setDeductionFilter}>
              <SelectTrigger className="h-7 w-28 text-[10px] rounded-md bg-muted/40 border-border/60" aria-label="Select deductions range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-center justify-between gap-2 h-48">
              {/* Donut Chart with Center Text */}
              <div className="relative size-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deductionsDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={68}
                      paddingAngle={totalDeductionsSum > 0 ? 2 : 0}
                      dataKey="value"
                    >
                      {deductionsDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-sm font-bold text-foreground truncate max-w-[110px]">
                    ₹{formatIndianCurrency(totalDeductionsSum)}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Total Deductions
                  </span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="space-y-3 min-w-0 flex-1 pl-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                    <span className="size-2 rounded-full bg-orange-500 shrink-0" />
                    <span className="truncate">Absent Deduction</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground ml-3.5 mt-0.5">
                    ₹{formatIndianCurrency(totalAbsentDeductions)}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({absentDeductionPct}%)
                    </span>
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate">Late Deduction</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground ml-3.5 mt-0.5">
                    ₹{formatIndianCurrency(totalLateDeductions)}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({lateDeductionPct}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Monthly Payroll Trend */}
        <Card className="shadow-sm border-border/70 bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-foreground">Monthly Payroll Trend</CardTitle>
            <Select value={trendRange} onValueChange={setTrendRange}>
              <SelectTrigger className="h-7 w-24 text-[10px] rounded-md bg-muted/40 border-border/60" aria-label="Select payroll trend range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="3m">3 Months</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-blue-600" />
                  <span>Gross</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Deductions</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Net</span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/80">(₹ in Lakhs)</span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={isDark ? 0.25 : 0.7} vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} stroke={chartTheme.axisStroke} />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    stroke={chartTheme.axisStroke}
                    tickFormatter={(v) => `${v}L`}
                  />
                  <Tooltip
                    formatter={(val: any, name: string) => [
                      `₹${Number(val).toFixed(2)} Lakhs`,
                      name === "gross" ? "Gross Salary" : name === "deductions" ? "Total Deductions" : "Net Salary",
                    ]}
                    contentStyle={chartTheme.tooltipContent}
                    labelStyle={chartTheme.tooltipLabel}
                    itemStyle={chartTheme.tooltipItem}
                  />
                  <Line type="monotone" dataKey="gross" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="deductions" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Bottom 3 Section Cards (Real Attendance, Real Recent Payslips, Dynamic Upcoming Payroll) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
        {/* Column 1: Attendance Overview */}
        <Card className="lg:col-span-4 shadow-sm border-border/70 bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-foreground">Attendance Overview</CardTitle>
            <Select value={attPeriod} onValueChange={setAttPeriod}>
              <SelectTrigger className="h-7 w-24 text-[10px] rounded-md bg-muted/40 border-border/60" aria-label="Select attendance range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-4 pt-4 flex items-center justify-between gap-3">
            {/* Radial Gauge SVG */}
            <div className="relative size-32 flex items-center justify-center shrink-0">
              <svg className="size-32 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="transparent"
                  stroke="#06b6d4"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - attendanceRate / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-foreground">{attendanceRate}%</span>
                <span className="text-[9px] text-muted-foreground">Attendance Rate</span>
              </div>
            </div>

            {/* Right Mini Pills with Real Counts */}
            <div className="space-y-3 min-w-0 flex-1">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5 text-rose-400" />
                  <span>Absent Days</span>
                </div>
                <div className="text-base font-bold text-foreground mt-0.5">{totalAbsentDays}</div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {totalAbsentDays === 0 ? "Zero absences recorded" : "Total recorded days"}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-amber-400" />
                  <span>Late Minutes</span>
                </div>
                <div className="text-base font-bold text-foreground mt-0.5">{totalLateMinutes}</div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {totalLateMinutes === 0 ? "Zero late arrivals" : "Total delayed minutes"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Recent Payslips (Real Live Payslips or Clean Zero State) */}
        <Card className="lg:col-span-5 shadow-sm border-border/70 bg-card flex flex-col">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-foreground">Recent Payslips</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 p-0">
              <Link to="/payslips">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-center">
            {allPayslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground mb-2">
                  <Inbox className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">No payslips generated yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[240px]">
                  All generated payslips will appear here in real time.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 text-xs h-7">
                  <Link to="/payslips/create">
                    <Plus className="size-3 mr-1" /> Create Payslip
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] text-muted-foreground uppercase">
                      <th className="py-2 font-medium">Payslip No.</th>
                      <th className="py-2 font-medium">Employee</th>
                      <th className="py-2 font-medium">Period</th>
                      <th className="py-2 font-medium">Net Salary</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {allPayslips.slice(0, 4).map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 font-mono text-[11px] text-muted-foreground">
                          {row.payslip_number}
                        </td>
                        <td className="py-2 font-semibold text-foreground">
                          {row.employee_name}
                        </td>
                        <td className="py-2 text-[11px] text-muted-foreground">
                          {row.salary_period_label || currentMonthLabel}
                        </td>
                        <td className="py-2 text-[11px] font-semibold text-foreground">
                          ₹{formatIndianCurrency(row.net_salary)}
                        </td>
                        <td className="py-2 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            {row.status || "Generated"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Upcoming Payroll (Strict Dynamic Calculation from Today's Date) */}
        <Card className="lg:col-span-3 shadow-sm border-border/70 bg-card flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2 space-y-0 text-xs font-bold text-foreground">
            <Calendar className="size-4 text-blue-500" />
            <span>Upcoming Payroll</span>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-center justify-between gap-3 my-auto">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Next Payroll Date</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {nextPayrollDateFormatted}
              </p>

              <p className="text-[11px] text-muted-foreground font-medium mt-3">Days Remaining</p>
              <p className="text-4xl font-extrabold tracking-tight text-blue-500 mt-0.5">
                {daysRemaining}
              </p>
            </div>

            {/* 3D Isometric Desk Calendar Illustration */}
            <div className="size-24 rounded-2xl overflow-hidden shadow-lg border border-border/50 shrink-0 bg-slate-900/50">
              <img
                src="/calendar-3d.jpg"
                alt="Upcoming Payroll Calendar"
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
        <p>© {today.getFullYear()} BLX Realty Private Limited. All rights reserved.</p>
        <a
          href="https://www.theblxrealty.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition-colors font-mono"
        >
          www.theblxrealty.com
        </a>
      </footer>
    </div>
  );
}
