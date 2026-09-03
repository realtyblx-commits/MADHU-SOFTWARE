import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (key === "SUPABASE_URL" || key === "VITE_SUPABASE_URL") supabaseUrl = supabaseUrl || val;
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

async function cleanAll() {
  console.log("=========================================");
  console.log("CLEANING ALL DATA ACROSS THE PROJECT");
  console.log("=========================================");

  // 1. Delete dependent tables first
  const tables = [
    "payroll_adjustments",
    "payslips",
    "payroll",
    "attendance",
    "leave_requests",
    "audit_logs",
    "employees",
  ];

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all rows

      if (error) {
        console.warn(`Warning on deleting ${table}:`, error.message);
      } else {
        console.log(`✓ Cleared table: ${table} (${count ?? 0} rows removed)`);
      }
    } catch (err) {
      console.warn(`Error on table ${table}:`, err.message);
    }
  }

  // 2. Clean auth.users - keep only admin@blxrealty.com
  console.log("\nCleaning employee Auth accounts...");
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (userError) {
    console.error("Failed to list users:", userError.message);
  } else {
    for (const u of userData.users) {
      if (u.email === "admin@blxrealty.com") {
        console.log(`Preserving admin account: ${u.email} (${u.id})`);
        // Ensure admin password is admin123
        await supabase.auth.admin.updateUserById(u.id, {
          password: "admin123",
          user_metadata: { role: "admin", full_name: "BLX Admin Bossu" },
        });
      } else {
        console.log(`Deleting employee auth account: ${u.email} (${u.id})`);
        await supabase.auth.admin.deleteUser(u.id);
      }
    }
  }

  // Ensure admin account exists if not present
  const adminExists = userData?.users?.some((u) => u.email === "admin@blxrealty.com");
  if (!adminExists) {
    console.log("Creating admin account: admin@blxrealty.com / admin123");
    const { error: createAdminErr } = await supabase.auth.admin.createUser({
      email: "admin@blxrealty.com",
      password: "admin123",
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "BLX Admin Bossu" },
    });
    if (createAdminErr) {
      console.error("Error creating admin account:", createAdminErr.message);
    } else {
      console.log("✓ Admin account created successfully.");
    }
  }

  console.log("\n=========================================");
  console.log("ALL DATA RESET TO 0 COMPLETE");
  console.log("Admin login: admin@blxrealty.com / admin123");
  console.log("=========================================");
}

cleanAll().catch(console.error);
