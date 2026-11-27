import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

/**
 * Privileged Server-Only Supabase Client.
 *
 * CAUTION: Uses SUPABASE_SECRET_KEY to bypass Row Level Security.
 * MUST NEVER BE EXPOSED TO CLIENT BROWSER.
 * Strictly used in server actions, background workers, and secure API endpoints.
 */
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL in server environment."
    );
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
