import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface StaleJobRecoveryReport {
  recoveredPlatformDeliveries: number;
  recoveredQueueJobs: number;
  unresolvedOutcomes: number;
}

/**
 * Recovers stale leases, interrupted jobs, and detects unknown publication outcomes.
 *
 * Rules:
 * - If a lease has expired for > 10 minutes and status is 'claimed' or 'processing',
 *   reset to 'retry_pending' with incremented attempt or hold for review.
 * - Never delete jobs or assets solely because a lease expired.
 * - If publication was requested but no final ID or error was persisted,
 *   mark as 'unknown_outcome' so administrator can reconcile rather than blindly duplicating posts.
 */
export async function recoverStaleJobs(): Promise<StaleJobRecoveryReport> {
  const adminClient = createAdminSupabaseClient();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

  let recoveredDeliveries = 0;
  let recoveredQueue = 0;
  let unresolvedCount = 0;

  // 1. Recover stale platform deliveries
  const { data: staleDeliveries } = await adminClient
    .from("platform_deliveries")
    .select("id, status, attempt_count, lease_expires_at, published_media_id, container_id, last_attempt_at")
    .in("status", ["processing", "publishing", "container_created"])
    .lte("last_attempt_at", staleThreshold);

  if (staleDeliveries && staleDeliveries.length > 0) {
    for (const d of staleDeliveries) {
      if (d.status === "publishing" && !d.published_media_id) {
        // Publication was called but crashed mid-request -> mark unknown_outcome to prevent duplicate
        await adminClient
          .from("platform_deliveries")
          .update({
            status: "unknown_outcome",
            sanitized_error_code: "STALE_INTERRUPTED_PUBLICATION",
            sanitized_error_message: "Worker lease timed out during active publication request. Reconcile manually before retry.",
            updated_at: now.toISOString(),
          })
          .eq("id", d.id);
        unresolvedCount++;
      } else {
        // Container creation or processing interrupted -> mark retry_pending
        const nextAttempt = (d.attempt_count || 0) + 1;
        const backoffMinutes = Math.min(60, Math.pow(2, nextAttempt) * 5); // 10m, 20m, 40m, 60m
        const nextRetry = new Date(now.getTime() + backoffMinutes * 60 * 1000).toISOString();

        await adminClient
          .from("platform_deliveries")
          .update({
            status: nextAttempt >= 4 ? "needs_review" : "retry_pending",
            attempt_count: nextAttempt,
            next_retry_at: nextRetry,
            sanitized_error_code: "STALE_LEASE_RECOVERED",
            sanitized_error_message: `Worker lease expired. Rescheduled for attempt ${nextAttempt}`,
            updated_at: now.toISOString(),
          })
          .eq("id", d.id);
        recoveredDeliveries++;
      }
    }
  }

  // 2. Recover stale queue jobs (if table exists)
  try {
    const { data: staleQueueJobs } = await adminClient
      .from("queue_jobs")
      .select("id, attempt_count, max_attempts")
      .eq("status", "claimed")
      .lte("lease_expires_at", now.toISOString());

    if (staleQueueJobs && staleQueueJobs.length > 0) {
      for (const q of staleQueueJobs) {
        const nextAttempt = (q.attempt_count || 0) + 1;
        const max = q.max_attempts || 4;
        await adminClient
          .from("queue_jobs")
          .update({
            status: nextAttempt >= max ? "failed" : "retry_pending",
            attempt_count: nextAttempt,
            next_attempt_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
            last_error_code: "STALE_QUEUE_LEASE",
            sanitized_error_message: "Worker lease expired. Returned to queue for bounded retry.",
            updated_at: now.toISOString(),
          })
          .eq("id", q.id);
        recoveredQueue++;
      }
    }
  } catch {
    // Graceful if table not created
  }

  return {
    recoveredPlatformDeliveries: recoveredDeliveries,
    recoveredQueueJobs: recoveredQueue,
    unresolvedOutcomes: unresolvedCount,
  };
}
