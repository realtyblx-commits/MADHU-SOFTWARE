import { supabase } from "@/integrations/supabase/client";

export interface FullBackupPayload {
  version: string;
  exported_at: string;
  company_settings: any[];
  employees: any[];
  attendance: any[];
  payroll: any[];
  payroll_adjustments: any[];
  payslips: any[];
  leave_requests: any[];
  holidays: any[];
  audit_logs: any[];
}

/**
 * Fetch all application tables from Supabase (or fallback) and assemble a comprehensive JSON backup.
 */
export async function generateFullDatabaseBackup(): Promise<FullBackupPayload> {
  const [
    settingsRes,
    employeesRes,
    attendanceRes,
    payrollRes,
    adjustmentsRes,
    payslipsRes,
    leavesRes,
    holidaysRes,
    logsRes,
  ] = await Promise.all([
    supabase.from("company_settings").select("*"),
    supabase.from("employees").select("*"),
    supabase.from("attendance").select("*"),
    supabase.from("payroll").select("*"),
    supabase.from("payroll_adjustments").select("*"),
    supabase.from("payslips").select("*"),
    supabase.from("leave_requests").select("*"),
    supabase.from("holidays").select("*"),
    supabase.from("audit_logs").select("*"),
  ]);

  return {
    version: "blx-payroll-prod-v1",
    exported_at: new Date().toISOString(),
    company_settings: settingsRes.data || [],
    employees: employeesRes.data || [],
    attendance: attendanceRes.data || [],
    payroll: payrollRes.data || [],
    payroll_adjustments: adjustmentsRes.data || [],
    payslips: payslipsRes.data || [],
    leave_requests: leavesRes.data || [],
    holidays: holidaysRes.data || [],
    audit_logs: logsRes.data || [],
  };
}

/**
 * Trigger client-side download of a JSON or CSV blob.
 */
export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert array of records into a standard CSV string.
 */
export function convertToCSV(records: Record<string, any>[]): string {
  const first = records?.[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const rows = records.map((row) =>
    headers
      .map((header) => {
        let val = row[header];
        if (val === null || val === undefined) return '""';
        if (typeof val === "object") val = JSON.stringify(val);
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\r\n");
}
