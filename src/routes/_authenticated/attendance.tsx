import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useEmployees, useSettings, monthRange } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  ATTENDANCE_STATUSES,
  MONTHS,
  downloadCsv,
  formatTime,
  minutesToHoursLabel,
  type AttendanceRow,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { isManager } = useAuth();
  const { data: employees = [] } = useEmployees();
  const { data: settings } = useSettings();
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

  const upsert = useMutation({
    mutationFn: async (row: {
      employee_id: string;
      status?: string;
      check_in?: string | null;
      check_out?: string | null;
    }) => {
      const existing = byEmployee.get(row.employee_id);
      const payload = {
        employee_id: row.employee_id,
        attendance_date: date,
        status: row.status ?? existing?.status ?? "Present",
        check_in: row.check_in !== undefined ? row.check_in || null : (existing?.check_in ?? null),
        check_out:
          row.check_out !== undefined ? row.check_out || null : (existing?.check_out ?? null),
      };
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      qc.invalidateQueries({ queryKey: ["attendance-month"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllPresent = useMutation({
    mutationFn: async () => {
      const payload = employees
        .filter((e) => e.employment_status !== "Exited")
        .map((e) => ({
          employee_id: e.id,
          attendance_date: date,
          status: "Present",
          check_in: settings?.office_start ?? "10:30",
          check_out: settings?.office_end ?? "18:30",
        }));
      const { error } = await supabase
        .from("attendance")
        .upsert(payload as never, { onConflict: "employee_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      toast.success("All employees marked present");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lateSummary = useMemo(() => {
    const map = new Map<string, { minutes: number; days: number }>();
    for (const r of monthRows) {
      if (!r.late_minutes) continue;
      const prev = map.get(r.employee_id) ?? { minutes: 0, days: 0 };
      map.set(r.employee_id, { minutes: prev.minutes + r.late_minutes, days: prev.days + 1 });
    }
    return map;
  }, [monthRows]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Office timing ${formatTime(settings?.office_start)} – ${formatTime(
          settings?.office_end,
        )} · Late after ${settings?.grace_minutes ?? 15} min grace`}
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
          <TabsTrigger value="late">Late arrivals</TabsTrigger>
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
                  onChange={(e) => setDate(e.target.value)}
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
                    <TableHead className="w-36">Check in</TableHead>
                    <TableHead className="w-36">Check out</TableHead>
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
                      const row = byEmployee.get(e.id);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <p className="font-medium">{e.full_name}</p>
                            <p className="num text-xs text-muted-foreground">{e.employee_code}</p>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              disabled={!isManager}
                              value={row?.check_in?.slice(0, 5) ?? ""}
                              onChange={(ev) =>
                                upsert.mutate({ employee_id: e.id, check_in: ev.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              disabled={!isManager}
                              value={row?.check_out?.slice(0, 5) ?? ""}
                              onChange={(ev) =>
                                upsert.mutate({ employee_id: e.id, check_out: ev.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={!isManager}
                              value={row?.status ?? ""}
                              onValueChange={(v) => upsert.mutate({ employee_id: e.id, status: v })}
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
                          <TableCell className="num text-right">
                            {row ? Number(row.working_hours).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row?.late_minutes ? (
                              <Badge variant="destructive">{row.late_minutes} min</Badge>
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

        <TabsContent value="late" className="mt-4">
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
                    <TableHead className="text-right">Late days</TableHead>
                    <TableHead className="text-right">Total late</TableHead>
                    <TableHead className="text-right">
                      Deduction blocks ({settings?.late_block_minutes ?? 60} min)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...lateSummary.entries()].length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        No late arrivals recorded for this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...lateSummary.entries()].map(([id, v]) => {
                      const emp = employees.find((e) => e.id === id);
                      const block = settings?.late_block_minutes ?? 60;
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
      </Tabs>
    </div>
  );
}
