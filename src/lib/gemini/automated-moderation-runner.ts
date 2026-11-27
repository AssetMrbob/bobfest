import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { processSubmissionModeration, getAiQuotaUsage } from "@/lib/gemini/moderation-worker";

export interface ModerationBatchResult {
  processed: number;
  approved: number;
  needsReview: number;
  rejected: number;
  skippedBudgetOrFailure: number;
  errors: string[];
}

/**
 * Executes automated moderation queue processing.
 *
 * Rules:
 * - Default mode is "ai_assisted" (admin approval remains strictly required).
 * - "smart_auto" mode:
 *   - Explicit administrator opt-in required in app_settings.
 *   - Only low-risk eligible TEXT-ONLY submissions may receive automatic approval.
 *   - Any submission with media attachments MUST be marked for human review.
 *   - Ambiguous, controversial, personal allegations, or flagged content require human review.
 * - Atomic daily budget: Max 50 Gemini requests per day.
 * - Never interpret AI failure as approval. Fail closed.
 */
export async function runAutomatedModerationBatch(maxItems: number = 5): Promise<ModerationBatchResult> {
  const adminClient = createAdminSupabaseClient();
  const result: ModerationBatchResult = {
    processed: 0,
    approved: 0,
    needsReview: 0,
    rejected: 0,
    skippedBudgetOrFailure: 0,
    errors: [],
  };

  // 1. Check app_settings for moderation mode
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("moderation_mode")
    .eq("id", "global")
    .maybeSingle();

  const moderationMode = (settings?.moderation_mode as string) || "ai_assisted";

  // 2. Check remaining AI quota
  const quota = await getAiQuotaUsage();
  const remainingBudget = Math.max(0, quota.dailyBudget - quota.requestsToday);

  if (remainingBudget <= 0) {
    result.errors.push("Daily Gemini AI moderation quota exhausted (50 requests/day). Submissions remain pending.");
    return result;
  }

  const itemsToFetch = Math.min(maxItems, remainingBudget);

  // 3. Fetch pending unreviewed submissions (excluding synthetic test submissions)
  const { data: pendingSubmissions, error: fetchErr } = await adminClient
    .from("submissions")
    .select("id, public_code, message, status, moderation_status, created_at")
    .eq("status", "pending")
    .eq("moderation_status", "unreviewed")
    .order("created_at", { ascending: true })
    .limit(itemsToFetch);

  if (fetchErr || !pendingSubmissions || pendingSubmissions.length === 0) {
    return result;
  }

  for (const sub of pendingSubmissions) {
    if (sub.public_code.toUpperCase().startsWith("TEST")) {
      continue;
    }

    try {
      // Check if submission has media attachments
      const { count: mediaCount } = await adminClient
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .eq("submission_id", sub.id);

      const hasMedia = mediaCount !== null && mediaCount > 0;

      // In smart_auto mode, media attachments STRICTLY require human review
      if (hasMedia && moderationMode === "smart_auto") {
        // Skip auto-approval, require human review
        result.needsReview++;
        continue;
      }

      const modResult = await processSubmissionModeration(sub.id);

      result.processed++;
      if (modResult.success) {
        if (modResult.result?.category === "safe") {
          result.approved++;
        } else if (modResult.result?.category === "hate_speech_harassment") {
          result.rejected++;
        } else {
          result.needsReview++;
        }
      } else {
        result.skippedBudgetOrFailure++;
        if (modResult.error) result.errors.push(modResult.error);
      }
    } catch (err) {
      result.skippedBudgetOrFailure++;
      result.errors.push(`Submission ${sub.public_code}: ${(err as Error).message}`);
    }
  }

  return result;
}
