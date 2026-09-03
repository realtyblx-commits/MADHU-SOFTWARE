import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";

if (process.env["VERCEL"] && !process.env["NITRO_PRESET"]) {
  process.env["NITRO_PRESET"] = "vercel";
}

function supabaseAdminPlugin() {
  return {
    name: "supabase-admin-api",
    configureServer(server: any) {

      // Lightweight health-check endpoint for external ping / keep-alive service
      server.middlewares.use("/api/health", async (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        // Minimal read-only probe to Supabase (LIMIT 1 on company_settings)
        let dbStatus = "connected";
        try {
          const url =
            process.env["SUPABASE_URL"] ||
            process.env["VITE_SUPABASE_URL"] ||
            "https://quqlutfkkydruoflbuil.supabase.co";
          const anonKey = process.env["VITE_SUPABASE_ANON_KEY"];

          if (anonKey) {
            const probe = await fetch(`${url}/rest/v1/company_settings?select=id&limit=1`, {
              method: "GET",
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              },
            });
            if (probe.status === 503 || probe.status === 401) {
              dbStatus = "paused_or_initializing";
            }
          }
        } catch {
          dbStatus = "unreachable";
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            status: "ok",
            timestamp: new Date().toISOString(),
            service: "BLX Realty Payroll Suite",
            database: dbStatus,
          })
        );
      });

      // Server-side administrative endpoint to create / update employee Supabase Auth users
      server.middlewares.use("/api/admin/create-employee-user", (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const { email, password, full_name, employee_code } = JSON.parse(body);
              if (!email || !email.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Email is required" }));
                return;
              }

              // Lazy import createClient
              const { createClient } = await import("@supabase/supabase-js");
              const url =
                process.env["SUPABASE_URL"] ||
                process.env["VITE_SUPABASE_URL"] ||
                "https://quqlutfkkydruoflbuil.supabase.co";
              const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

              if (!serviceKey) {
                throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in server environment");
              }

              const adminClient = createClient(url, serviceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
              });

              // Check if user exists
              const { data: userList } = await adminClient.auth.admin.listUsers();
              const existing = userList?.users?.find(
                (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
              );

              let userId = existing?.id;
              if (existing) {
                if (password && password.trim()) {
                  await adminClient.auth.admin.updateUserById(existing.id, {
                    password: password.trim(),
                    user_metadata: { full_name, employee_code, role: "employee" },
                  });
                }
              } else {
                const { data: newUser, error: createError } =
                  await adminClient.auth.admin.createUser({
                    email: email.trim().toLowerCase(),
                    password: password?.trim() || "blx123",
                    email_confirm: true,
                    user_metadata: { full_name, employee_code, role: "employee" },
                  });
                if (createError) throw createError;
                userId = newUser.user.id;
              }

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, user_id: userId }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
      });
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [supabaseAdminPlugin()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

