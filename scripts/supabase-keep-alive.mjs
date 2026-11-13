/**
 * Supabase Keep-Alive — read-only activity ping.
 *
 * Runs outside the browser (CI / cron). Uses env credentials only.
 * Never writes rows, never uploads files, never prints secrets.
 *
 * Env (any of):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
 *   (optional) SUPABASE_SERVICE_ROLE_KEY — unused; keep-alive is anon/read-only
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (!m) continue;
    if (process.env[m[1]] == null || process.env[m[1]] === "") {
      process.env[m[1]] = m[2];
    }
  }
}

loadDotEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const anonKey = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

function log(level, message, extra) {
  const stamp = new Date().toISOString();
  const line = `[keep-alive ${stamp}] ${message}`;
  if (level === "error") {
    console.error(line, extra ?? "");
  } else {
    console.log(line, extra ?? "");
  }
}

async function ping() {
  if (!url) {
    log("error", "Missing SUPABASE_URL / VITE_SUPABASE_URL");
    process.exitCode = 1;
    return;
  }
  if (!anonKey) {
    log("error", "Missing SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY");
    process.exitCode = 1;
    return;
  }

  // Minimal read: one column, one row. No inserts/updates/deletes.
  const endpoint = `${url}/rest/v1/company_settings?select=id&limit=1`;
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        Prefer: "count=exact",
      },
      signal: controller.signal,
    });
  } catch (err) {
    log("error", "Network/probe failure", err instanceof Error ? err.message : "unknown");
    process.exitCode = 1;
    return;
  } finally {
    clearTimeout(timer);
  }

  const ms = Date.now() - started;
  const status = response.status;

  if (status === 200 || status === 206) {
    log("info", `OK — Supabase reachable (HTTP ${status}, ${ms}ms). Read-only probe; zero writes.`);
    return;
  }

  if (status === 503) {
    log("error", `Supabase paused or initializing (HTTP 503, ${ms}ms).`);
    process.exitCode = 1;
    return;
  }

  if (status === 401 || status === 403) {
    log("error", `Auth rejected (HTTP ${status}, ${ms}ms). Check anon key secret — key value not logged.`);
    process.exitCode = 1;
    return;
  }

  // Table may be missing on a fresh project; still counts as activity at the API/DB gateway.
  if (status === 404 || status === 406) {
    log(
      "info",
      `Probe contacted Supabase (HTTP ${status}, ${ms}ms). Schema may be incomplete; no writes performed.`
    );
    return;
  }

  log("error", `Unexpected response (HTTP ${status}, ${ms}ms).`);
  process.exitCode = 1;
}

await ping();
