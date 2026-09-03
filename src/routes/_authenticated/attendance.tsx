import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCheck, Download, PlusCircle, FileText, Clock, CalendarCheck, CalendarX, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useEmployees, useSettings, monthRange } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { dispatchLateMobileNotification } from "@/lib/notifications";
import { logAuditEvent } from "@/lib/audit";
import {
  ATTENDANCE_STATUSES,
  MONTHS,
  downloadCsv,
  formatTime,
  minutesToHoursLabel,
  type AttendanceRow,
  type Employee,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput12 } from "@/components/ui/time-input-12";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const statusTone = (status: string) =>
  status === "Absent" || status === "Unpaid Leave"
    ? "destructive"
    : status === "Half Day"
      ? "outline"
      : "secondary";

function AttendancePage() {
  const qc = useQueryClient();
  const { isManager, user } = useAuth();
  const { data: employees = [] } = useEmployees();
  const { data: settings } = useSettings();

  const { data: directEmp, isLoading: isDirectEmpLoading } = useQuery({
    queryKey: ["current-employee", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return null;
      // 1. Try by user_id
      const { data: byId } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (byId) return byId as unknown as Employee;

      // 2. Try by email
      if (user.email) {
        const { data: byEmail } = await supabase
          .from("employees")
          .select("*")
          .ilike("email", user.email)
          .maybeSingle();
        if (byEmail) return byEmail as unknown as Employee;
      }
      return null;
    },
    enabled: !isManager && !!user,
  });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: dayRows = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("attendance_date", date);
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });

  const { data: monthRows = [] } = useQuery({
    queryKey: ["attendance-month", month, year],
    queryFn: async () => {
      const { from, to } = monthRange(month, year);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("attendance_date", from)
        .lte("attendance_date", to);
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });

  const byEmployee = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of dayRows) map.set(r.employee_id, r);
    return map;
  }, [dayRows]);

  function computeRowMetrics(
    check_in?: string | null,
    check_out?: string | null,
    office_start = settings?.office_start ?? "10:30",
    grace_minutes = settings?.grace_minutes ?? 15
  ) {
    let working_hours = 0;
    let late_minutes = 0;

    if (check_in && check_out) {
      const inParts = check_in.split(":").map((v) => Number(v));
      const outParts = check_out.split(":").map((v) => Number(v));
      const inH = inParts[0] ?? 0;
      const inM = inParts[1] ?? 0;
      const outH = outParts[0] ?? 0;
      const outM = outParts[1] ?? 0;

      if (!isNaN(inH) && !isNaN(inM) && !isNaN(outH) && !isNaN(outM)) {
        const inMins = inH * 60 + inM;
        const outMins = outH * 60 + outM;
        if (outMins > inMins) {
          working_hours = Math.round(((outMins - inMins) / 60) * 100) / 100;
        }
      }
    }

    if (check_in) {
      const inParts = check_in.split(":").map((v) => Number(v));
      const startParts = office_start.split(":").map((v) => Number(v));
      const inH = inParts[0] ?? 0;
      const inM = inParts[1] ?? 0;
      const startH = startParts[0] ?? 0;
      const startM = startParts[1] ?? 0;

      if (!isNaN(inH) && !isNaN(inM) && !isNaN(startH) && !isNaN(startM)) {
        const checkInTotal = inH * 60 + inM;
        const threshold = startH * 60 + startM + grace_minutes;
        if (checkInTotal > threshold) {
          late_minutes = checkInTotal - threshold;
        }
      }
    }

    return { working_hours, late_minutes };
  }

  const upsert = useMutation({
    mutationFn: async (row: {
      employee_id: string;
      status?: string;
      check_in?: string | null;
      check_out?: string | null;
    }) => {
      const existing = byEmployee.get(row.employee_id);
      const newStatus = row.status ?? existing?.status ?? "Present";
      const newCheckIn =
        row.check_in !== undefined ? row.check_in || null : (existing?.check_in ?? null);
      const newCheckOut =
        row.check_out !== undefined ? row.check_out || null : (existing?.check_out ?? null);

      const metrics = computeRowMetrics(newCheckIn, newCheckOut);
      const working_hours =
        metrics.working_hours > 0
          ? metrics.working_hours
          : newStatus === "Present"
            ? 8
            : newStatus === "Half Day"
              ? 4
              : 0;

      const payload = {
        employee_id: row.employee_id,
        attendance_date: date,
        status: newStatus,
        check_in: newCheckIn,
        check_out: newCheckOut,
        working_hours,
        late_minutes: metrics.late_minutes,
      };
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;

      // When employee check-in is after 10:45 AM, dispatch mobile notification
      if (metrics.late_minutes > 0) {
        const emp = employees.find((e) => e.id === row.employee_id);
        if (emp) {
          dispatchLateMobileNotification(emp, metrics.late_minutes, newCheckIn || "10:46 AM");
        }
      }

      const emp = employees.find((e) => e.id === row.employee_id);
      await logAuditEvent({
        action: "ATTENDANCE_UPDATE",
        entity_type: "attendance",
        entity_id: emp?.employee_code || row.employee_id,
        description: `Attendance marked for ${emp?.full_name || "Employee"} on ${date} (In: ${newCheckIn || "—"}, Out: ${newCheckOut || "—"}, Status: ${newStatus || "Present"})`,
        details: {
          employee_code: emp?.employee_code,
          employee_name: emp?.full_name,
          date,
          check_in: newCheckIn,
          check_out: newCheckOut,
          status: newStatus,
          working_hours,
          late_minutes: metrics.late_minutes,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      qc.invalidateQueries({ queryKey: ["attendance-month"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllPresent = useMutation({
    mutationFn: async () => {
      const start = settings?.office_start ?? "10:30";
      const end = settings?.office_end ?? "18:30";
      const metrics = computeRowMetrics(start, end);
      const payload = employees
        .filter((e) => e.employment_status !== "Exited")
        .map((e) => ({
          employee_id: e.id,
          attendance_date: date,
          status: "Present",
          check_in: start,
          check_out: end,
          working_hours: metrics.working_hours || 8,
          late_minutes: 0,
        }));
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;

      await logAuditEvent({
        action: "ATTENDANCE_UPDATE",
        entity_type: "attendance",
        description: `Manager marked all ${payload.length} active employees present for ${date}`,
        details: { count: payload.length, date },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      toast.success("All employees marked present");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [localEdits, setLocalEdits] = useState<
    Record<string, { check_in?: string; check_out?: string; status?: string }>
  >({});

  const getRowData = (empId: string) => {
    const serverRow = byEmployee.get(empId);
    const edits = localEdits[empId];
    const check_in =
      edits?.check_in !== undefined ? edits.check_in : (serverRow?.check_in?.slice(0, 5) ?? "");
    const check_out =
      edits?.check_out !== undefined ? edits.check_out : (serverRow?.check_out?.slice(0, 5) ?? "");
    const status = edits?.status !== undefined ? edits.status : (serverRow?.status ?? "Present");

    const metrics = computeRowMetrics(check_in, check_out);
    const working_hours =
      metrics.working_hours > 0
        ? metrics.working_hours
        : status === "Present"
          ? 8
          : status === "Half Day"
            ? 4
            : 0;

    return {
      check_in,
      check_out,
      status,
      working_hours,
      late_minutes: metrics.late_minutes,
    };
  };

  const lateSummary = useMemo(() => {
    const map = new Map<string, { minutes: number; days: number }>();
    for (const r of monthRows) {
      if (!r.late_minutes) continue;
      const prev = map.get(r.employee_id) ?? { minutes: 0, days: 0 };
      map.set(r.employee_id, { minutes: prev.minutes + r.late_minutes, days: prev.days + 1 });
    }
    return map;
  }, [monthRows]);

  const detailedLateRecords = useMemo(() => {
    return monthRows
      .filter((r) => r.late_minutes && r.late_minutes > 0)
      .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }, [monthRows]);

  const currentEmp = useMemo(() => {
    if (isManager) return null;
    return (
      directEmp ||
      employees.find(
        (e) =>
          (e.user_id && user?.id && e.user_id === user.id) ||
          (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())
      ) ||
      employees[0] ||
      null
    );
  }, [isManager, directEmp, employees, user]);

  const myMonthRows = useMemo(() => {
    if (!currentEmp) return [];
    return monthRows
      .filter((r) => r.employee_id === currentEmp.id)
      .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }, [monthRows, currentEmp]);

  const myLateRecords = useMemo(() => {
    return myMonthRows.filter((r) => (r.late_minutes ?? 0) > 0);
  }, [myMonthRows]);

  const myStats = useMemo(() => {
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let paidLeaveDays = 0;
    let totalWorkingHours = 0;
    let totalLateMinutes = 0;
    let lateDays = 0;

    myMonthRows.forEach((r) => {
      if (r.status === "Present") presentDays += 1;
      else if (r.status === "Half Day") halfDays += 1;
      else if (r.status === "Absent" || r.status === "Unpaid Leave") absentDays += 1;
      else if (r.status === "Paid Leave") paidLeaveDays += 1;

      totalWorkingHours += Number(r.working_hours) || 0;
      const late = Number(r.late_minutes) || 0;
      if (late > 0) {
        lateDays += 1;
        totalLateMinutes += late;
      }
    });

    const totalAttendanceDays = presentDays + halfDays;
    const punctualityScore =
      totalAttendanceDays > 0
        ? Math.round(((totalAttendanceDays - lateDays) / totalAttendanceDays) * 100)
        : 100;

    return {
      presentDays,
      halfDays,
      totalAttendanceDays,
      absentDays,
      paidLeaveDays,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      totalLateMinutes,
      lateDays,
      punctualityScore,
      avgDailyHours:
        totalAttendanceDays > 0
          ? (totalWorkingHours / totalAttendanceDays).toFixed(1)
          : "0.0",
    };
  }, [myMonthRows]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayRecord = useMemo(() => {
    if (!currentEmp) return null;
    return (
      dayRows.find((r) => r.employee_id === currentEmp.id) ||
      monthRows.find((r) => r.employee_id === currentEmp.id && r.attendance_date === todayStr) ||
      null
    );
  }, [dayRows, monthRows, currentEmp, todayStr]);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      let activeEmp = currentEmp;
      if (!activeEmp && user?.id) {
        const { data: fetchedEmp } = await supabase
          .from("employees")
          .select("*")
          .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle();
        activeEmp = (fetchedEmp as unknown as Employee) || null;
      }
      if (!activeEmp) throw new Error("Employee profile not found. Please contact Administrator.");
      const d = new Date();
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const metrics = computeRowMetrics(timeStr, null);
      const payload = {
        employee_id: activeEmp.id,
        attendance_date: todayStr,
        status: "Present",
        check_in: timeStr,
        check_out: null,
        working_hours: 0,
        late_minutes: metrics.late_minutes,
      };
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;

      await logAuditEvent({
        action: "ATTENDANCE_CHECK_IN",
        entity_type: "attendance",
        entity_id: activeEmp.employee_code,
        user_email: user?.email || activeEmp.email || undefined,
        description: `Employee ${activeEmp.full_name} (${activeEmp.employee_code}) clocked in at ${formatTime(timeStr)}`,
        details: {
          employee_code: activeEmp.employee_code,
          employee_name: activeEmp.full_name,
          time: timeStr,
          date: todayStr,
          late_minutes: metrics.late_minutes,
        },
      });

      return timeStr;
    },
    onSuccess: (time) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-month"] });
      toast.success(`Checked in at ${formatTime(time)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      let activeEmp = currentEmp;
      if (!activeEmp && user?.id) {
        const { data: fetchedEmp } = await supabase
          .from("employees")
          .select("*")
          .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
          .maybeSingle();
        activeEmp = (fetchedEmp as unknown as Employee) || null;
      }
      if (!activeEmp || !todayRecord) throw new Error("No check-in record found for today");
      const d = new Date();
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const metrics = computeRowMetrics(todayRecord.check_in, timeStr);
      const working_hours = metrics.working_hours > 0 ? metrics.working_hours : 8;
      const payload = {
        ...todayRecord,
        check_out: timeStr,
        working_hours,
      };
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;

      await logAuditEvent({
        action: "ATTENDANCE_CHECK_OUT",
        entity_type: "attendance",
        entity_id: activeEmp.employee_code,
        user_email: user?.email || activeEmp.email || undefined,
        description: `Employee ${activeEmp.full_name} (${activeEmp.employee_code}) clocked out at ${formatTime(timeStr)} (${working_hours}h worked)`,
        details: {
          employee_code: activeEmp.employee_code,
          employee_name: activeEmp.full_name,
          time: timeStr,
          date: todayStr,
          working_hours,
        },
      });

      return { time: timeStr, hours: working_hours };
    },
    onSuccess: ({ time, hours }) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-month"] });
      toast.success(`Checked out at ${formatTime(time)} · ${hours}h worked`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportMyAttendance = () => {
    if (!currentEmp) return;
    const data = myMonthRows.map((r) => ({
      Date: r.attendance_date,
      "Employee Code": currentEmp.employee_code,
      "Employee Name": currentEmp.full_name,
      Status: r.status,
      "Check In": r.check_in ? formatTime(r.check_in) : "—",
      "Check Out": r.check_out ? formatTime(r.check_out) : "—",
      "Working Hours": r.working_hours,
      "Late (Minutes)": r.late_minutes ?? 0,
      Remarks: r.remarks ?? "",
    }));
    downloadCsv(`attendance_${currentEmp.employee_code}_${MONTHS[month - 1]}_${year}.csv`, data);
    logAuditEvent({
      action: "EXPORT_DATA",
      entity_type: "attendance",
      entity_id: currentEmp.employee_code,
      user_email: user?.email || currentEmp.email || undefined,
      description: `Employee ${currentEmp.full_name} (${currentEmp.employee_code}) exported personal attendance register for ${MONTHS[month - 1]} ${year}`,
    });
  };

  if (!isManager) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Attendance"
          description={`Office timing ${formatTime(settings?.office_start)} – ${formatTime(
            settings?.office_end,
          )} · Late arrival counted after ${settings?.grace_minutes ?? 15} min grace (10:45 AM)`}
          actions={
            <Button
              variant="outline"
              onClick={exportMyAttendance}
              disabled={myMonthRows.length === 0}
            >
              <Download className="size-4 mr-1.5" /> Export My Attendance
            </Button>
          }
        />

        {/* Employee Identity & Month Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-base shadow-sm">
              {currentEmp?.full_name?.slice(0, 2).toUpperCase() || (user?.email?.slice(0, 2).toUpperCase() || "ME")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base text-foreground">
                  {currentEmp?.full_name || (isDirectEmpLoading ? "Loading profile..." : (user?.user_metadata?.["full_name"] || "Employee"))}
                </p>
                <Badge variant="outline" className="font-mono text-xs">
                  {currentEmp?.employee_code || user?.user_metadata?.["employee_code"] || "BLX26-001"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentEmp?.designation || "Staff"} · {currentEmp?.department || "Operations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9 text-xs">
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
            <Input
              type="number"
              className="w-24 h-9 text-xs"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </div>

        {/* 5 Personal Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Present Days */}
          <Card className="p-4 shadow-panel border-sidebar-border bg-card/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Days Present</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CalendarCheck className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myStats.presentDays} <span className="text-sm font-normal text-muted-foreground">days</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {myStats.halfDays > 0 ? `+ ${myStats.halfDays} half-day` : "Full attendance recorded"}
            </p>
          </Card>

          {/* Card 2: Total Hours */}
          <Card className="p-4 shadow-panel border-sidebar-border bg-card/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Working Hours</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Clock className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myStats.totalWorkingHours} <span className="text-sm font-normal text-muted-foreground">hrs</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Avg {myStats.avgDailyHours}h / day
            </p>
          </Card>

          {/* Card 3: Late Arrivals */}
          <Card className="p-4 shadow-panel border-sidebar-border bg-card/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Late Arrivals</span>
              <div
                className={`p-2 rounded-lg border ${
                  myStats.lateDays > 0
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                }`}
              >
                <AlertTriangle className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myStats.lateDays} <span className="text-sm font-normal text-muted-foreground">{myStats.lateDays === 1 ? "time" : "times"}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {myStats.totalLateMinutes > 0 ? `${myStats.totalLateMinutes}m total late` : "Zero late arrivals"}
            </p>
          </Card>

          {/* Card 4: Absents & Leaves */}
          <Card className="p-4 shadow-panel border-sidebar-border bg-card/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Absents / Leaves</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <CalendarX className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myStats.absentDays} <span className="text-sm font-normal text-muted-foreground">absent</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {myStats.paidLeaveDays > 0 ? `${myStats.paidLeaveDays} paid leave` : "No leave requests"}
            </p>
          </Card>

          {/* Card 5: Punctuality Score */}
          <Card className="p-4 shadow-panel border-sidebar-border bg-card/60 relative overflow-hidden col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Punctuality</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {myStats.punctualityScore}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {myStats.punctualityScore >= 95 ? "Excellent record" : "Needs attention"}
            </p>
          </Card>
        </div>

        {/* Today's Punch Card */}
        <Card className="p-4 sm:p-5 shadow-panel border-sidebar-border bg-gradient-to-r from-blue-950/20 to-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                  Today
                </Badge>
                <span className="font-semibold text-sm">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {todayRecord?.check_in
                  ? `Checked in at ${formatTime(todayRecord.check_in)}${todayRecord.check_out ? ` · Checked out at ${formatTime(todayRecord.check_out)} (${todayRecord.working_hours}h)` : " · In office"}`
                  : "You haven't checked in yet today."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!todayRecord?.check_in ? (
                <Button
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Clock className="size-4" /> Clock In Today
                </Button>
              ) : !todayRecord?.check_out ? (
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
                  variant="outline"
                  className="gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-950/30"
                >
                  <Clock className="size-4" /> Clock Out Today
                </Button>
              ) : (
                <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <CheckCheck className="size-3.5" /> Shift Completed
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Employee Tabs: Register vs Late Arrivals */}
        <Tabs defaultValue="register">
          <TabsList>
            <TabsTrigger value="register">My Attendance Register</TabsTrigger>
            <TabsTrigger value="late" className="relative">
              Late arrivals
              {myLateRecords.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                  {myLateRecords.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <Card className="shadow-panel">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {MONTHS[month - 1]} {year} Register
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your daily check-in, check-out, working hours, and punctuality status.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {myMonthRows.length} {myMonthRows.length === 1 ? "day" : "days"} recorded
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check in</TableHead>
                      <TableHead>Check out</TableHead>
                      <TableHead className="text-right">Working Hours</TableHead>
                      <TableHead>Punctuality</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myMonthRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No attendance records found for {MONTHS[month - 1]} {year}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      myMonthRows.map((r) => {
                        const dateObj = new Date(r.attendance_date + "T00:00:00");
                        const formattedDate = dateObj.toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                        const isLate = (r.late_minutes ?? 0) > 0;

                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-xs">
                              {formattedDate}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {r.check_in ? formatTime(r.check_in) : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {r.check_out ? formatTime(r.check_out) : "—"}
                            </TableCell>
                            <TableCell className="num text-right font-medium text-xs">
                              {r.working_hours > 0 ? `${Number(r.working_hours).toFixed(2)}h` : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {isLate ? (
                                <Badge variant="destructive" className="font-semibold text-[11px]">
                                  {r.late_minutes}m late
                                </Badge>
                              ) : r.check_in ? (
                                <span className="inline-flex items-center text-emerald-400 text-xs gap-1 font-medium">
                                  <CheckCheck className="size-3.5" /> On time
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={statusTone(r.status)} className="text-xs capitalize">
                                {r.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="late" className="mt-4 space-y-4">
            <Card className="shadow-panel">
              <div className="p-4 border-b bg-muted/20">
                <p className="font-semibold text-sm">My Late Arrival Log</p>
                <p className="text-xs text-muted-foreground">
                  Record of arrivals after 10:45 AM (10:30 AM office start + 15 min grace) for {MONTHS[month - 1]} {year}.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Arrival Time</TableHead>
                      <TableHead>Scheduled Start</TableHead>
                      <TableHead className="text-right">Late Minutes</TableHead>
                      <TableHead className="text-right">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myLateRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          <p className="font-medium text-emerald-400">Great punctuality!</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            You have zero late arrivals recorded for {MONTHS[month - 1]} {year}.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      myLateRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-xs">
                            {r.attendance_date}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-rose-400">
                            {formatTime(r.check_in)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            10:30 AM (+15m grace)
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="font-semibold text-xs">
                              {r.late_minutes}m late
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {r.remarks || "Late block penalty applies"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Office timing ${formatTime(settings?.office_start)} – ${formatTime(
          settings?.office_end,
        )} · Late after ${settings?.grace_minutes ?? 15} min grace (10:45 AM)`}
        actions={
          isManager ? (
            <Button onClick={() => markAllPresent.mutate()} disabled={markAllPresent.isPending}>
              <CheckCheck className="size-4" /> Mark all present
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily register</TabsTrigger>
          <TabsTrigger value="late" className="relative">
            Late arrivals
            {detailedLateRecords.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                {detailedLateRecords.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payroll">Payroll Attendance Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card className="shadow-panel">
            <div className="flex flex-wrap items-end gap-3 border-b p-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  className="w-48"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setLocalEdits({});
                  }}
                />
              </div>
              <Button
                variant="outline"
                className="ml-auto"
                onClick={() =>
                  downloadCsv(
                    `attendance_${date}.csv`,
                    dayRows as unknown as Record<string, unknown>[],
                  )
                }
              >
                <Download className="size-4" /> Export day
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="w-44">Check in</TableHead>
                    <TableHead className="w-44">Check out</TableHead>
                    <TableHead className="w-44">Status</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Add employees first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((e) => {
                      const rowData = getRowData(e.id);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <p className="font-medium">{e.full_name}</p>
                            <p className="num text-xs text-muted-foreground">{e.employee_code}</p>
                          </TableCell>
                          <TableCell>
                            <TimeInput12
                              disabled={!isManager}
                              defaultPeriod="AM"
                              placeholder="10:30"
                              value={rowData.check_in}
                              onChange={(val) => {
                                setLocalEdits((prev) => ({
                                  ...prev,
                                  [e.id]: { ...prev[e.id], check_in: val },
                                }));
                                upsert.mutate({ employee_id: e.id, check_in: val });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TimeInput12
                              disabled={!isManager}
                              defaultPeriod="PM"
                              placeholder="06:30"
                              value={rowData.check_out}
                              onChange={(val) => {
                                setLocalEdits((prev) => ({
                                  ...prev,
                                  [e.id]: { ...prev[e.id], check_out: val },
                                }));
                                upsert.mutate({ employee_id: e.id, check_out: val });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={!isManager}
                              value={rowData.status}
                              onValueChange={(v) => {
                                setLocalEdits((prev) => ({
                                  ...prev,
                                  [e.id]: { ...prev[e.id], status: v },
                                }));
                                upsert.mutate({ employee_id: e.id, status: v });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Not marked" />
                              </SelectTrigger>
                              <SelectContent>
                                {ATTENDANCE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {rowData.working_hours > 0 ? `${rowData.working_hours.toFixed(2)}h` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {rowData.late_minutes > 0 ? (
                              <Badge variant="destructive" className="font-semibold">
                                {rowData.late_minutes}m late
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="late" className="mt-4 space-y-4">
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

            {/* Individual Late Records Log */}
            <div className="p-4 border-b bg-muted/20">
              <p className="font-semibold text-sm">Detailed Daily Late Log</p>
              <p className="text-xs text-muted-foreground">
                All daily arrival times past the 10:45 AM threshold recorded for {MONTHS[month - 1]} {year}.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Arrival Time</TableHead>
                    <TableHead>Expected Start</TableHead>
                    <TableHead className="text-right">Late Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedLateRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No late arrivals recorded for this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detailedLateRecords.map((r) => {
                      const emp = employees.find((e) => e.id === r.employee_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-xs">
                            {r.attendance_date}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-xs">{emp?.full_name ?? "—"}</p>
                            <p className="num text-[11px] text-muted-foreground">{emp?.employee_code}</p>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {formatTime(r.check_in)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            10:30 AM (+15m grace)
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="font-semibold text-xs">
                              {r.late_minutes}m late
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Monthly Totals per Employee */}
          <Card className="shadow-panel">
            <div className="p-4 border-b bg-muted/20">
              <p className="font-semibold text-sm">Monthly Totals by Employee</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Late days</TableHead>
                    <TableHead className="text-right">Total late</TableHead>
                    <TableHead className="text-right">
                      Deduction blocks ({settings?.late_block_minutes ?? 30} min)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...lateSummary.entries()].length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No summary totals recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...lateSummary.entries()].map(([id, v]) => {
                      const emp = employees.find((e) => e.id === id);
                      const block = settings?.late_block_minutes ?? 30;
                      return (
                        <TableRow key={id}>
                          <TableCell>{emp?.full_name ?? "—"}</TableCell>
                          <TableCell className="num text-right">{v.days}</TableCell>
                          <TableCell className="num text-right">
                            {minutesToHoursLabel(v.minutes)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {block > 0 ? Math.floor(v.minutes / block) : 0}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <Card className="shadow-panel">
            <div className="flex flex-wrap items-center justify-between border-b p-4">
              <div>
                <p className="font-semibold text-base">Monthly Payroll Attendance Data</p>
                <p className="text-xs text-muted-foreground">
                  Summary of absent days and late minutes beyond 10:45 AM used to calculate salary slip deductions.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/payslips/create">
                  <PlusCircle className="size-4 mr-1.5" /> Create Payslip
                </Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead className="text-right">Absent Days</TableHead>
                    <TableHead className="text-right">Late Minutes (&gt;10:45 AM)</TableHead>
                    <TableHead>Office Timing</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No employees found. Add employees first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => {
                      const late = lateSummary.get(emp.id);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {(emp as any).employee_id || emp.employee_code}
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {/* Count absent days for this employee in month */}
                            {monthRows.filter((r) => r.employee_id === emp.id && r.status === "Absent").length}
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {late?.minutes ?? 0} min
                          </TableCell>
                          <TableCell className="text-xs">
                            {settings?.office_timing || "10:30 AM - 6:30 PM"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link to="/payslips/create">
                                <FileText className="size-3.5 mr-1" /> Generate Payslip
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
