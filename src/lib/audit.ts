import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "CREATE_PAYSLIP"
  | "UPDATE_PAYSLIP"
  | "DELETE_PAYSLIP"
  | "CREATE_EMPLOYEE"
  | "UPDATE_EMPLOYEE"
  | "DELETE_EMPLOYEE"
  | "ATTENDANCE_CHECK_IN"
  | "ATTENDANCE_CHECK_OUT"
  | "ATTENDANCE_UPDATE"
  | "LEAVE_REQUEST_CREATE"
  | "LEAVE_REQUEST_APPROVE"
  | "LEAVE_REQUEST_REJECT"
  | "LEAVE_REQUEST_CANCEL"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_DELETE"
  | "PAYROLL_GENERATE"
  | "PAYROLL_APPROVE"
  | "SETTINGS_UPDATE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT_DATA"
  | "CLEAR_DATA"
  | "DOWNLOAD_PDF"
  | "PRINT_PAYSLIP"
  | string;

export type EntityType =
  | "payslip"
  | "employee"
  | "attendance"
  | "leave"
  | "document"
  | "payroll"
  | "settings"
  | "auth"
  | "reports"
  | "system"
  | string;

export interface AuditLogItem {
  id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  user_email: string;
  user_role: string | null;
  description: string;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface LogAuditParams {
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string | null | undefined;
  description: string;
  details?: Record<string, any> | null | undefined;
  user_email?: string | undefined;
  user_role?: string | undefined;
}

export async function logAuditEvent({
  action,
  entity_type,
  entity_id = null,
  description,
  details = null,
  user_email,
  user_role,
}: LogAuditParams): Promise<void> {
  try {
    let activeEmail = user_email;
    let activeRole = user_role;

    // Detect user from active Supabase session
    if (!activeEmail) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.email) {
          activeEmail = data.session.user.email;
          activeRole = activeRole || (activeEmail.includes("admin") ? "admin" : "employee");
        }
      } catch {}
    }

    if (!activeEmail) {
      activeEmail = "admin@blxrealty.com";
      activeRole = activeRole || "admin";
    }

    if (!activeRole) {
      activeRole = activeEmail.includes("admin") ? "admin" : "employee";
    }

    // Payload for Supabase table (omit non-uuid string id so PostgreSQL gen_random_uuid() generates valid UUID)
    const logPayload = {
      action,
      entity_type,
      entity_id: entity_id ? String(entity_id) : null,
      user_email: activeEmail,
      user_role: activeRole,
      description,
      details: details ? (JSON.parse(JSON.stringify(details)) as Record<string, any>) : null,
      ip_address: "127.0.0.1 (Local Session)",
      created_at: new Date().toISOString(),
    };

    // 1. Insert into Supabase
    const { error } = await supabase.from("audit_logs").insert(logPayload as any);

    if (error) {
      console.warn("[Audit Logger Notice]", error.message);
    }
  } catch (err) {
    console.error("[Audit Logger Error]", err);
  }
}
