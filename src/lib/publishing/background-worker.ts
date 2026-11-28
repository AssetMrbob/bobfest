import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DistributedLockManager } from "./distributed-lock";
import { evaluatePublicationSlot, reservePublicationSlot } from "./slot-manager";
import { selectNextEligibleSubmission } from "./queue-selector";
import { executeMultiPlatformPublishing } from "./multi-platform-orchestrator";
import { generateAndPersistPublicationAssets } from "@/lib/rendering/publication-asset-generator";
import { performTokenHealthAndRefresh } from "./token-maintenance";
import { performStorageMaintenance } from "./storage-maintenance";
import { recoverStaleJobs } from "./stale-job-recovery";
import { Json } from "@/lib/supabase/types";

export interface WorkerExecutionOptions {
  triggerSource?: "cron" | "manual" | "diagnostic";
  forceRunSlot?: boolean;
  dryRun?: boolean;
}

export interface WorkerExecutionSummary {
  workerId: string;
  executionTime: string;
  durationMs: number;
  automationEnabled: boolean;
  moderationMode: string;
  slotEvaluation: {
    isPublicationWindow: boolean;
    activeSlotTime: string | null;
    wibDate: string;
    nextSlotTime: string;
  };
  actionsTaken: {
    staleJobsRecovered: number;
    tokensChecked: boolean;
    storageMaintenanceRun: boolean;
    submissionsConsidered: number;
    batchCreated: boolean;
    batchId?: string;
    publishingResult?: unknown;
  };
  status: "success" | "skipped_disabled" | "locked" | "error";
  message: string;
}

/**
 * Main Background Worker Engine.
 * Executed every 5 minutes by Supabase Cron / worker endpoint.
 *
 * Safety & Reliability Rules:
 * 1. Global Deployment Safety Gate & Database Master Automation Gate.
 * 2. Fail closed unless both are enabled (except read-only diagnostic mode).
 * 3. Atomic publication slot reservations (12:00 & 19:00 WIB, max 2 posts/day).
 * 4. Distributed lock to prevent parallel worker collisions.
 * 5. Bounded, resumable steps.
 * 6. Structured heartbeat persistence in `scheduler_health`.
 */
export async function runBackgroundWorker(
  options: WorkerExecutionOptions = {}
): Promise<WorkerExecutionSummary> {
  const startTime = Date.now();
  const workerId = DistributedLockManager.getWorkerId();
  const adminClient = createAdminSupabaseClient();

  // 1. Fetch current app_settings
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  const isAutomationEnabled = settings?.master_automation_enabled === true;
  const moderationMode = settings?.moderation_mode || "ai_assisted";
  const catchupMinutes = settings?.catchup_window_minutes || 30;

  // 2. Evaluate current WIB slot
  const slotEval = evaluatePublicationSlot(new Date(), catchupMinutes);

  const summary: WorkerExecutionSummary = {
    workerId,
    executionTime: new Date().toISOString(),
    durationMs: 0,
    automationEnabled: isAutomationEnabled,
    moderationMode,
    slotEvaluation: {
      isPublicationWindow: slotEval.isPublicationWindow,
      activeSlotTime: slotEval.activeSlotTime,
      wibDate: slotEval.currentWibDate,
      nextSlotTime: `${slotEval.nextSlotDate} ${slotEval.nextSlotTime} WIB`,
    },
    actionsTaken: {
      staleJobsRecovered: 0,
      tokensChecked: false,
      storageMaintenanceRun: false,
      submissionsConsidered: 0,
      batchCreated: false,
    },
    status: "success",
    message: "Worker executed successfully.",
  };

  // Safe read-only diagnostic execution
  if (options.triggerSource === "diagnostic") {
    summary.durationMs = Date.now() - startTime;
    summary.message = "Diagnostic dry-run inspection complete.";
    return summary;
  }

  // If automation disabled and not an explicit force-run, skip publication
  if (!isAutomationEnabled && !options.forceRunSlot) {
    summary.status = "skipped_disabled";
    summary.message = "Automation is currently disabled in admin settings. No publishing performed.";

    // Still perform safe read-only stale job recovery
    const staleRep = await recoverStaleJobs();
    summary.actionsTaken.staleJobsRecovered =
      staleRep.recoveredPlatformDeliveries + staleRep.recoveredQueueJobs;

    summary.durationMs = Date.now() - startTime;
    await updateSchedulerHeartbeat(adminClient, summary);
    return summary;
  }

  // 3. Acquire Distributed Worker Lock for 240 seconds
  const lock = await DistributedLockManager.acquireLock("lock:main_worker", 240, workerId);
  if (!lock.acquired) {
    summary.status = "locked";
    summary.message = `Worker skipped: another worker (${lock.ownerId}) holds the active lease.`;
    summary.durationMs = Date.now() - startTime;
    return summary;
  }

  try {
    // Step A: Stale Job Recovery
    const staleRep = await recoverStaleJobs();
    summary.actionsTaken.staleJobsRecovered =
      staleRep.recoveredPlatformDeliveries + staleRep.recoveredQueueJobs;

    // Step B: Scheduled Maintenance checks
    // Daily Storage Maintenance (runs if WIB hour is 03 or if explicitly triggered)
    const jakartaHours = new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
    if (jakartaHours === 3 || options.triggerSource === "manual") {
      await performStorageMaintenance();
      summary.actionsTaken.storageMaintenanceRun = true;
    }

    // Daily Token Health (runs if WIB hour is 04 or if explicitly triggered)
    if (jakartaHours === 4 || options.triggerSource === "manual") {
      await performTokenHealthAndRefresh();
      summary.actionsTaken.tokensChecked = true;
    }

    // Step C: Process Retry-Pending Platform Deliveries first
    const { data: retryDeliveries } = await adminClient
      .from("platform_deliveries")
      .select("batch_id")
      .eq("status", "retry_pending")
      .lte("next_retry_at", new Date().toISOString())
      .limit(1);

    if (retryDeliveries && retryDeliveries.length > 0) {
      const retryBatchId = retryDeliveries[0].batch_id;
      const pubResult = await executeMultiPlatformPublishing({
        batchId: retryBatchId,
        dryRun: options.dryRun,
      });
      summary.actionsTaken.publishingResult = pubResult;
      summary.message = `Resumed pending retry delivery for batch ${retryBatchId}.`;
      summary.durationMs = Date.now() - startTime;
      await updateSchedulerHeartbeat(adminClient, summary);
      return summary;
    }

    // Step D: Evaluate Publication Window
    // Only start new Menfess publication if currently in an authorized slot window
    if (!slotEval.isPublicationWindow && !options.forceRunSlot) {
      summary.message = `Current time is outside publication window (Slots: 12:00 & 19:00 WIB, Catch-up: ${catchupMinutes}m). Next slot: ${summary.slotEvaluation.nextSlotTime}`;
      summary.durationMs = Date.now() - startTime;
      await updateSchedulerHeartbeat(adminClient, summary);
      return summary;
    }

    const currentSlotTime = slotEval.activeSlotTime || "12:00";

    // Step E: Select Next Approved Eligible Submission
    const selection = await selectNextEligibleSubmission(1);
    summary.actionsTaken.submissionsConsidered = selection.totalEligible;

    if (selection.eligibleSubmissions.length === 0) {
      summary.message = `Publication slot ${currentSlotTime} WIB reached, but queue has no eligible approved submissions. Slot skipped.`;
      summary.durationMs = Date.now() - startTime;
      await updateSchedulerHeartbeat(adminClient, summary);
      return summary;
    }

    const targetSub = selection.eligibleSubmissions[0];

    // Step F: Create Publication Batch
    const { data: newBatch, error: batchErr } = await adminClient
      .from("publication_batches")
      .insert({
        submission_id: targetSub.id,
        scheduled_time: new Date().toISOString(),
        status: "scheduled",
        approved_for_publishing: true,
      })
      .select()
      .single();

    if (batchErr || !newBatch) {
      throw new Error(`Failed to create publication batch: ${batchErr?.message || "Unknown error"}`);
    }

    summary.actionsTaken.batchCreated = true;
    summary.actionsTaken.batchId = newBatch.id;

    // Link publication_item
    await adminClient.from("publication_items").insert({
      batch_id: newBatch.id,
      submission_id: targetSub.id,
      slide_order: 1,
    });

    // Step G: Reserve Slot Atomically
    const slotReservation = await reservePublicationSlot({
      wibDate: slotEval.currentWibDate,
      slotTime: currentSlotTime,
      batchId: newBatch.id,
      submissionId: targetSub.id,
    });

    if (!slotReservation.success) {
      // Slot collision or daily limit reached -> cancel batch and hold
      await adminClient
        .from("publication_batches")
        .update({ status: "cancelled" })
        .eq("id", newBatch.id);

      summary.status = "error";
      summary.message = `Slot reservation denied: ${slotReservation.error}`;
      summary.durationMs = Date.now() - startTime;
      await updateSchedulerHeartbeat(adminClient, summary);
      return summary;
    }

    // Step H: Explicit Server-Side Publication Asset Generation
    // Generates, validates zero-overflow, and persists feed_asset_paths & story_asset_path
    const assetGenResult = await generateAndPersistPublicationAssets({
      submissionId: targetSub.id,
      batchId: newBatch.id,
    });

    if (!assetGenResult.success) {
      await adminClient
        .from("publication_batches")
        .update({
          status: "failed",
        })
        .eq("id", newBatch.id);

      summary.status = "error";
      summary.message = `Asset generation held: ${assetGenResult.validationError || assetGenResult.error}`;
      summary.durationMs = Date.now() - startTime;
      await updateSchedulerHeartbeat(adminClient, summary);
      return summary;
    }

    // Step I: Multi-Platform Publishing (Instagram Feed + Story, Threads Root + Reply)
    const pubResult = await executeMultiPlatformPublishing({
      batchId: newBatch.id,
      dryRun: options.dryRun,
    });

    summary.actionsTaken.publishingResult = pubResult;
    summary.message = `Publication batch ${newBatch.id} executed for slot ${currentSlotTime} WIB (${pubResult.overallStatus}).`;
  } catch (err) {
    summary.status = "error";
    summary.message = `Worker execution error: ${(err as Error).message}`;
  } finally {
    summary.durationMs = Date.now() - startTime;
    await updateSchedulerHeartbeat(adminClient, summary);
    await DistributedLockManager.releaseLock("lock:main_worker", workerId, lock.fencingToken);
  }

  return summary;
}

/**
 * Persists compact worker heartbeat and execution metrics in `scheduler_health`.
 */
async function updateSchedulerHeartbeat(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  summary: WorkerExecutionSummary
): Promise<void> {
  try {
    const isSuccess = summary.status === "success" || summary.status === "skipped_disabled";
    await adminClient
      .from("scheduler_health")
      .upsert({
        id: "global",
        last_worker_run_at: summary.executionTime,
        ...(isSuccess ? { last_successful_run_at: summary.executionTime } : {}),
        last_worker_duration_ms: summary.durationMs,
        last_worker_status: summary.status,
        last_worker_report: summary as unknown as Json,
        updated_at: new Date().toISOString(),
      });
  } catch {
    // Graceful fallback if table not yet created
  }
}
