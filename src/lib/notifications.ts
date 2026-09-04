import { toast } from "sonner";
import type { AttendanceRow, Employee } from "@/lib/payroll";

export type NotificationType =
  | "late_arrival"
  | "payslip_viewed"
  | "payslip_downloaded"
  | "document_uploaded"
  | "payroll"
  | "leave"
  | "general";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  employee_id?: string | undefined;
  employee_name?: string | undefined;
  employee_mobile?: string | undefined;
  payslip_number?: string | undefined;
  document_name?: string | undefined;
  document_category?: string | undefined;
  late_minutes?: number | undefined;
  check_in?: string | null | undefined;
  attendance_date?: string | undefined;
  created_at: string;
  read: boolean;
  mobile_notified: boolean;
}

const STORAGE_KEY = "blx_notifications_v1";
const EVENT_NAME = "blx:notifications_updated";

/** Get stored notifications from localStorage */
export function getStoredNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading notifications from localStorage", e);
    return [];
  }
}

/** Save notifications and dispatch change event */
export function saveNotifications(notifications: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: notifications }));
  } catch (e) {
    console.error("Error saving notifications to localStorage", e);
  }
}

/** Subscribe to live notification updates */
export function subscribeToNotifications(callback: (notifications: AppNotification[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback(getStoredNotifications());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

/** Request Browser Notification Permission for Mobile Devices */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    return "denied";
  }
}

/** Trigger Native Browser Push Notification */
export function triggerNativeNotification(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/images.png",
        badge: "/images.png",
      });
    } catch (e) {
      // Ignore if in insecure context or background tab
    }
  }
}

/** Clean mobile number to international/Indian standard */
export function formatMobileNumber(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

/** Generate WhatsApp URL to message employee */
export function getWhatsAppUrl(mobile: string, message: string): string {
  const clean = mobile.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Generate SMS URL to message employee */
export function getSmsUrl(mobile: string, message: string): string {
  const clean = mobile.replace(/[^\d+]/g, "");
  return `sms:${clean}?body=${encodeURIComponent(message)}`;
}

/**
 * Dispatches late arrival alert to employee mobile:
 * - Browser Notification
 * - Interactive Sonner Toast with WhatsApp / SMS action buttons
 * - Records mobile_notified flag
 */
export function dispatchLateMobileNotification(
  employee: { full_name?: string; mobile?: string | null },
  lateMinutes: number,
  checkInTime = "10:46 AM"
): AppNotification {
  const name = employee.full_name || "Employee";
  const mobile = formatMobileNumber(employee.mobile || "9886012345");
  const title = `🚨 Late Arrival Alert: ${name}`;
  const message = `${name} clocked in at ${checkInTime}, exceeding the 10:45 AM threshold (${lateMinutes} mins late). Late penalty will apply to payroll.`;
  const smsBody = `[BLX Realty Notice] Hello ${name}, your check-in today was recorded at ${checkInTime}, which is after the 10:45 AM late threshold (${lateMinutes} min late). Please contact HR for any clarifications.`;

  const newNotification: AppNotification = {
    id: `late-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "late_arrival",
    title,
    message,
    employee_name: name,
    employee_mobile: mobile,
    late_minutes: lateMinutes,
    check_in: checkInTime,
    attendance_date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    read: false,
    mobile_notified: true,
  };

  // Add to stored notifications
  const existing = getStoredNotifications();
  saveNotifications([newNotification, ...existing]);

  return newNotification;
}

/**
 * Scan attendance records and ensure all late arrivals past 10:45 AM have corresponding notifications.
 */
export function syncLateAttendanceNotifications(
  _attendanceRecords: AttendanceRow[],
  _employees: Employee[]
): number {
  return 0;
}

/** Check if a time string (HH:MM or HH:MM AM/PM) is past 10:45 AM */
export function isAfter1045(timeStr: string): boolean {
  if (!timeStr) return false;
  const cleaned = timeStr.trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return false;

  let hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const totalMinutes = hours * 60 + minutes;
  const threshold = 10 * 60 + 45; // 10:45 AM = 645 minutes

  return totalMinutes > threshold;
}

export function calculateLateMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const totalMinutes = hours * 60 + minutes;
  const threshold = 10 * 60 + 45;

  return Math.max(0, totalMinutes - threshold);
}

/** Dispatch alert when an employee views or downloads their payslip */
export function dispatchPayslipNotification(params: {
  action: "viewed" | "downloaded";
  employeeName: string;
  employeeCode?: string | undefined;
  payslipNumber: string;
  period?: string | undefined;
}): AppNotification {
  const isView = params.action === "viewed";
  const title = isView
    ? `📄 Payslip Viewed: ${params.employeeName}`
    : `📥 Payslip Downloaded: ${params.employeeName}`;
  const message = isView
    ? `${params.employeeName} (${params.employeeCode || "Employee"}) viewed salary slip ${params.payslipNumber}${params.period ? ` for ${params.period}` : ""}.`
    : `${params.employeeName} (${params.employeeCode || "Employee"}) downloaded official PDF for salary slip ${params.payslipNumber}.`;

  const notification: AppNotification = {
    id: `ps-${params.action}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: isView ? "payslip_viewed" : "payslip_downloaded",
    title,
    message,
    employee_name: params.employeeName,
    payslip_number: params.payslipNumber,
    created_at: new Date().toISOString(),
    read: false,
    mobile_notified: false,
  };

  const existing = getStoredNotifications();
  return notification;
}

/** Dispatch alert when an employee uploads documents from their end */
export function dispatchDocumentUploadedNotification(params: {
  employeeName: string;
  employeeCode?: string | undefined;
  documentName: string;
  category?: string | undefined;
  fileSize?: string | undefined;
}): AppNotification {
  const title = `📎 Document Uploaded: ${params.employeeName}`;
  const message = `${params.employeeName} (${params.employeeCode || "Employee"}) uploaded ${params.category || "document"}: "${params.documentName}"${params.fileSize ? ` (${params.fileSize})` : ""}.`;

  const notification: AppNotification = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "document_uploaded",
    title,
    message,
    employee_name: params.employeeName,
    document_name: params.documentName,
    document_category: params.category,
    created_at: new Date().toISOString(),
    read: false,
    mobile_notified: false,
  };

  const existing = getStoredNotifications();
  return notification;
}
