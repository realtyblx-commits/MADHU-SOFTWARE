export interface DBUser {
  id: string;
  email: string;
  password?: string;
  full_name?: string;
}

export interface DBSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: DBUser;
}

const STORAGE_KEY = "blx_payroll_db_clean_production_v1";
const AUTH_KEY = "blx_payroll_auth";

type DatabaseData = Record<string, any[]>;

const initialData: DatabaseData = {
  company_settings: [
    {
      id: "settings-default",
      company_name: "BLX REALTY PRIVATE LIMITED",
      logo_url: "/apple-touch-icon.png",
      website: "www.theblxrealty.com",
      office_start: "10:30",
      office_end: "18:30",
      office_timing: "10:30 AM - 6:30 PM",
      late_threshold: "10:45 AM",
      grace_minutes: 15,
      late_block_minutes: 30,
      late_block_amount: 500,
      salary_day_basis: "Fixed Days",
      fixed_days_per_month: 30,
      default_payment_mode: "Bank Transfer",
      default_currency: "₹",
      payslip_prefix: "PS-",
      employee_id_prefix: "BLX26-",
      payslip_footer: "This is a computer-generated salary slip and does not require a physical signature.",
      authorized_signatory: "Authorized Signatory (BLX Realty Pvt Ltd)",
      authorized_signature: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  users: [
    {
      id: "user-admin-01",
      email: "admin@blxrealty.com",
      password: "admin123",
      full_name: "BLX Payroll Admin",
    },
  ],
  profiles: [
    {
      id: "user-admin-01",
      email: "admin@blxrealty.com",
      full_name: "BLX Payroll Admin",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [
    {
      id: "role-01",
      user_id: "user-admin-01",
      role: "admin",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  payslips: [],
  employees: [
    {
      id: "582fba84-69f4-4ec8-8b7b-4726a18b29f3",
      user_id: "9f06b5ae-8273-4514-8a85-aac6e7a7edd1",
      employee_code: "BLX26-001",
      full_name: "Devesh Vats",
      designation: "Realtor",
      department: "Sales",
      employment_status: "Active",
      email: "devesh@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 30000,
      joining_date: "2026-01-01",
    },
    {
      id: "27e6f551-c0ab-4102-8577-a5b1da5993d3",
      user_id: "8dc636ab-930b-4235-8d20-5cceb10d5654",
      employee_code: "BLX26-002",
      full_name: "Vishal M Raju",
      designation: "Senior Realtor",
      department: "Sales",
      employment_status: "Active",
      email: "vishal@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 50000,
      joining_date: "2026-01-01",
    },
    {
      id: "2774e557-9551-410a-a7b9-34a00b96ed04",
      user_id: "8b8f1c06-e775-43f3-9ed5-14422c7abcac",
      employee_code: "BLX26-003",
      full_name: "Balindar",
      designation: "Digital Marketing",
      department: "Digital Marketing",
      employment_status: "Active",
      email: "balindar@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 23000,
      joining_date: "2026-01-01",
    },
    {
      id: "264c2f32-1bcb-4402-ad67-fcdbfc825949",
      user_id: "f5a03e3b-df8f-40e4-a62c-7c5e3073bc50",
      employee_code: "BLX26-004",
      full_name: "Chandrika",
      designation: "Presales",
      department: "Presales",
      employment_status: "Active",
      email: "chandrika@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 23000,
      joining_date: "2026-01-01",
    },
    {
      id: "f29712ab-bd00-4a3c-8a41-42a5e682d3fb",
      user_id: "0c53fdae-4edf-4235-991c-98b6e932cb9a",
      employee_code: "BLX26-005",
      full_name: "Siddarth",
      designation: "Realtor",
      department: "Sales",
      employment_status: "Active",
      email: "siddarth@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 25000,
      joining_date: "2026-01-01",
    },
    {
      id: "c30f8456-2c60-4441-a029-670a84a9cdab",
      user_id: "14e20174-b57e-40e3-8f5d-4b0a1e505eb4",
      employee_code: "BLX26-006",
      full_name: "Jigyasa Dhiman",
      designation: "Content and Marketing",
      department: "Marketing",
      employment_status: "Active",
      email: "jigyasa@theblxrealty.com",
      payment_mode: "Bank Transfer",
      gross_salary: 30000,
      joining_date: "2026-01-01",
    },
  ],
  attendance: [],
  payroll: [],
  payroll_adjustments: [],
  leave_requests: [],
  holidays: [],
  audit_logs: [],
};

class JsonStore {
  private data: DatabaseData | null = null;
  private authListeners: Set<(event: string, session: DBSession | null) => void> = new Set();

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  }

  public getData(): DatabaseData {
    if (this.data) return this.data;

    if (this.isBrowser()) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          if (!this.data!["employees"] || this.data!["employees"].length === 0) {
            this.data!["employees"] = JSON.parse(JSON.stringify(initialData["employees"]));
            this.saveData();
          }
          return this.data!;
        } catch (e) {
          console.warn("Resetting local cache to baseline", e);
        }
      }
    }

    // Initialize with clone of initial clean data
    this.data = JSON.parse(JSON.stringify(initialData));
    this.saveData();
    return this.data!;
  }

  public saveData(): void {
    if (!this.data || !this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("Failed to save to localStorage", e);
    }
  }

  public getTable<T = any>(tableName: string): T[] {
    const db = this.getData();
    if (!db[tableName]) {
      db[tableName] = [];
    }
    return db[tableName] as T[];
  }

  public setTable<T = any>(tableName: string, rows: T[]): void {
    const db = this.getData();
    db[tableName] = rows;
    this.saveData();
  }

  public resetToDefaults(): void {
    this.data = JSON.parse(JSON.stringify(initialData));
    this.saveData();
  }

  public exportDatabaseJson(): string {
    return JSON.stringify(this.getData(), null, 2);
  }

  // --- Auth state management ---

  public getSession(): DBSession | null {
    if (!this.isBrowser()) {
      return null;
    }

    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public getUser(): DBUser | null {
    return this.getSession()?.user ?? null;
  }

  public setSession(session: DBSession | null, event = "SIGNED_IN"): void {
    if (this.isBrowser()) {
      if (session) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(AUTH_KEY);
      }
    }
    this.notifyAuth(event, session);
  }

  public subscribeAuth(callback: (event: string, session: DBSession | null) => void) {
    this.authListeners.add(callback);
    return () => {
      this.authListeners.delete(callback);
    };
  }

  private notifyAuth(event: string, session: DBSession | null): void {
    for (const listener of this.authListeners) {
      try {
        listener(event, session);
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    }
  }

  public registerOrUpdateEmployeeUser(emp: {
    email: string;
    full_name: string;
    password?: string | undefined;
    employee_code?: string | undefined;
  }): void {
    if (!emp.email || !emp.email.trim()) return;
    const trimmedEmail = emp.email.trim().toLowerCase();
    const users = this.getTable<DBUser>("users");
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (existing) {
      existing.full_name = emp.full_name;
      if (emp.password && emp.password.trim()) {
        existing.password = emp.password.trim();
      }
      this.setTable("users", users);

      const profiles = this.getTable<any>("profiles");
      const prof = profiles.find((p: any) => p.email.toLowerCase() === trimmedEmail);
      if (prof) {
        prof.full_name = emp.full_name;
        prof.updated_at = new Date().toISOString();
        this.setTable("profiles", profiles);
      }
    } else {
      const id = `user-emp-${emp.employee_code || Date.now()}`;
      const newUser: DBUser = {
        id,
        email: trimmedEmail,
        password: emp.password && emp.password.trim() ? emp.password.trim() : "blx123",
        full_name: emp.full_name,
      };
      users.push(newUser);
      this.setTable("users", users);

      const profiles = this.getTable<any>("profiles");
      profiles.push({
        id,
        email: trimmedEmail,
        full_name: emp.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      this.setTable("profiles", profiles);

      const roles = this.getTable<any>("user_roles");
      roles.push({
        id: `role-${Date.now()}`,
        user_id: id,
        role: "employee",
        created_at: new Date().toISOString(),
      });
      this.setTable("user_roles", roles);
    }
  }

  public signIn(email: string, password?: string): { user: DBUser; session: DBSession } {
    const users = this.getTable<DBUser>("users");
    const trimmedEmail = email.trim().toLowerCase();
    let found = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!found) {
      // Check if this employee exists in employees table
      const employees = this.getTable<any>("employees");
      const matchingEmp = employees.find((e: any) => e.email && e.email.toLowerCase() === trimmedEmail);
      if (matchingEmp) {
        const id = `user-emp-${matchingEmp.employee_code || Date.now()}`;
        found = {
          id,
          email: trimmedEmail,
          password: password || "blx123",
          full_name: matchingEmp.full_name,
        };
        users.push(found);
        this.setTable("users", users);

        const profiles = this.getTable<any>("profiles");
        profiles.push({
          id,
          email: trimmedEmail,
          full_name: found.full_name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        this.setTable("profiles", profiles);

        const roles = this.getTable<any>("user_roles");
        roles.push({
          id: `role-${Date.now()}`,
          user_id: id,
          role: "employee",
          created_at: new Date().toISOString(),
        });
        this.setTable("user_roles", roles);
      } else if (trimmedEmail.includes("admin")) {
        const id = "user-admin-01";
        found = {
          id,
          email: trimmedEmail,
          password: password || "admin123",
          full_name: "BLX Payroll Admin",
        };
        users.push(found);
        this.setTable("users", users);
      } else {
        throw new Error("No employee account found for this email. Please ask your Admin to register your profile.");
      }
    }

    if (password && found.password && found.password !== password) {
      throw new Error("Invalid password. Please check your credentials or ask the Admin.");
    }

    const session: DBSession = {
      access_token: `mock-jwt-${found.id}-${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      user: found,
    };

    this.setSession(session, "SIGNED_IN");
    return { user: found, session };
  }

  public signUp(email: string, password?: string, fullName?: string): { user: DBUser; session: DBSession } {
    const trimmedEmail = email.trim().toLowerCase();
    const users = this.getTable<DBUser>("users");
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (existing) {
      return this.signIn(email, password);
    }

    const isFirstUser = users.length === 0;
    const isAdmin = isFirstUser || trimmedEmail.includes("admin");
    const id = `user-${Date.now()}`;
    const newUser: DBUser = {
      id,
      email: trimmedEmail,
      password: password || "password123",
      full_name: fullName || (isAdmin ? "Payroll Admin" : "BLX Employee"),
    };
    users.push(newUser);
    this.setTable("users", users);

    const profiles = this.getTable("profiles");
    profiles.push({
      id,
      email: trimmedEmail,
      full_name: newUser.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.setTable("profiles", profiles);

    const roles = this.getTable("user_roles");
    roles.push({
      id: `role-${Date.now()}`,
      user_id: id,
      role: isAdmin ? "admin" : "employee",
      created_at: new Date().toISOString(),
    });
    this.setTable("user_roles", roles);

    const session: DBSession = {
      access_token: `mock-jwt-${id}-${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      user: newUser,
    };

    this.setSession(session, "SIGNED_IN");
    return { user: newUser, session };
  }

  public signOut(): void {
    this.setSession(null, "SIGNED_OUT");
  }

  public clearAllOperationalData(): void {
    this.setTable("employees", []);
    this.setTable("attendance", []);
    this.setTable("payslips", []);
    this.setTable("payroll", []);
    this.setTable("payroll_adjustments", []);
    this.setTable("leave_requests", []);
    this.setTable("holidays", []);
    this.setTable("audit_logs", []);
    if (this.isBrowser()) {
      try {
        localStorage.removeItem("blx_notifications_v1");
      } catch {}
    }
    this.saveData();
  }

  public resetDatabase(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.data = JSON.parse(JSON.stringify(initialData));
    this.saveData();
  }
}

export const jsonStore = new JsonStore();
