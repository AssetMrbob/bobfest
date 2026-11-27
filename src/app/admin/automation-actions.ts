"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { runBackgroundWorker } from "@/lib/publishing/background-worker";
import { performTokenHealthAndRefresh } from "@/lib/publishing/token-maintenance";
import { performStorageMaintenance } from "@/lib/publishing/storage-maintenance";
import { runAutomatedModerationBatch } from "@/lib/gemini/automated-moderation-runner";
import { evaluatePublicationSlot } from "@/lib/publishing/slot-manager";
import { getAiQuotaUsage } from "@/lib/gemini/moderation-worker";

export interface AutomationDashboardData {
  masterAutomationEnabled: boolean;
  moderationMode: "manual" | "ai_assisted" | "smart_auto";
  catchupWindowMinutes: number;
  instagramFeedEnabled: boolean;
  instagramStoryEnabled: boolean;
  threadsEnabled: boolean;
  threadsReplyEnabled: boolean;
  nextSlotTime: string;
  isPublicationWindow: boolean;
  activeSlotTime: string | null;
  lastWorkerRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastWorkerStatus: string;
  schedulerReport: unknown;
  pendingModerationCount: number;
  pendingMediaReviewCount: number;
  approvedQueueCount: number;
  retryDeliveriesCount: number;
  failedDeliveriesCount: number;
  unknownOutcomesCount: number;
  aiUsageToday: number;
  aiDailyBudget: number;
  storageUsagePercent: number;
  threadsTokenExpiry: string | null;
  threadsTokenDaysLeft?: number;
}

/**
 * Fetches real persisted data for Automation Settings & Health dashboard.
 */
export async function getAutomationStatusAction(): Promise<AutomationDashboardData> {
  const adminClient = createAdminSupabaseClient();

  // 1. App settings
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  // 2. Scheduler health
  const { data: health } = await adminClient
    .from("scheduler_health")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  // 3. Queue & moderation metrics (exclude synthetic test records)
  const { count: pendingMod } = await adminClient
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("public_code", "ilike", "TEST%");

  const { count: approvedCount } = await adminClient
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .not("public_code", "ilike", "TEST%");

  const { count: retryCount } = await adminClient
    .from("platform_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("status", "retry_pending");

  const { count: failedCount } = await adminClient
    .from("platform_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: unknownCount } = await adminClient
    .from("platform_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("status", "unknown_outcome");

  // 4. Storage ledger
  const { data: ledger } = await adminClient
    .from("storage_capacity_ledger")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  const totalBudget = ledger?.total_budget_bytes || 1_000_000_000;
  const stored = ledger?.reconciled_stored_bytes || 0;
  const reserved = ledger?.active_reserved_bytes || 0;
  const storageUsagePercent = Number((((stored + reserved) / totalBudget) * 100).toFixed(1));

  // 5. Threads token expiration
  const { data: threadsCred } = await adminClient
    .from("app_credentials")
    .select("expires_at")
    .eq("id", "threads_official")
    .maybeSingle();

  let daysRemaining: number | undefined = undefined;
  if (threadsCred?.expires_at) {
    const expiresMs = new Date(threadsCred.expires_at).getTime();
    daysRemaining = Math.max(0, Math.floor((expiresMs - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // 6. Gemini quota
  const aiQuota = await getAiQuotaUsage();

  // 7. Slot evaluation
  const slotEval = evaluatePublicationSlot(new Date(), settings?.catchup_window_minutes || 30);

  return {
    masterAutomationEnabled: settings?.master_automation_enabled === true,
    moderationMode: (settings?.moderation_mode as "manual" | "ai_assisted" | "smart_auto") || "ai_assisted",
    catchupWindowMinutes: settings?.catchup_window_minutes || 30,
    instagramFeedEnabled: settings?.instagram_feed_enabled !== false,
    instagramStoryEnabled: settings?.instagram_story_enabled !== false,
    threadsEnabled: settings?.threads_enabled !== false,
    threadsReplyEnabled: settings?.threads_reply_enabled !== false,
    nextSlotTime: `${slotEval.nextSlotDate} ${slotEval.nextSlotTime} WIB`,
    isPublicationWindow: slotEval.isPublicationWindow,
    activeSlotTime: slotEval.activeSlotTime,
    lastWorkerRunAt: health?.last_worker_run_at || null,
    lastSuccessfulRunAt: health?.last_successful_run_at || null,
    lastWorkerStatus: health?.last_worker_status || "idle",
    schedulerReport: health?.last_worker_report || null,
    pendingModerationCount: pendingMod || 0,
    pendingMediaReviewCount: 0,
    approvedQueueCount: approvedCount || 0,
    retryDeliveriesCount: retryCount || 0,
    failedDeliveriesCount: failedCount || 0,
    unknownOutcomesCount: unknownCount || 0,
    aiUsageToday: aiQuota.requestsToday,
    aiDailyBudget: aiQuota.dailyBudget,
    storageUsagePercent,
    threadsTokenExpiry: threadsCred?.expires_at || null,
    threadsTokenDaysLeft: daysRemaining,
  };
}

/**
 * Updates automation settings.
 */
export async function updateAutomationSettingsAction(data: {
  masterAutomationEnabled: boolean;
  moderationMode: "manual" | "ai_assisted" | "smart_auto";
  catchupWindowMinutes: number;
}) {
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient
    .from("app_settings")
    .update({
      master_automation_enabled: data.masterAutomationEnabled,
      moderation_mode: data.moderationMode,
      catchup_window_minutes: data.catchupWindowMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "global");

  revalidatePath("/admin/settings");
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Manual Admin Control: Run read-only worker diagnostics.
 */
export async function runWorkerDiagnosticsAction() {
  const summary = await runBackgroundWorker({
    triggerSource: "diagnostic",
    dryRun: true,
  });
  revalidatePath("/admin/settings");
  return summary;
}

/**
 * Manual Admin Control: Trigger token health & refresh check.
 */
export async function triggerTokenRefreshCheckAction() {
  const report = await performTokenHealthAndRefresh();
  revalidatePath("/admin/settings");
  return report;
}

/**
 * Manual Admin Control: Trigger storage maintenance & cleanup preview.
 */
export async function triggerStorageMaintenanceAction() {
  const report = await performStorageMaintenance();
  revalidatePath("/admin/settings");
  return report;
}

/**
 * Manual Admin Control: Process pending moderation queue.
 */
export async function triggerModerationBatchAction(maxCount: number = 5) {
  const result = await runAutomatedModerationBatch(maxCount);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/inbox");
  return result;
}
