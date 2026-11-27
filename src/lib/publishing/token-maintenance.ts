import { DistributedLockManager } from "./distributed-lock";
import { verifyThreadsConnection, refreshThreadsToken } from "@/lib/threads/threads-service";
import { verifyInstagramConnection } from "@/lib/instagram/instagram-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface TokenHealthReport {
  instagram: {
    status: "connected" | "expired" | "revoked" | "error" | "unverified";
    username?: string;
    error?: string;
  };
  threads: {
    status: "connected" | "expired" | "revoked" | "error" | "unverified";
    username?: string;
    expiresAt?: string | null;
    daysRemaining?: number;
    urgency: "healthy" | "warn_14_days" | "critical_7_days" | "expired";
    error?: string;
  };
  refreshedThreads: boolean;
}

/**
 * Checks Meta tokens health and performs distributed-safe auto-refresh for Threads.
 * Runs on distributed lock `lock:token_refresh` to prevent concurrent refresh across workers.
 */
export async function performTokenHealthAndRefresh(): Promise<TokenHealthReport> {
  const adminClient = createAdminSupabaseClient();
  const workerId = DistributedLockManager.getWorkerId();

  let refreshedThreads = false;

  // 1. Instagram Health Check (Unified Login token - non-expiring long-lived page token)
  const igResult = await verifyInstagramConnection();
  const igStatus: TokenHealthReport["instagram"] = {
    status: igResult.status === "connected" ? "connected" : "error",
    username: igResult.username,
    error: igResult.error,
  };

  // 2. Threads Health Check & Refresh with Distributed Lock
  const threadsHealth = await verifyThreadsConnection();
  let threadsUrgency: TokenHealthReport["threads"]["urgency"] = "healthy";
  let daysRemaining: number | undefined = undefined;

  // Query app_credentials for Threads expiration
  const { data: cred } = await adminClient
    .from("app_credentials")
    .select("expires_at, last_refreshed_at")
    .eq("id", "threads_official")
    .maybeSingle();

  if (cred?.expires_at) {
    const expiresMs = new Date(cred.expires_at).getTime();
    const nowMs = Date.now();
    const diffDays = Math.floor((expiresMs - nowMs) / (1000 * 60 * 60 * 24));
    daysRemaining = diffDays;

    if (diffDays <= 0) {
      threadsUrgency = "expired";
    } else if (diffDays <= 7) {
      threadsUrgency = "critical_7_days";
    } else if (diffDays <= 14) {
      threadsUrgency = "warn_14_days";
    }
  }

  // Auto-refresh Threads token if <= 30 days remaining or older than 30 days since refresh
  const shouldRefresh = daysRemaining !== undefined && daysRemaining <= 30;

  if (shouldRefresh) {
    // Acquire distributed lock for 120 seconds
    const lock = await DistributedLockManager.acquireLock("lock:token_refresh", 120, workerId);
    if (lock.acquired) {
      try {
        const refreshRes = await refreshThreadsToken();
        if (refreshRes.success) {
          refreshedThreads = true;
          threadsUrgency = "healthy";
        }
      } finally {
        await DistributedLockManager.releaseLock("lock:token_refresh", workerId, lock.fencingToken);
      }
    }
  }

  // Update scheduler_health record
  try {
    const { error: healthErr } = await adminClient
      .from("scheduler_health")
      .update({
        last_token_check_at: new Date().toISOString(),
        ...(refreshedThreads ? { last_token_refresh_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");

    if (healthErr) {
      console.warn("[TokenMaintenance] Could not update scheduler_health:", healthErr.message);
    }
  } catch {
    // Graceful if table not created
  }

  return {
    instagram: igStatus,
    threads: {
      status: threadsHealth.status === "connected" ? "connected" : "error",
      username: threadsHealth.username,
      expiresAt: cred?.expires_at || null,
      daysRemaining,
      urgency: threadsUrgency,
      error: threadsHealth.error,
    },
    refreshedThreads,
  };
}
