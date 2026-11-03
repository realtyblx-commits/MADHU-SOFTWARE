import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Client-side environment variables for Supabase connection
const supabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  "https://eccoqnsmbebmumxuhhkv.supabase.co";

const supabaseAnonKey =
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY29xbnNtYmVibXVteHVoaGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NzkyNDYsImV4cCI6MjEwOTI1NTI0Nn0.1Un9eSRVYhzrNQGYbv73ZvLwBzL33P7LwdfxnigA8z0";

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
