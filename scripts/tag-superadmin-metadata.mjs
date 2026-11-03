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

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const u = data.users.find((x) => x.email === "admin@blxrealty.com");
if (!u) {
  console.error("admin@blxrealty.com not found");
  process.exit(1);
}

const { error: upErr } = await sb.auth.admin.updateUserById(u.id, {
  user_metadata: { ...u.user_metadata, role: "superadmin", full_name: "BLX Super Admin" },
});
if (upErr) {
  console.error(upErr.message);
  process.exit(1);
}
console.log("Tagged admin@blxrealty.com metadata.role = superadmin");
