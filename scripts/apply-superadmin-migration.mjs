/**
 * Applies superadmin + payslip edit lock via service role where possible,
 * and grants admin@blxrealty.com the superadmin role.
 *
 * Full DDL (enum + policies) must still be run from SQL Editor if this fails:
 *   supabase/migrations/20260322_superadmin_payslip_edit.sql
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((l) => {
      const m = l.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
      return m ? [m[1], m[2]] : null;
    })
    .filter(Boolean)
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "admin@blxrealty.com";

const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
if (listErr) {
  console.error(listErr.message);
  process.exit(1);
}

const user = listed?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
if (!user) {
  console.error(`User ${EMAIL} not found. Run scripts/ensure-admin.mjs first.`);
  process.exit(1);
}

for (const role of ["admin", "superadmin"]) {
  const { error } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role },
    { onConflict: "user_id,role" }
  );
  if (error) {
    console.error(`Failed to grant ${role}:`, error.message);
    console.error(
      "→ Open Supabase SQL Editor and run supabase/migrations/20260322_superadmin_payslip_edit.sql first."
    );
    process.exit(1);
  }
  console.log(`Granted ${role} to ${EMAIL}`);
}

const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
console.log(
  "Current roles:",
  (roles || []).map((r) => r.role).join(", ")
);
console.log("Done. Sign out/in so the client refreshes roles.");
