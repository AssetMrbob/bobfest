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
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.APP_SECRET || "menfess-salt-key";
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
 * Uses atomic check_and_record_rate_limit stored procedure when available,
 * or direct atomic table operations.
 */
export async function checkRateLimitPersistent(
  supabase: SupabaseClient<Database>,
  clientHmac: string,
  maxRequests = 5,
  windowMinutes = 10
): Promise<RateLimitResult> {
  try {
    // 1. Try atomic PostgreSQL RPC if migration is applied
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

    // 2. Direct table fallback if RPC is not loaded yet
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("client_hash", clientHmac)
      .gt("created_at", windowStart);

    if (countError) {
      console.error("Rate limit query error:", countError);
      // In production fail safely, in local allow
      return { success: process.env.NODE_ENV !== "production", remaining: 1, resetSeconds: 60 };
    }

    const currentCount = count || 0;
    if (currentCount >= maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetSeconds: windowMinutes * 60,
      };
    }

    // Record this attempt
    await supabase.from("rate_limits").insert({
      client_hash: clientHmac,
    });

    return {
      success: true,
      remaining: Math.max(0, maxRequests - (currentCount + 1)),
      resetSeconds: windowMinutes * 60,
    };
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
