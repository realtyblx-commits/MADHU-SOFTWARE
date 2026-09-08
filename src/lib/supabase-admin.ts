import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-only Supabase admin client with service_role key.
 * Used exclusively for administrative user provisioning.
 * NEVER import this file into browser/client bundles.
 */
export function getSupabaseAdmin() {
  const url =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    "https://jyxhhefesovztegtzrnb.supabase.co";

  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in environment.");
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
