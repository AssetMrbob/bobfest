import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./types";

/**
 * Client-side Supabase client for browser components.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Never exposes secret key to the browser.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    console.warn("Supabase environment variables are not configured.");
  }

  return createBrowserClient<Database>(
    supabaseUrl || "https://placeholder.supabase.co",
    publishableKey || "placeholder-publishable-key"
  );
}
