/**
 * Persistent Database-Backed Rate Limiting & Idempotency.
 *
 * Replaces in-memory state with Supabase PostgreSQL persistent records.
 * Uses short-lived, server-secret HMAC-based client identifiers.
 * Never stores raw IP addresses.
 * Fully compatible with Vercel serverless execution.
 */
import { createHmac } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/types";

export function getClientHmac(ip: string, userAgent: string): string {
  const serverSecret = process.env.APP_SECRET;
  if (!serverSecret || serverSecret.length < 32) {
    throw new Error("APP_SECRET must be configured with at least 32 characters.");
  }
  return createHmac("sha256", serverSecret)
    .update(`${ip}:${userAgent}`)
    .digest("hex");
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Evaluates and records rate limit persistently in Supabase.
 * Enforces 5 attempts per 10 minutes.
 * Uses the atomic database procedure and fails closed if it is unavailable.
 */
export async function checkRateLimitPersistent(
  supabase: SupabaseClient<Database>,
  clientHmac: string,
  maxRequests = 5,
  windowMinutes = 10
): Promise<RateLimitResult> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "check_and_record_rate_limit",
      {
        p_client_hash: clientHmac,
        p_max_requests: maxRequests,
        p_window_interval: `${windowMinutes} minutes`,
      }
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      const outcome = rpcData[0];
      return {
        success: outcome.allowed,
        remaining: outcome.remaining,
        resetSeconds: outcome.reset_seconds,
      };
    }

    console.error("Persistent rate limit RPC unavailable:", rpcError?.message);
    return { success: false, remaining: 0, resetSeconds: 60 };
  } catch (err) {
    console.error("Persistent rate limit exception:", err);
    return { success: false, remaining: 0, resetSeconds: 60 };
  }
}

/**
 * Checks idempotency table to prevent duplicate submissions.
 */
export async function checkIdempotencyPersistent(
  supabase: SupabaseClient<Database>,
  idempotencyKey: string
): Promise<string | null> {
  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("idempotency_keys")
      .select("public_code, expires_at")
      .eq("key", idempotencyKey)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (data?.public_code) {
      return data.public_code;
    }
    return null;
  } catch (err) {
    console.error("Idempotency check error:", err);
    return null;
  }
}

/**
 * Records idempotency key in persistent table (TTL 60 seconds).
 */
export async function setIdempotencyPersistent(
  supabase: SupabaseClient<Database>,
  idempotencyKey: string,
  publicCode: string,
  ttlSeconds = 60
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase.from("idempotency_keys").upsert({
      key: idempotencyKey,
      public_code: publicCode,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("Idempotency record error:", err);
  }
}
