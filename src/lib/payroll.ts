export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const ATTENDANCE_STATUSES = [
  "Present",
  "Late",
  "Absent",
  "Half Day",
  "Paid Leave",
  "Unpaid Leave",
  "Holiday",
  "Week Off",
  "Work From Home",
] as const;

export const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Paid Leave",
  "Leave Without Pay",
] as const;

export const PAYMENT_MODES = ["Bank Transfer", "Cash", "Cheque", "UPI"] as const;

export const EMPLOYMENT_STATUSES = ["Active", "Probation", "Notice Period", "Exited"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  website: string;
  office_start: string;
  office_end: string;
  office_timing?: string;
  late_threshold?: string;
  grace_minutes: number;
  late_block_minutes: number;
  late_block_amount: number;
  salary_day_basis: string;
  fixed_days_per_month: number;
  default_payment_mode: string;
  default_currency?: string;
  payslip_prefix?: string;
  employee_id_prefix?: string;
  payslip_footer: string;
  authorized_signatory: string;
  authorized_signature?: string | null;
}

export interface PayslipRecord {
  id: string;
  payslip_number: string;
  employee_id: string;
  employee_name: string;
  salary_period_start: string;
  salary_period_end: string;
  salary_period_label?: string;
  payment_mode: string;
  absent_days: number;
  late_minutes: number;
  office_timing: string;
  gross_salary: number;
  absent_deduction: number;
  late_deduction: number;
  total_deduction: number;
  net_salary: number;
  payment_status: string;
  employee_signature?: string | null;
  authorized_signature?: string | null;
  authorized_signatory_label?: string;
  company_name?: string;
  company_website?: string;
  company_logo?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  category: "aadhaar" | "pan" | "bank_passbook" | "photo" | "offer_letter" | "other";
  /** Durable Supabase Storage pointer (`bucket::path`) — never base64 */
  file_url: string;
  storage_bucket?: string;
  storage_path?: string;
  file_name: string;
  file_size?: string;
  uploaded_by: "admin" | "employee";
  uploaded_at: string;
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  joining_date: string | null;
  employment_status: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  pan: string | null;
  aadhaar: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  payment_mode: string;
  gross_salary: number;
  aadhaar_card_doc?: string | null;
  pan_card_doc?: string | null;
  bank_passbook_doc?: string | null;
  photo_doc?: string | null;
  documents?: EmployeeDocument[];
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  working_hours: number;
  status: string;
  late_minutes: number;
  remarks: string | null;
}

export interface PayrollRow {
  id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  payslip_number: string;
  gross_salary: number;
  total_days: number;
  payable_days: number;
  present_days: number;
  absent_days: number;
  late_minutes: number;
  per_day_salary: number;
  absent_deduction: number;
  late_deduction: number;
  additional_earnings: number;
  additional_deductions: number;
  total_deduction: number;
  net_salary: number;
  payment_mode: string;
  payment_status: string;
  status: string;
  locked: boolean;
  notes: string | null;
  employees?: Employee | null;
}

export interface Adjustment {
  id: string;
  payroll_id: string;
  kind: string;
  label: string;
  amount: number;
}

export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const inr2 = (value: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );

export const monthLabel = (month: number, year: number) => `${MONTHS[month - 1]} ${year}`;

export const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

export const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
};

export const minutesToHoursLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

/** Statuses that cost the employee a paid day. Half day costs 0.5. */
export const absentWeight = (status: string): number => {
  if (status === "Absent" || status === "Unpaid Leave") return 1;
  if (status === "Half Day") return 0.5;
  return 0;
};

export const presentWeight = (status: string): number => {
  if (status === "Present" || status === "Work From Home" || status === "Paid Leave") return 1;
  if (status === "Half Day") return 0.5;
  return 0;
};

export interface PayrollComputation {
  totalDays: number;
  perDaySalary: number;
  presentDays: number;
  absentDays: number;
  lateMinutes: number;
  absentDeduction: number;
  lateDeduction: number;
  payableDays: number;
}

export function computePayroll(
  gross: number,
  records: Pick<AttendanceRow, "status" | "late_minutes">[],
  settings: CompanySettings,
  month: number,
  year: number,
): PayrollComputation {
  const calendarDays = daysInMonth(month, year);
  const totalDays =
    settings.salary_day_basis === "fixed_days"
      ? settings.fixed_days_per_month
      : calendarDays;

  const perDaySalary = totalDays > 0 ? gross / totalDays : 0;

  let absentDays = 0;
  let presentDays = 0;
  let lateMinutes = 0;
  for (const r of records) {
    absentDays += absentWeight(r.status);
    presentDays += presentWeight(r.status);
    lateMinutes += r.late_minutes ?? 0;
  }

  const absentDeduction = round2(absentDays * perDaySalary);
  const blocks =
    settings.late_block_minutes > 0
      ? Math.floor(lateMinutes / settings.late_block_minutes)
      : 0;
  const lateDeduction = round2(blocks * Number(settings.late_block_amount));

  return {
    totalDays,
    perDaySalary: round2(perDaySalary),
    presentDays,
    absentDays,
    lateMinutes,
    absentDeduction,
    lateDeduction,
    payableDays: Math.max(0, totalDays - absentDays),
  };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const payslipNumber = (code: string, month: number, year: number) =>
  `BLX/${year}${String(month).padStart(2, "0")}/${code}`;

export function formatSalaryMonthYear(start?: string, end?: string, label?: string): string {
  if (label && /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(label)) {
    return label;
  }
  if (start) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { month: "long", year: "numeric" });
    }
  }
  if (end) {
    const d = new Date(end);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { month: "long", year: "numeric" });
    }
  }
  return label || "—";
}

export function mapPayrollToPayslip(r: any): PayslipRecord {
  const emp = r.employees;
  return {
    id: r.id,
    payslip_number: r.payslip_number || `PS-${r.period_year}-${String(r.period_month).padStart(2, "0")}`,
    employee_id: emp?.employee_code || "BLX26-001",
    employee_name: emp?.full_name || "Employee",
    salary_period_start: `${r.period_year}-${String(r.period_month).padStart(2, "0")}-01`,
    salary_period_end: `${r.period_year}-${String(r.period_month).padStart(2, "0")}-${String(r.total_days || 30).padStart(2, "0")}`,
    salary_period_label: `${r.period_month}/${r.period_year}`,
    payment_mode: r.payment_mode || "Bank Transfer",
    absent_days: r.absent_days || 0,
    late_minutes: r.late_minutes || 0,
    office_timing: "10:30 AM - 6:30 PM",
    gross_salary: Number(r.gross_salary) || 0,
    absent_deduction: Number(r.absent_deduction) || 0,
    late_deduction: Number(r.late_deduction) || 0,
    total_deduction: Number(r.total_deduction) || 0,
    net_salary: Number(r.net_salary) || 0,
    payment_status: "Processed through Bank Transfer",
    employee_signature: null,
    authorized_signature: null,
    authorized_signatory_label: "Authorized Signatory (BLX Realty Pvt Ltd)",
    company_name: "BLX REALTY PRIVATE LIMITED",
    company_website: "www.theblxrealty.com",
    company_logo: "/apple-touch-icon.png",
    status: r.status || "Generated",
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Very small CSV parser good enough for imports (handles quoted fields). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      cur.push(field);
      field = "";
    } else if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  return body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h.trim()] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

export function calculateDeductions(
  grossSalary: number,
  absentDays: number,
  lateMinutes: number,
  workingDaysInMonth = 30,
  workMinutesPerDay = 480 // 8 hours * 60 min
) {
  const perDaySalary = workingDaysInMonth > 0 ? grossSalary / workingDaysInMonth : 0;
  const perMinuteSalary = workMinutesPerDay > 0 ? perDaySalary / workMinutesPerDay : 0;

  const absentDeduction = Number((absentDays * perDaySalary).toFixed(2));
  const lateDeduction = Number((lateMinutes * perMinuteSalary).toFixed(2));
  const totalDeduction = Number((absentDeduction + lateDeduction).toFixed(2));
  const netSalary = Number(Math.max(0, grossSalary - totalDeduction).toFixed(2));

  return {
    perDaySalary,
    absentDeduction,
    lateDeduction,
    totalDeduction,
    netSalary,
  };
}

export function formatIndianCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
