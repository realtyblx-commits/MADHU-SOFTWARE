import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useEmployees } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { LEAVE_TYPES } from "@/lib/payroll";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authenticated/leave")({
  component: LeavePage,
});

interface LeaveRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
}

function LeavePage() {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const { data: employees = [] } = useEmployees();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "Casual Leave" as string,
    start_date: "",
    end_date: "",
    reason: "",
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeaveRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.employee_id || !form.start_date || !form.end_date)
        throw new Error("Employee and dates are required");
      const days =
        Math.round(
          (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000,
        ) + 1;
      if (days <= 0) throw new Error("End date must be after start date");
      const { error } = await supabase.from("leave_requests").insert({
        ...form,
        total_days: days,
      } as never);
      if (error) throw error;

      const emp = employees.find((e) => e.id === form.employee_id);
      await logAuditEvent({
        action: "LEAVE_REQUEST_CREATE",
        entity_type: "leave",
        entity_id: emp?.employee_code || form.employee_id,
        description: `Leave requested by ${emp?.full_name || "Employee"} (${form.leave_type}, ${form.start_date} to ${form.end_date} - ${days} day${days > 1 ? "s" : ""})`,
        details: {
          employee_code: emp?.employee_code,
          employee_name: emp?.full_name,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          total_days: days,
          reason: form.reason,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setOpen(false);
      toast.success("Leave request submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
      if (error) throw error;

      const leave = leaves.find((l) => l.id === id);
      const emp = employees.find((e) => e.id === leave?.employee_id);
      await logAuditEvent({
        action: status === "Approved" ? "LEAVE_REQUEST_APPROVE" : "LEAVE_REQUEST_REJECT",
        entity_type: "leave",
        entity_id: emp?.employee_code || id,
        description: `Manager ${status.toLowerCase()} leave for ${emp?.full_name || "Employee"} (${leave?.leave_type || "Leave"}, ${leave?.start_date} to ${leave?.end_date})`,
        details: {
          leave_id: id,
          status,
          employee_name: emp?.full_name,
          employee_code: emp?.employee_code,
          leave_type: leave?.leave_type,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Leave management"
        description="Track casual, sick, paid and unpaid leave. Approved unpaid leave affects payroll."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New request
          </Button>
        }
      />

      <Card className="overflow-x-auto shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No leave requests yet.
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {employees.find((e) => e.id === l.employee_id)?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{l.leave_type}</TableCell>
                  <TableCell className="num">{l.start_date}</TableCell>
                  <TableCell className="num">{l.end_date}</TableCell>
                  <TableCell className="num text-right">{l.total_days}</TableCell>
                  <TableCell className="max-w-56 truncate">{l.reason ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        l.status === "Approved"
                          ? "default"
                          : l.status === "Rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isManager && l.status === "Pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => decide.mutate({ id: l.id, status: "Approved" })}
                        >
                          <Check className="size-4 text-primary" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => decide.mutate({ id: l.id, status: "Rejected" })}
                        >
                          <X className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New leave request</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select
                value={form.leave_type}
                onValueChange={(v) => setForm((f) => ({ ...f, leave_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">From</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">To</Label>
                <Input
                  id="end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
