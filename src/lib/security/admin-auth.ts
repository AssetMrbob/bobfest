import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Server actions are public POST endpoints, so each one must verify the role. */
export async function assertAdminSession(): Promise<string> {
  const client = await createServerSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: profile, error: profileError } = await client
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") throw new Error("Forbidden");
  return user.id;
}
