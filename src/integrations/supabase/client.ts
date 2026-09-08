import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Client-side environment variables for Supabase connection
const supabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  "https://jyxhhefesovztegtzrnb.supabase.co";

const supabaseAnonKey =
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eGhoZWZlc292enRlZ3R6cm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTM0MzYsImV4cCI6MjEwNDQ2OTQzNn0.HWjgw9cgIyGXtgO1UrdxGEuElTRxg93qHA4D1nSjK2A";

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
