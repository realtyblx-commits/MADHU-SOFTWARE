import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Receipt,
  Clock,
  IndianRupee,
  UserX,
  Plane,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { inr, MONTHS, monthLabel } from "@/lib/payroll";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="num mt-2 text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", month, year],
    queryFn: async () => {
      const [employees, payrolls, attendanceToday, leaves] = await Promise.all([
        supabase.from("employees").select("id, employment_status"),
        supabase
          .from("payroll")
          .select("id, employee_id, period_month, period_year, net_salary, status"),
        supabase.from("attendance").select("id, status").eq("attendance_date", today()),
        supabase.from("leave_requests").select("id, status, start_date"),
      ]);

      const activeEmployees = (employees.data ?? []).filter(
        (e) => e.employment_status !== "Exited",
      );
      const thisMonth = (payrolls.data ?? []).filter(
        (p) => p.period_month === month && p.period_year === year,
      );

      const monthlyCost = new Map<string, number>();
      for (const p of payrolls.data ?? []) {
        const key = `${p.period_year}-${String(p.period_month).padStart(2, "0")}`;
        monthlyCost.set(key, (monthlyCost.get(key) ?? 0) + Number(p.net_salary));
      }
      const costSeries = [...monthlyCost.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([key, total]) => {
          const [y, m] = key.split("-");
          return { label: `${MONTHS[Number(m) - 1]?.slice(0, 3)} ${y?.slice(2)}`, total };
        });

      const leaveByMonth = new Map<string, number>();
      for (const l of leaves.data ?? []) {
        const key = String(l.start_date).slice(0, 7);
        leaveByMonth.set(key, (leaveByMonth.get(key) ?? 0) + 1);
      }
      const leaveSeries = [...leaveByMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([key, count]) => {
          const [y, m] = key.split("-");
          return { label: `${MONTHS[Number(m) - 1]?.slice(0, 3)} ${y?.slice(2)}`, count };
        });

      const attendanceMix = ["Present", "Absent", "Half Day", "Paid Leave", "Work From Home"].map(
        (status) => ({
          label: status,
          count: (attendanceToday.data ?? []).filter((a) => a.status === status).length,
        }),
      );

      return {
        totalEmployees: activeEmployees.length,
        payrollGenerated: thisMonth.length,
        pendingPayroll: Math.max(0, activeEmployees.length - thisMonth.length),
        totalSalary: thisMonth.reduce((s, p) => s + Number(p.net_salary), 0),
        absentToday: (attendanceToday.data ?? []).filter((a) => a.status === "Absent").length,
        pendingLeaves: (leaves.data ?? []).filter((l) => l.status === "Pending").length,
        costSeries,
        leaveSeries,
        attendanceMix,
      };
    },
  });

  return (
    <div>
      <PageHeader
        title="Payroll Dashboard"
        description={`Overview for ${monthLabel(month, year)} · BLX Realty Private Limited`}
      />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total Employees" value={data.totalEmployees} icon={Users} />
            <StatCard
              label="Payroll Generated"
              value={data.payrollGenerated}
              icon={Receipt}
              hint={monthLabel(month, year)}
            />
            <StatCard label="Pending Payroll" value={data.pendingPayroll} icon={Clock} />
            <StatCard
              label="Total Salary Expense"
              value={inr(data.totalSalary)}
              icon={IndianRupee}
              hint={monthLabel(month, year)}
            />
            <StatCard label="Employees Absent Today" value={data.absentToday} icon={UserX} />
            <StatCard label="Leave Requests Pending" value={data.pendingLeaves} icon={Plane} />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Card className="shadow-panel">
              <CardHeader>
                <CardTitle className="text-base">Monthly payroll cost</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.costSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} />
                    <Tooltip
                      formatter={(v: number) => inr(v)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-panel">
              <CardHeader>
                <CardTitle className="text-base">Attendance today</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.attendanceMix}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-panel xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Leave requests trend</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.leaveSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
