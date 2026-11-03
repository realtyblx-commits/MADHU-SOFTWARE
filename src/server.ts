import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/health") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "GET, HEAD, OPTIONS",
            },
          });
        }

        let dbStatus = "connected";
        try {
          const supabaseUrl =
            (env as any)?.VITE_SUPABASE_URL ||
            process.env["VITE_SUPABASE_URL"] ||
            "https://eccoqnsmbebmumxuhhkv.supabase.co";
          const anonKey = (env as any)?.VITE_SUPABASE_ANON_KEY || process.env["VITE_SUPABASE_ANON_KEY"];
          if (anonKey) {
            const probe = await fetch(`${supabaseUrl}/rest/v1/company_settings?select=id&limit=1`, {
              headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
            });
            if (probe.status === 503 || probe.status === 401) {
              dbStatus = "paused_or_initializing";
            }
          }
        } catch {
          dbStatus = "unreachable";
        }

        return new Response(
          JSON.stringify({
            status: "ok",
            timestamp: new Date().toISOString(),
            service: "BLX Realty Payroll Suite",
            database: dbStatus,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
            },
          }
        );
      }

      if (url.pathname === "/api/admin/create-employee-user") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "POST, OPTIONS",
              "access-control-allow-headers": "content-type, authorization",
            },
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await request.json()) as any;
            const { email, password, full_name, employee_code } = body || {};
            if (!email || !email.trim()) {
              return new Response(JSON.stringify({ error: "Email is required" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            const { createClient } = await import("@supabase/supabase-js");
            const supabaseUrl =
              (env as any)?.SUPABASE_URL ||
              (env as any)?.VITE_SUPABASE_URL ||
              process.env["SUPABASE_URL"] ||
              process.env["VITE_SUPABASE_URL"] ||
              "https://eccoqnsmbebmumxuhhkv.supabase.co";

            const serviceKey =
              (env as any)?.SUPABASE_SERVICE_ROLE_KEY ||
              process.env["SUPABASE_SERVICE_ROLE_KEY"];

            if (!serviceKey) {
              throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in server environment");
            }

            const adminClient = createClient(supabaseUrl, serviceKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            });

            // Check if user exists in auth.users
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

            // Automatically link user_id and normalized lowercase email in employees table
            if (userId) {
              if (employee_code) {
                await adminClient
                  .from("employees")
                  .update({ user_id: userId, email: email.trim().toLowerCase() })
                  .eq("employee_code", employee_code);
              } else {
                await adminClient
                  .from("employees")
                  .update({ user_id: userId, email: email.trim().toLowerCase() })
                  .ilike("email", email.trim());
              }
            }

            return new Response(JSON.stringify({ ok: true, user_id: userId }), {
              status: 200,
              headers: {
                "content-type": "application/json",
                "access-control-allow-origin": "*",
              },
            });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), {
              status: 500,
              headers: {
                "content-type": "application/json",
                "access-control-allow-origin": "*",
              },
            });
          }
        }
      }

      if (url.pathname === "/api/auth/sync-employee") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "POST, OPTIONS",
              "access-control-allow-headers": "content-type, authorization",
            },
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await request.json()) as any;
            const { user_id, email } = body || {};
            if (user_id && email) {
              const { createClient } = await import("@supabase/supabase-js");
              const supabaseUrl =
                (env as any)?.SUPABASE_URL ||
                (env as any)?.VITE_SUPABASE_URL ||
                process.env["SUPABASE_URL"] ||
                process.env["VITE_SUPABASE_URL"] ||
                "https://eccoqnsmbebmumxuhhkv.supabase.co";

              const serviceKey =
                (env as any)?.SUPABASE_SERVICE_ROLE_KEY ||
                process.env["SUPABASE_SERVICE_ROLE_KEY"];

              if (!serviceKey) {
                throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in server environment");
              }

              const adminClient = createClient(supabaseUrl, serviceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
              });

              await adminClient
                .from("employees")
                .update({ user_id, email: email.trim().toLowerCase() })
                .ilike("email", email.trim());
            }
            return new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), {
              status: 500,
              headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            });
          }
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
