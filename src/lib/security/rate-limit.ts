/**
 * In-memory sliding window rate limiter & anti-spam mechanism.
 * Uses hashed client identifier (SHA-256 of IP + User-Agent) without storing raw IP.
 */
import { createHash } from "crypto";

interface RateLimitRecord {
  timestamps: number[];
}

// Global in-memory cache for sliding window rate limiting
const rateLimitMap = new Map<string, RateLimitRecord>();

// Global idempotency cache to prevent accidental duplicate clicks (TTL 60s)
const idempotencyMap = new Map<string, { publicCode: string; expiresAt: number }>();

export function getClientHash(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}:${userAgent}:${process.env.APP_SECRET || "menfess-secret"}`)
    .digest("hex");
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Enforces rate limit: maxRequests per windowMs.
 * Defaults: 5 submissions per 10 minutes (600,000 ms).
 */
export function checkRateLimit(
  clientHash: string,
  maxRequests = 5,
  windowMs = 10 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitMap.get(clientHash) || { timestamps: [] };

  // Remove timestamps outside the sliding window
  const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientHash, { timestamps: validTimestamps });

  // Periodically clean up old entries if map grows
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.timestamps.every((ts) => ts <= windowStart)) {
        rateLimitMap.delete(key);
      }
    }
  }

  return {
    success: true,
    remaining: maxRequests - validTimestamps.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}

/**
 * Checks for duplicate submissions within a 60-second idempotency window.
 */
export function checkIdempotency(idempotencyKey: string): string | null {
  const now = Date.now();
  const existing = idempotencyMap.get(idempotencyKey);

  if (existing) {
    if (existing.expiresAt > now) {
      return existing.publicCode;
    }
    idempotencyMap.delete(idempotencyKey);
  }

  return null;
}

export function setIdempotency(idempotencyKey: string, publicCode: string, ttlMs = 60000) {
  idempotencyMap.set(idempotencyKey, {
    publicCode,
    expiresAt: Date.now() + ttlMs,
  });
}
