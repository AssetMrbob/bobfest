import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

/**
 * Privileged Server-Only Supabase Client.
 *
 * CAUTION: Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security.
 * MUST NEVER BE EXPOSED TO CLIENT BROWSER.
 * Strictly used in server actions, background workers, and secure API endpoints.
 */
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in server environment."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
