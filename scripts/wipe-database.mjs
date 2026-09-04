import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

let supabaseUrl = "";
let supabaseServiceKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (key === "VITE_SUPABASE_URL" || key === "SUPABASE_URL") supabaseUrl = val;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceKey = val;
    }
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function wipeAll() {
  console.log("==================================================");
  console.log("   STARTING COMPLETE DATABASE PURGE TO ZERO      ");
  console.log("==================================================");

  // 1. Identify Admin User ID to protect admin access
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (userError) {
    console.error("Error fetching auth users:", userError.message);
  }

  let adminUser = userData?.users?.find((u) => u.email === "admin@blxrealty.com");

  if (!adminUser) {
    console.log("Admin account not found. Creating admin@blxrealty.com...");
    const { data: newAdmin, error: createAdminErr } = await supabase.auth.admin.createUser({
      email: "admin@blxrealty.com",
      password: "admin123",
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "BLX Admin Bossu" },
    });
    if (createAdminErr) {
      console.error("Failed to create admin:", createAdminErr.message);
    } else {
      adminUser = newAdmin.user;
      console.log("✓ Admin user created:", adminUser.id);
    }
  } else {
    console.log(`Found admin account: ${adminUser.email} (${adminUser.id})`);
    // Ensure password is reset to admin123
    await supabase.auth.admin.updateUserById(adminUser.id, {
      password: "admin123",
      user_metadata: { role: "admin", full_name: "BLX Admin Bossu" },
    });
    console.log("✓ Verified admin password is set to 'admin123'");
  }

  const adminId = adminUser?.id;

  // 2. Delete child records first, then parents
  const deleteSteps = [
    { table: "payroll_adjustments", filter: () => supabase.from("payroll_adjustments").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "payslips", filter: () => supabase.from("payslips").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "payroll", filter: () => supabase.from("payroll").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "attendance", filter: () => supabase.from("attendance").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "leave_requests", filter: () => supabase.from("leave_requests").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "audit_logs", filter: () => supabase.from("audit_logs").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "employees", filter: () => supabase.from("employees").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
    { table: "holidays", filter: () => supabase.from("holidays").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000") },
  ];

  for (const step of deleteSteps) {
    try {
      const { error, count } = await step.filter();
      if (error) {
        console.warn(`[!] Table ${step.table}: ${error.message}`);
      } else {
        console.log(`[✓] Table '${step.table}' cleared (${count ?? 0} rows deleted)`);
      }
    } catch (err) {
      console.warn(`[!] Table ${step.table} error:`, err.message);
    }
  }

  // 3. Clear non-admin profiles
  if (adminId) {
    const { error: profErr, count: profCount } = await supabase
      .from("profiles")
      .delete({ count: "exact" })
      .neq("id", adminId);
    console.log(`[✓] Non-admin profiles cleared (${profCount ?? 0} deleted, admin preserved)`);

    // Ensure admin profile exists
    await supabase.from("profiles").upsert({
      id: adminId,
      email: "admin@blxrealty.com",
      full_name: "BLX Admin Bossu",
    });

    // 4. Clear non-admin user_roles
    const { error: roleErr, count: roleCount } = await supabase
      .from("user_roles")
      .delete({ count: "exact" })
      .neq("user_id", adminId);
    console.log(`[✓] Non-admin user_roles cleared (${roleCount ?? 0} deleted, admin preserved)`);

    // Ensure admin has admin role in user_roles
    const { data: existingAdminRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingAdminRole) {
      await supabase.from("user_roles").insert({
        user_id: adminId,
        role: "admin",
      });
      console.log("[✓] Admin user_role ('admin') established.");
    }
  }

  // 5. Delete employee Auth accounts
  console.log("\nCleaning Auth accounts...");
  if (userData?.users) {
    for (const u of userData.users) {
      if (u.email === "admin@blxrealty.com") {
        console.log(`[✓] Preserved admin auth account: ${u.email}`);
      } else {
        console.log(`[-] Deleting non-admin auth user: ${u.email} (${u.id})`);
        const { error: delUserErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delUserErr) {
          console.warn(`Failed to delete user ${u.email}:`, delUserErr.message);
        }
      }
    }
  }

  // 6. Final Verification of all tables
  console.log("\n==================================================");
  console.log("            FINAL ZERO-COUNT VERIFICATION         ");
  console.log("==================================================");

  const checkTables = [
    "employees",
    "attendance",
    "payslips",
    "payroll",
    "payroll_adjustments",
    "leave_requests",
    "holidays",
    "audit_logs",
    "profiles",
    "user_roles"
  ];

  let allZero = true;
  for (const t of checkTables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (t === "profiles" || t === "user_roles") {
      console.log(`Table '${t}': ${count} row(s) [Expected: 1 for Admin]`);
    } else {
      console.log(`Table '${t}': ${count} row(s) [Expected: 0]`);
      if (count !== 0) allZero = false;
    }
  }

  const { data: remainingUsers } = await supabase.auth.admin.listUsers();
  console.log(`Auth Users: ${remainingUsers?.users?.length} user(s) [Expected: 1 for Admin]`);
  remainingUsers?.users?.forEach(u => console.log(`  -> ${u.email}`));

  console.log("==================================================");
  if (allZero && remainingUsers?.users?.length === 1) {
    console.log("SUCCESS: ALL DATABASE TABLES HAVE BEEN WIPED TO 0!");
    console.log("Admin login: admin@blxrealty.com / admin123");
  } else {
    console.log("VERIFICATION NOTE: Check counts above.");
  }
  console.log("==================================================");
}

wipeAll().catch(console.error);
