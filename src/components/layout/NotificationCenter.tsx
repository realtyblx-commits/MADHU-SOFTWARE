import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Check,
  CheckCheck,
  Smartphone,
  MessageCircle,
  Trash2,
  Send,
  Zap,
  Eye,
  Download,
  FileText,
  Upload,
  FileCheck,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AppNotification,
  getStoredNotifications,
  saveNotifications,
  subscribeToNotifications,
  dispatchLateMobileNotification,
  dispatchPayslipNotification,
  dispatchDocumentUploadedNotification,
  requestBrowserNotificationPermission,
  getWhatsAppUrl,
  getSmsUrl,
  triggerNativeNotification,
} from "@/lib/notifications";
import { useEmployees } from "@/lib/queries";
import { toast } from "sonner";

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

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "late" | "payslips" | "docs">("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { data: employees = [] } = useEmployees();

  // Load and subscribe to live notification updates
  useEffect(() => {
    setNotifications(getStoredNotifications());
    return subscribeToNotifications((updated) => setNotifications(updated));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const lateAlerts = notifications.filter((n) => n.type === "late_arrival");
  const payslipAlerts = notifications.filter(
    (n) => n.type === "payslip_viewed" || n.type === "payslip_downloaded"
  );
  const docAlerts = notifications.filter((n) => n.type === "document_uploaded");

  const filteredList =
    tab === "late"
      ? lateAlerts
      : tab === "payslips"
      ? payslipAlerts
      : tab === "docs"
      ? docAlerts
      : notifications;

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    toast.success("All notifications marked as read");
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  const clearAll = () => {
    saveNotifications([]);
    toast.info("Notifications cleared");
  };

  // Quick simulation function to test late arrival notifications
  const handleSimulateLateArrival = () => {
    const emp = employees[0] || {
      full_name: "Devesh Vats",
      mobile: "+919886000000",
    };
    dispatchLateMobileNotification(emp, 35, "11:20 AM");
  };

  const handleSimulatePayslipAlert = () => {
    const emp = employees[0] || {
      full_name: "Devesh Vats",
      employee_code: "BLX26-001",
    };
    dispatchPayslipNotification({
      action: "downloaded",
      employeeName: emp.full_name,
      employeeCode: emp.employee_code,
      payslipNumber: "BLX-202602-001",
      period: "February 2026",
    });
  };

  const handleSimulateDocUploadAlert = () => {
    const emp = employees[1] || employees[0] || {
      full_name: "Vishal M Raju",
      employee_code: "BLX26-002",
    };
    dispatchDocumentUploadedNotification({
      employeeName: emp.full_name,
      employeeCode: emp.employee_code,
      documentName: "Aadhaar_Card_Front_Back.pdf",
      category: "Aadhaar Card",
      fileSize: "1.2 MB",
    });
  };

  const handleSendPush = (n: AppNotification) => {
    triggerNativeNotification(n.title, n.message);
    toast.success(`Mobile push re-sent to ${n.employee_name || "employee"}`);
  };

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    if (res === "granted") {
      toast.success("Browser push notifications enabled on your device!");
    } else {
      toast.error("Notification permission not granted");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-xl hover:bg-muted/60 transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Notifications (${unreadCount} unread)`}
          title="Notifications & Mobile Alerts"
        >
          <Bell className="size-4 text-foreground/80" />
          {unreadCount > 0 ? (
            <>
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
              <span className="absolute top-1 right-1 size-2 rounded-full bg-blue-500 ring-2 ring-background animate-ping" />
            </>
          ) : (
            <span className="sr-only">No unread notifications</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-1.5rem)] sm:w-[420px] max-w-sm p-0 shadow-2xl rounded-2xl border-border bg-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600/15 text-blue-500">
              <Bell className="size-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Notifications &amp; Super Admin Alerts</h3>
              <p className="text-[10px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}`
                  : "All notifications read"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-[11px] text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 px-2"
            >
              <CheckCheck className="size-3 mr-1" /> Mark read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="border-b px-2 py-2 bg-muted/10">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 h-7 w-full p-0.5 bg-muted/40">
              <TabsTrigger value="all" className="text-[10px] py-0.5 h-6">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="late" className="text-[10px] py-0.5 h-6">
                Late ({lateAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="payslips" className="text-[10px] py-0.5 h-6">
                Payslips ({payslipAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="docs" className="text-[10px] py-0.5 h-6">
                Docs ({docAlerts.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notifications Scrollable List */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-border/50">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-2.5">
                <Check className="size-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">No alerts in this view</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[240px]">
                {tab === "late"
                  ? "No late arrivals past 10:45 AM recorded."
                  : tab === "payslips"
                  ? "No employee payslip view or download activity yet."
                  : tab === "docs"
                  ? "No employee document uploads recorded."
                  : "You're all caught up with payroll, attendance, payslip and KYC alerts."}
              </p>
            </div>
          ) : (
            filteredList.map((n) => {
              const isLate = n.type === "late_arrival";
              const isPayslipView = n.type === "payslip_viewed";
              const isPayslipDownload = n.type === "payslip_downloaded";
              const isDocUpload = n.type === "document_uploaded";

              const smsBody = `[BLX Realty Notice] Hello ${n.employee_name || "Employee"}, your check-in was at ${n.check_in || "after 10:45 AM"}. Late penalty applies as per company policy.`;
              const waUrl = n.employee_mobile ? getWhatsAppUrl(n.employee_mobile, smsBody) : "";
              const smsUrl = n.employee_mobile ? getSmsUrl(n.employee_mobile, smsBody) : "";

              return (
                <div
                  key={n.id}
                  className={`p-3.5 transition-colors ${
                    n.read ? "bg-card hover:bg-muted/30" : "bg-blue-500/5 hover:bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Left Icon Badge */}
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                          isLate
                            ? "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                            : isPayslipDownload
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
                            : isPayslipView
                            ? "bg-sky-500/15 text-sky-500 border border-sky-500/20"
                            : isDocUpload
                            ? "bg-violet-500/15 text-violet-500 border border-violet-500/20"
                            : "bg-blue-600/15 text-blue-500 border border-blue-500/20"
                        }`}
                      >
                        {isLate ? (
                          <Clock className="size-3.5" />
                        ) : isPayslipDownload ? (
                          <Download className="size-3.5" />
                        ) : isPayslipView ? (
                          <Eye className="size-3.5" />
                        ) : isDocUpload ? (
                          <Upload className="size-3.5" />
                        ) : (
                          <Bell className="size-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground leading-tight">
                            {n.title}
                          </h4>
                          {!n.read && (
                            <span className="size-1.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          {n.message}
                        </p>

                        {/* Late Arrival Badge & Controls */}
                        {isLate && (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                              <Badge
                                variant="destructive"
                                className="h-5 px-1.5 text-[9px] font-semibold tracking-wide bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              >
                                &gt; 10:45 AM LATE
                              </Badge>
                              {n.employee_mobile && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                                  <Smartphone className="size-2.5 text-blue-500" />
                                  {n.employee_mobile}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {timeAgo(n.created_at)}
                              </span>
                            </div>

                            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-[10px] font-semibold transition-colors border border-emerald-500/20"
                                >
                                  <MessageCircle className="size-3" /> WhatsApp
                                </a>
                              )}
                              {smsUrl && (
                                <a
                                  href={smsUrl}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 px-2 py-1 text-[10px] font-semibold transition-colors border border-blue-500/20"
                                >
                                  <Send className="size-2.5" /> SMS Alert
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSendPush(n)}
                                className="inline-flex items-center gap-1 rounded-md bg-muted hover:bg-muted/80 text-foreground px-2 py-1 text-[10px] font-medium transition-colors"
                                title="Re-send mobile push notification"
                              >
                                <Zap className="size-2.5 text-amber-500" /> Re-notify
                              </button>
                            </div>
                          </>
                        )}

                        {/* Payslip Viewed Badge */}
                        {isPayslipView && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[9px] font-semibold bg-sky-500/10 text-sky-500 border-sky-500/30"
                            >
                              SLIP VIEWED
                            </Badge>
                            {n.payslip_number && (
                              <span className="font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                #{n.payslip_number}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Payslip Downloaded Badge */}
                        {isPayslipDownload && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            >
                              PDF DOWNLOADED
                            </Badge>
                            {n.payslip_number && (
                              <span className="font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                #{n.payslip_number}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Document Uploaded Badge */}
                        {isDocUpload && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[9px] font-semibold bg-violet-500/10 text-violet-500 border-violet-500/30"
                            >
                              DOC UPLOADED
                            </Badge>
                            {n.document_category && (
                              <span className="text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                {n.document_category}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsRead(n.id)}
                        className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                        title="Mark as read"
                      >
                        <Check className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t p-2.5 bg-muted/20 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Super Admin Test Simulators:
            </span>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAll}
                className="size-6 text-muted-foreground hover:text-destructive"
                title="Clear all notifications"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateLateArrival}
              className="h-6 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/30 px-2"
              title="Simulate an employee late arrival past 10:45 AM"
            >
              <Clock className="size-2.5 mr-1" /> Late 10:45
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulatePayslipAlert}
              className="h-6 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30 px-2"
              title="Simulate an employee payslip download"
            >
              <Download className="size-2.5 mr-1" /> Payslip Alert
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateDocUploadAlert}
              className="h-6 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 border-violet-500/30 px-2"
              title="Simulate an employee document upload"
            >
              <Upload className="size-2.5 mr-1" /> Doc Upload
            </Button>
            {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRequestPermission}
                className="h-6 text-[10px] text-blue-500 hover:bg-blue-500/10 ml-auto px-1.5"
                title="Enable browser mobile push notifications"
              >
                Enable Push
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
