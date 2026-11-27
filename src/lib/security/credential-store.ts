import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret, EncryptedPayload } from "./encryption";

export interface AppCredentialRecord {
  id: string; // 'instagram_unified' | 'threads_official'
  platform: "instagram" | "threads";
  account_id: string;
  account_username: string;
  token_type: string;
  expires_at: string | null;
  last_refreshed_at: string | null;
  last_health_check_at: string | null;
  last_status: "connected" | "expired" | "revoked" | "error" | "unverified";
  sanitized_last_error: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Retrieves the active access token for a platform.
 * Priority:
 * 1. Database app_credentials table (if migration applied and valid record exists)
 * 2. Fallback to server environment variables (.env.local)
 */
export async function getActivePlatformToken(
  platform: "instagram" | "threads"
): Promise<{ token: string; accountId: string; username: string } | null> {
  const adminClient = createAdminSupabaseClient();
  const credentialId = platform === "instagram" ? "instagram_unified" : "threads_official";

  try {
    const { data, error } = await adminClient
      .from("app_credentials")
      .select("*")
      .eq("id", credentialId)
      .maybeSingle();

    if (!error && data && data.encrypted_token) {
      const payload: EncryptedPayload = {
        encrypted: data.encrypted_token,
        iv: data.iv,
        authTag: data.auth_tag,
      };
      const token = decryptSecret(payload);
      return {
        token,
        accountId: data.account_id,
        username: data.account_username,
      };
    }
  } catch (err) {
    // If table does not exist or decryption fails, fallback safely to env
    console.warn(`[CredentialStore] DB lookup failed for ${platform}, falling back to env:`, (err as Error).message);
  }

  // Fallback to environment variables
  if (platform === "instagram") {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_USER_ID;
    const username = process.env.INSTAGRAM_USERNAME || "kampunginggrisfess";
    if (token && accountId) {
      return { token, accountId, username };
    }
  } else if (platform === "threads") {
    const token = process.env.THREADS_ACCESS_TOKEN;
    const accountId = process.env.THREADS_USER_ID;
    const username = process.env.THREADS_USERNAME || "kampunginggrisfess";
    if (token && accountId) {
      return { token, accountId, username };
    }
  }

  return null;
}

/**
 * Stores or updates a token in the secure database store.
 */
export async function savePlatformToken(params: {
  id: "instagram_unified" | "threads_official";
  platform: "instagram" | "threads";
  accountId: string;
  accountUsername: string;
  token: string;
  tokenType?: string;
  expiresAt?: string | null;
  status?: "connected" | "expired" | "revoked" | "error" | "unverified";
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const adminClient = createAdminSupabaseClient();
  const { encrypted, iv, authTag } = encryptSecret(params.token);

  try {
    const { error } = await adminClient.from("app_credentials").upsert({
      id: params.id,
      platform: params.platform,
      account_id: params.accountId,
      account_username: params.accountUsername,
      encrypted_token: encrypted,
      iv,
      auth_tag: authTag,
      token_type: params.tokenType || "bearer",
      expires_at: params.expiresAt || null,
      last_refreshed_at: new Date().toISOString(),
      last_health_check_at: new Date().toISOString(),
      last_status: params.status || "connected",
      sanitized_last_error: null,
      metadata: (params.metadata || {}) as unknown as import("@/lib/supabase/types").Json,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[CredentialStore] Failed to save token for ${params.platform}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[CredentialStore] Exception saving token for ${params.platform}:`, (err as Error).message);
    return false;
  }
}
