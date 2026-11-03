import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { installSafeConsole } from "@/lib/safe-log";

// Never log API keys / JWTs to the browser console
installSafeConsole();

// Client-side env only — no hardcoded secrets in source
const supabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  "https://eccoqnsmbebmumxuhhkv.supabase.co";

const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

if (!supabaseAnonKey) {
  // Fail loudly without printing any key material
  throw new Error("VITE_SUPABASE_ANON_KEY is not configured.");
}

/**
 * Direct Supabase Client connecting 100% natively to Supabase PostgreSQL,
 * Supabase Storage buckets, and Supabase Auth.
 * ZERO JSON or local storage interception — all data strictly in Supabase.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(typeof window !== "undefined" ? { storage: window.localStorage } : {}),
  },
});

export const realSupabase = supabase;

export function handleSupabasePauseNotice(err: any) {
  if (!err) return;
  const msg = typeof err === "string" ? err : err.message || "";
  if (msg.includes("503") || msg.includes("Failed to fetch") || msg.includes("paused")) {
    console.warn("[Supabase Connection Notice]:", msg);
  }
}
