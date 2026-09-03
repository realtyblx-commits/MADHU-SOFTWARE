import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  Trash2,
  Eye,
  Activity,
  UserCheck,
  FileText,
  Settings,
  Calendar,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuditLogItem, logAuditEvent } from "@/lib/audit";
import { downloadCsv } from "@/lib/payroll";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditLogsPage,
});

const ACTION_COLORS: Record<string, string> = {
  CREATE_PAYSLIP: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  UPDATE_PAYSLIP: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  DELETE_PAYSLIP: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  CREATE_EMPLOYEE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  UPDATE_EMPLOYEE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  DELETE_EMPLOYEE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  SETTINGS_UPDATE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ATTENDANCE_CHECK_IN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  ATTENDANCE_CHECK_OUT: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  ATTENDANCE_UPDATE: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  LEAVE_REQUEST_CREATE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  LEAVE_REQUEST_APPROVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  LEAVE_REQUEST_REJECT: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  DOCUMENT_UPLOAD: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  DOCUMENT_DOWNLOAD: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  DOCUMENT_DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  PAYROLL_GENERATE: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  PAYROLL_APPROVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  LOGIN: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  LOGOUT: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  EXPORT_DATA: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  DOWNLOAD_PDF: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  CLEAR_DATA: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function formatActionLabel(action: string) {
  return action.replace(/_/g, " ");
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AuditLogsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);

  // Fetch audit logs
  const { data: logs = [], isLoading, refetch } = useQuery<AuditLogItem[]>({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const res = await supabase.from("audit_logs").select("*");
      const list = ((res.data || []) as unknown as AuditLogItem[]).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return list;
    },
  });

  // Clear mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await logAuditEvent({
        action: "CLEAR_DATA",
        entity_type: "system",
        description: "Audit logs ledger cleared by Administrator",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit_logs"] });
      toast.success("Audit logs cleared successfully.");
      setIsClearOpen(false);
    },
    onError: () => {
      toast.error("Failed to clear audit logs.");
    },
  });

  // Filtered rows
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAction !== "ALL" && log.action !== selectedAction) return false;
      if (selectedEntity !== "ALL" && log.entity_type !== selectedEntity) return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      return (
        log.description.toLowerCase().includes(q) ||
        log.user_email.toLowerCase().includes(q) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
        log.action.toLowerCase().includes(q) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q))
      );
    });
  }, [logs, search, selectedAction, selectedEntity]);

  // Summary statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((l) => l.created_at.startsWith(today));
    const uniqueUsers = new Set(logs.map((l) => l.user_email)).size;
    const criticalActions = logs.filter((l) =>
      ["DELETE_PAYSLIP", "DELETE_EMPLOYEE", "CLEAR_DATA", "SETTINGS_UPDATE"].includes(l.action)
    ).length;

    return {
      total: logs.length,
      today: todayLogs.length,
      users: uniqueUsers,
      critical: criticalActions,
    };
  }, [logs]);

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("No audit logs to export.");
      return;
    }
    const exportRows = filtered.map((l) => ({
      Timestamp: l.created_at,
      User: l.user_email,
      Role: l.user_role || "admin",
      Action: l.action,
      EntityType: l.entity_type,
      EntityID: l.entity_id || "",
      Description: l.description,
      IPAddress: l.ip_address || "",
    }));
    downloadCsv(`blx_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`, exportRows);
    toast.success("Audit logs exported to CSV.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & Security Ledger"
        description="Tamper-evident record of all payroll transactions, user activity, edits, and system modifications."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="hover-lift"
              title="Refresh ledger"
            >
              <RefreshCw className="size-4 mr-1.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="hover-lift"
            >
              <Download className="size-4 mr-1.5" /> Export CSV
            </Button>
            {logs.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsClearOpen(true)}
                className="hover-lift"
              >
                <Trash2 className="size-4 mr-1.5" /> Clear Logs
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-panel card-interactive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Logged Events
            </CardTitle>
            <ShieldCheck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded ledger transactions</p>
          </CardContent>
        </Card>

        <Card className="shadow-panel card-interactive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today's Activity
            </CardTitle>
            <Activity className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.today}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Operations logged today</p>
          </CardContent>
        </Card>

        <Card className="shadow-panel card-interactive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Operators
            </CardTitle>
            <UserCheck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{stats.users}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique user accounts</p>
          </CardContent>
        </Card>

        <Card className="shadow-panel card-interactive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sensitive Changes
            </CardTitle>
            <Layers className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {stats.critical}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Deletions & config updates</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, description, entity ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="w-48">
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="ATTENDANCE_CHECK_IN">Employee Check In</SelectItem>
                  <SelectItem value="ATTENDANCE_CHECK_OUT">Employee Check Out</SelectItem>
                  <SelectItem value="ATTENDANCE_UPDATE">Attendance Update</SelectItem>
                  <SelectItem value="LEAVE_REQUEST_CREATE">Leave Request</SelectItem>
                  <SelectItem value="LEAVE_REQUEST_APPROVE">Leave Approved</SelectItem>
                  <SelectItem value="DOCUMENT_UPLOAD">Document Upload</SelectItem>
                  <SelectItem value="DOCUMENT_DOWNLOAD">Document Download</SelectItem>
                  <SelectItem value="PAYROLL_GENERATE">Payroll Generate</SelectItem>
                  <SelectItem value="PAYROLL_APPROVE">Payroll Approve</SelectItem>
                  <SelectItem value="CREATE_PAYSLIP">Create Payslip</SelectItem>
                  <SelectItem value="UPDATE_PAYSLIP">Update Payslip</SelectItem>
                  <SelectItem value="DELETE_PAYSLIP">Delete Payslip</SelectItem>
                  <SelectItem value="CREATE_EMPLOYEE">Create Employee</SelectItem>
                  <SelectItem value="UPDATE_EMPLOYEE">Update Employee</SelectItem>
                  <SelectItem value="DELETE_EMPLOYEE">Delete Employee</SelectItem>
                  <SelectItem value="SETTINGS_UPDATE">Settings Update</SelectItem>
                  <SelectItem value="LOGIN">User Login</SelectItem>
                  <SelectItem value="LOGOUT">User Logout</SelectItem>
                  <SelectItem value="DOWNLOAD_PDF">Download PDF</SelectItem>
                  <SelectItem value="EXPORT_DATA">Export Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Entities</SelectItem>
                  <SelectItem value="payslip">Payslips</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(search || selectedAction !== "ALL" || selectedEntity !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedAction("ALL");
                  setSelectedEntity("ALL");
                }}
                className="h-9 text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="shadow-panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[160px]">Action</TableHead>
                <TableHead>User / Operator</TableHead>
                <TableHead className="min-w-[280px]">Description</TableHead>
                <TableHead className="w-[110px]">Entity</TableHead>
                <TableHead className="w-[90px] text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading security audit logs...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <ShieldCheck className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No audit log records found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {logs.length === 0
                        ? "New actions, payslip creations, and edits will appear here automatically."
                        : "No events match the selected filters."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const colorClass = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground border-border";
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div>{formatDateTime(log.created_at)}</div>
                        <div className="text-[10px] text-muted-foreground/70">{timeAgo(log.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 border ${colorClass}`}
                        >
                          {formatActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{log.user_email}</div>
                        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {log.user_role || "admin"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-normal leading-relaxed text-foreground">
                        {log.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[11px]">
                          {log.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 hover-lift"
                          title="View Payload Metadata"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="size-4" />
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

      {/* Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-primary" />
              Audit Event Payload
            </DialogTitle>
            <DialogDescription>
              Technical event metadata and recorded parameters.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground">Event ID:</span>
                  <p className="font-mono font-medium">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Timestamp:</span>
                  <p className="font-mono font-medium">{formatDateTime(selectedLog.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Operator:</span>
                  <p className="font-medium">{selectedLog.user_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client Source:</span>
                  <p className="font-mono text-muted-foreground">{selectedLog.ip_address || "Local Session"}</p>
                </div>
              </div>

              <div>
                <span className="font-medium text-foreground block mb-1">Description:</span>
                <p className="bg-card border p-2.5 rounded text-muted-foreground">{selectedLog.description}</p>
              </div>

              <div>
                <span className="font-medium text-foreground block mb-1">Payload JSON:</span>
                <pre className="bg-muted p-3 rounded-lg border font-mono text-[11px] overflow-x-auto max-h-60 text-foreground">
                  {JSON.stringify(selectedLog.details || { note: "No additional metadata recorded" }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation */}
      <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Clear Audit Logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all historical audit event records from the local ledger. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
            >
              Clear All Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
