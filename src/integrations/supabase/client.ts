import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { jsonStore } from "@/lib/json-store";

// Environment variables for client-side Supabase connection
const supabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || "https://quqlutfkkydruoflbuil.supabase.co";
const supabaseAnonKey =
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cWx1dGZra3lkcnVvZmxidWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTk5OTYsImV4cCI6MjEwMzk3NTk5Nn0.KLZ8kF87UOq9kBw7q84CiIssbkODlD-J_qlMVj-PyO8";

/**
 * Real Supabase Client connecting directly to Supabase Postgres, Storage & Auth
 */
export const realSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

interface QueryFilter {
  type: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in";
  column: string;
  value: any;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

function resolveRelationship(tableName: string, row: any, selectCols: string): any {
  const result = { ...row };
  if (selectCols.includes("employees")) {
    const allEmployees = jsonStore.getTable("employees");
    const employee = allEmployees.find((e) => e.id === row.employee_id) || null;
    result.employees = employee;
  }
  if (selectCols.includes("payroll_adjustments")) {
    const allAdjustments = jsonStore.getTable("payroll_adjustments");
    result.payroll_adjustments = allAdjustments.filter((a) => a.payroll_id === row.id);
  }
  return result;
}

let hasShownPauseToast = false;
export function handleSupabasePauseNotice(err: any) {
  if (!err) return;
  const msg = (err?.message || err?.error_description || "").toLowerCase();
  const status = err?.status;
  const isPaused =
    status === 503 ||
    err?.code === "project_paused" ||
    msg.includes("paused") ||
    msg.includes("inactive project") ||
    msg.includes("waking up");

  if (isPaused && !hasShownPauseToast) {
    hasShownPauseToast = true;
    setTimeout(() => {
      hasShownPauseToast = false;
    }, 45000); // Debounce 45 seconds to avoid repeated notifications
    if (typeof window !== "undefined") {
      import("sonner").then(({ toast }) => {
        toast.warning(
          "Payroll services are temporarily unavailable. Please try again shortly.",
          {
            id: "supabase-pause-notice",
            duration: 7000,
          }
        );
      });
    }
  }
}

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function adaptPayslipForDb(row: any): any {
  if (!row) return row;
  const allEmployees = jsonStore.getTable("employees");
  const emp = allEmployees.find(
    (e) =>
      e.id === row.employee_id ||
      e.employee_code === row.employee_id ||
      (e as any).employee_id === row.employee_id ||
      (row.employee_name && e.full_name?.toLowerCase() === row.employee_name?.toLowerCase())
  );

  const KNOWN_CODES: Record<string, string> = {
    "BLX26-001": "582fba84-69f4-4ec8-8b7b-4726a18b29f3",
    "BLX26-002": "27e6f551-c0ab-4102-8577-a5b1da5993d3",
    "BLX26-003": "2774e557-9551-410a-a7b9-34a00b96ed04",
    "BLX26-004": "264c2f32-1bcb-4402-ad67-fcdbfc825949",
    "BLX26-005": "f29712ab-bd00-4a3c-8a41-42a5e682d3fb",
    "BLX26-006": "c30f8456-2c60-4441-a029-670a84a9cdab",
  };

  const empIdUuid = isUuid(row.employee_id)
    ? row.employee_id
    : (KNOWN_CODES[row.employee_id] || (emp?.id && isUuid(emp.id) ? emp.id : (allEmployees[0]?.id || "582fba84-69f4-4ec8-8b7b-4726a18b29f3")));

  const empCode = row.employee_id_snapshot || emp?.employee_code || row.employee_id || "BLX26-001";
  const empName = row.employee_name_snapshot || row.employee_name || emp?.full_name || "Employee";

  const dbRow: any = {
    employee_id: empIdUuid,
    payslip_number: row.payslip_number,
    salary_period_start: row.salary_period_start,
    salary_period_end: row.salary_period_end,
    salary_period_label: row.salary_period_label || null,
    employee_name_snapshot: empName,
    employee_id_snapshot: empCode,
    designation_snapshot: row.designation_snapshot || emp?.designation || null,
    department_snapshot: row.department_snapshot || emp?.department || null,
    payment_mode_snapshot: row.payment_mode_snapshot || row.payment_mode || "Bank Transfer",
    office_timing_snapshot: row.office_timing_snapshot || row.office_timing || null,
    absent_days_snapshot: Number(row.absent_days_snapshot ?? row.absent_days ?? 0),
    late_minutes_snapshot: Number(row.late_minutes_snapshot ?? row.late_minutes ?? 0),
    gross_salary: Number(row.gross_salary ?? 0),
    absent_deduction: Number(row.absent_deduction ?? 0),
    late_deduction: Number(row.late_deduction ?? 0),
    total_deduction: Number(row.total_deduction ?? 0),
    net_salary: Number(row.net_salary ?? 0),
    payment_status: row.payment_status || "Paid",
    status: row.status || "Published",
  };

  if (isUuid(row.id)) {
    dbRow.id = row.id;
  }
  if (row.pdf_storage_path !== undefined) dbRow.pdf_storage_path = row.pdf_storage_path;
  if (row.pdf_file_size !== undefined) dbRow.pdf_file_size = row.pdf_file_size;
  if (row.pdf_generated_at !== undefined) dbRow.pdf_generated_at = row.pdf_generated_at;
  if (row.created_at) dbRow.created_at = row.created_at;
  if (row.updated_at) dbRow.updated_at = row.updated_at;

  return dbRow;
}

function adaptPayslipFromDb(row: any): any {
  if (!row) return row;
  return {
    ...row,
    employee_id: row.employee_id_snapshot || row.employee_id,
    employee_name: row.employee_name_snapshot || row.employee_name || "Employee",
    absent_days: Number(row.absent_days ?? row.absent_days_snapshot ?? 0),
    late_minutes: Number(row.late_minutes ?? row.late_minutes_snapshot ?? 0),
    payment_mode: row.payment_mode ?? row.payment_mode_snapshot ?? "Bank Transfer",
    office_timing: row.office_timing ?? row.office_timing_snapshot ?? "10:30 AM - 6:30 PM",
    company_name: row.company_name || "BLX REALTY PRIVATE LIMITED",
    company_website: row.company_website || "www.theblxrealty.com",
    company_logo: row.company_logo || "/apple-touch-icon.png",
    authorized_signatory_label:
      row.authorized_signatory_label || "Authorized Signatory (BLX Realty Pvt Ltd)",
  };
}

class JsonQueryBuilder {
  private tableName: string;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectColumns = "*";
  private payload: any = null;
  private upsertOptions?: { onConflict?: string } | undefined;
  private filters: QueryFilter[] = [];
  private orders: OrderSpec[] = [];
  private limitCount?: number | undefined;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns = "*") {
    this.action = "select";
    this.selectColumns = columns;
    return this;
  }

  insert(values: any | any[]) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.action = "update";
    this.payload = values;
    return this;
  }

  upsert(values: any | any[], options?: { onConflict?: string }) {
    this.action = "upsert";
    this.payload = values;
    this.upsertOptions = options;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: "in", column, value: values });
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private applyFilters(items: any[]): any[] {
    return items.filter((item) => {
      return this.filters.every((f) => {
        const val = item[f.column];
        switch (f.type) {
          case "eq":
            return val === f.value;
          case "neq":
            return val !== f.value;
          case "gte":
            return val >= f.value;
          case "lte":
            return val <= f.value;
          case "gt":
            return val > f.value;
          case "lt":
            return val < f.value;
          case "in":
            return Array.isArray(f.value) && f.value.includes(val);
          default:
            return true;
        }
      });
    });
  }

  private applyOrders(items: any[]): any[] {
    if (this.orders.length === 0) return items;
    return [...items].sort((a, b) => {
      for (const order of this.orders) {
        const valA = a[order.column];
        const valB = b[order.column];
        if (valA < valB) return order.ascending ? -1 : 1;
        if (valA > valB) return order.ascending ? 1 : -1;
      }
      return 0;
    });
  }

  async execute(): Promise<{ data: any; error: any }> {
    // 1. First attempt query on real Supabase PostgREST
    try {
      let query: any = (realSupabase as any).from(this.tableName);

      let payloadToUse = this.payload;
      if (this.tableName === "payslips" && this.payload) {
        payloadToUse = Array.isArray(this.payload)
          ? this.payload.map(adaptPayslipForDb)
          : adaptPayslipForDb(this.payload);
      } else if (this.tableName === "audit_logs" && this.payload) {
        const sanitizeAudit = (r: any) => {
          if (!r) return r;
          const copy = { ...r };
          if (copy.id && !isUuid(copy.id)) {
            delete copy.id;
          }
          return copy;
        };
        payloadToUse = Array.isArray(this.payload) ? this.payload.map(sanitizeAudit) : sanitizeAudit(this.payload);
      }

      if (this.action === "select") query = query.select(this.selectColumns);
      else if (this.action === "insert") query = query.insert(payloadToUse);
      else if (this.action === "update") query = query.update(payloadToUse);
      else if (this.action === "upsert") query = query.upsert(payloadToUse, this.upsertOptions);
      else if (this.action === "delete") query = query.delete();

      for (const f of this.filters) {
        if (typeof query[f.type] === "function") query = query[f.type](f.column, f.value);
      }
      for (const o of this.orders) {
        if (typeof query.order === "function") query = query.order(o.column, { ascending: o.ascending });
      }
      if (this.limitCount !== undefined && typeof query.limit === "function") {
        query = query.limit(this.limitCount);
      }

      const res = await query;
      if (!res.error) {
        let resData = res.data;
        if (this.tableName === "payslips" && resData) {
          resData = Array.isArray(resData) ? resData.map(adaptPayslipFromDb) : adaptPayslipFromDb(resData);
        }
        if (this.action !== "select" && this.payload) {
          try {
            const table = jsonStore.getTable(this.tableName);
            const rawRows = Array.isArray(this.payload) ? this.payload : [this.payload];
            const toSave = rawRows.map((r, idx) => ({
              ...(Array.isArray(resData) ? resData[idx] : resData),
              ...r,
            }));
            jsonStore.setTable(
              this.tableName,
              [
                ...table.filter(
                  (t) =>
                    !toSave.some(
                      (s) => (s.id && s.id === t.id) || (s.payslip_number && s.payslip_number === t.payslip_number)
                    )
                ),
                ...toSave,
              ]
            );
          } catch {}
        }
        return { data: resData, error: null };
      }

      handleSupabasePauseNotice(res.error);
      const isSchemaError =
        res.error?.code === "PGRST204" ||
        res.error?.code === "PGRST205" ||
        res.error?.message?.includes("schema cache") ||
        res.error?.message?.includes("column");
      if (!isSchemaError) {
        return res;
      }
    } catch (err: any) {
      handleSupabasePauseNotice(err);
      // Fall through to local store if remote query failed
    }

    // 2. Fallback to local jsonStore
    try {
      // 1. SELECT
      if (this.action === "select") {
        let items = jsonStore.getTable(this.tableName);
        items = this.applyFilters(items);
        items = this.applyOrders(items);
        if (this.limitCount !== undefined) {
          items = items.slice(0, this.limitCount);
        }
        items = items.map((row) => resolveRelationship(this.tableName, row, this.selectColumns));
        if (this.tableName === "payslips") {
          items = items.map(adaptPayslipFromDb);
        }
        return { data: items, error: null };
      }

      // 2. INSERT
      if (this.action === "insert") {
        const rowsToInsert = Array.isArray(this.payload) ? this.payload : [this.payload];
        const table = jsonStore.getTable(this.tableName);
        const inserted = rowsToInsert.map((row) => ({
          id: row.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          ...row,
        }));
        jsonStore.setTable(this.tableName, [...table, ...inserted]);
        return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null };
      }

      // 3. UPDATE
      if (this.action === "update") {
        const table = jsonStore.getTable(this.tableName);
        let updatedCount = 0;
        let updatedItem: any = null;
        const updatedTable = table.map((item) => {
          const matches = this.filters.every((f) => {
            const val = item[f.column];
            if (f.type === "eq") return val === f.value;
            return true;
          });
          if (matches) {
            updatedCount++;
            updatedItem = {
              ...item,
              ...this.payload,
              updated_at: new Date().toISOString(),
            };
            return updatedItem;
          }
          return item;
        });
        jsonStore.setTable(this.tableName, updatedTable);
        return { data: updatedItem, error: null };
      }

      // 4. UPSERT
      if (this.action === "upsert") {
        const rowsToUpsert = Array.isArray(this.payload) ? this.payload : [this.payload];
        const table = jsonStore.getTable(this.tableName);
        const conflictKey = this.upsertOptions?.onConflict || "id";
        const resultRows: any[] = [];

        const updatedTable = [...table];
        for (const row of rowsToUpsert) {
          const index = updatedTable.findIndex((item) => item[conflictKey] === row[conflictKey]);
          if (index >= 0) {
            updatedTable[index] = {
              ...updatedTable[index],
              ...row,
              updated_at: new Date().toISOString(),
            };
            resultRows.push(updatedTable[index]);
          } else {
            const newItem = {
              id: row.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
              ...row,
            };
            updatedTable.push(newItem);
            resultRows.push(newItem);
          }
        }
        jsonStore.setTable(this.tableName, updatedTable);
        return { data: Array.isArray(this.payload) ? resultRows : resultRows[0], error: null };
      }

      // 5. DELETE
      if (this.action === "delete") {
        const table = jsonStore.getTable(this.tableName);
        const updatedTable = table.filter((item) => {
          return !this.filters.every((f) => {
            const val = item[f.column];
            if (f.type === "eq") return val === f.value;
            return true;
          });
        });
        jsonStore.setTable(this.tableName, updatedTable);
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[JsonStore] Error executing on ${this.tableName}:`, err);
      return { data: null, error: err };
    }
  }

  async maybeSingle(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) return res;
    const item = Array.isArray(res.data) ? (res.data.length > 0 ? res.data[0] : null) : res.data;
    return { data: item, error: null };
  }

  async single(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) return res;
    const item = Array.isArray(res.data) ? (res.data.length > 0 ? res.data[0] : null) : res.data;
    if (!item) {
      return { data: null, error: new Error("Row not found") };
    }
    return { data: item, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Unified Auth Provider connecting to real Supabase Auth
 */
const authAdapter = {
  async getUser() {
    try {
      const res = await realSupabase.auth.getUser();
      if (res.data?.user) {
        return res;
      }
    } catch {}
    const user = jsonStore.getUser();
    return { data: { user: user as any }, error: null };
  },

  async getSession() {
    try {
      const res = await realSupabase.auth.getSession();
      if (res.data?.session) {
        return res;
      }
    } catch {}
    const session = jsonStore.getSession();
    return { data: { session: session as any }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password?: string }) {
    // 1. Attempt real Supabase Auth
    try {
      const res = await realSupabase.auth.signInWithPassword({
        email: email.trim(),
        password: password || "",
      });
      if (res.data?.session && res.data?.user) {
        return res;
      }
      if (res.error && !res.error.message.includes("Invalid login credentials")) {
        console.warn("[Supabase Auth] Remote sign in notice:", res.error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Auth] Remote connection error, trying local:", err.message);
    }

    // 2. Fallback to local store
    try {
      const { user, session } = jsonStore.signIn(email, password);
      return { data: { user: user as any, session: session as any }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: err };
    }
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password?: string;
    options?: { data?: { full_name?: string } };
  }) {
    try {
      const res = await realSupabase.auth.signUp({
        email,
        password: password || "blx123",
        ...(options?.data ? { options: { data: options.data } } : {}),
      });
      if (res.data?.user) return res;
    } catch {}

    const { user, session } = jsonStore.signUp(email, password, options?.data?.full_name);
    return { data: { user: user as any, session: session as any }, error: null };
  },

  async signOut() {
    try {
      await realSupabase.auth.signOut();
    } catch {}
    jsonStore.signOut();
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const { data } = realSupabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    const unsubscribeLocal = jsonStore.subscribeAuth(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            data.subscription.unsubscribe();
            unsubscribeLocal();
          },
        },
      },
    };
  },
};

/**
 * Universal Supabase Client
 * Routes directly to real Supabase Postgres & Storage, falling back seamlessly
 * if tables have not yet been provisioned in Supabase SQL editor.
 */
export const supabase = {
  auth: authAdapter,
  storage: realSupabase.storage,
  from(tableName: string) {
    return new JsonQueryBuilder(tableName);
  },
} as unknown as SupabaseClient<Database>;
