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
const PASSWORD = "admin123";

const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
if (listErr) {
  console.error("listUsers failed:", listErr.message);
  process.exit(1);
}

console.log("Existing users:", (listed?.users || []).map((u) => u.email).join(", ") || "(none)");

let user = listed?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "BLX Admin", role: "admin" },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log("Created admin user:", user.id);
} else {
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "BLX Admin", role: "admin" },
  });
  if (error) {
    console.error("updateUser failed:", error.message);
    process.exit(1);
  }
  console.log("Reset admin password for:", user.id);
}

for (const role of ["admin", "superadmin"]) {
  const { error: roleErr } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role },
    { onConflict: "user_id,role" }
  );
  if (roleErr) {
    console.warn(`user_roles ${role} upsert skipped:`, roleErr.message);
  } else {
    console.log(`Granted ${role} role in user_roles`);
  }
}

console.log(`\nLOGIN:\n  email:    ${EMAIL}\n  password: ${PASSWORD}`);
console.log("Roles: admin + superadmin (payslip edit/delete)");
