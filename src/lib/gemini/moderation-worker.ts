import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { moderateContentWithGemini } from "./moderation-service";
import { ModerationMode, ModerationResult } from "./types";

const DEFAULT_DAILY_BUDGET = 50;

/**
 * Returns today's ISO date string in Asia/Jakarta timezone.
 */
function getTodayJakarta(): string {
  const now = new Date();
  // UTC + 7 hours for Asia/Jakarta
  const jakartaTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return jakartaTime.toISOString().slice(0, 10);
}

/**
 * Retrieves AI Quota usage from system_logs and app_settings.
 */
export async function getAiQuotaUsage(): Promise<{
  requestsToday: number;
  successfulRequests: number;
  failedRequests: number;
  dailyBudget: number;
  lastModelUsed: string;
  lastRequestAt: string | null;
  lastError: string | null;
}> {
  const supabase = createAdminSupabaseClient();
  const today = getTodayJakarta();
  const startOfDay = new Date(`${today}T00:00:00+07:00`).toISOString();

  // 1. Fetch daily budget from app_settings
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .single();

  const dailyBudget = (settings?.daily_ai_request_budget as number) || DEFAULT_DAILY_BUDGET;

  // 2. Query system_logs for today's AI events
  const { data: logs } = await supabase
    .from("system_logs")
    .select("*")
    .eq("event_type", "AI_MODERATION_REQUEST")
    .gte("created_at", startOfDay)
    .order("created_at", { ascending: false });

  const totalRequests = logs?.length || 0;
  const successfulRequests = logs?.filter((l) => (l.metadata as Record<string, unknown>)?.success === true).length || 0;
  const failedRequests = totalRequests - successfulRequests;
  const lastLog = logs?.[0];
  const lastMeta = (lastLog?.metadata as Record<string, unknown>) || {};

  return {
    requestsToday: totalRequests,
    successfulRequests,
    failedRequests,
    dailyBudget,
    lastModelUsed: (lastMeta.model as string) || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    lastRequestAt: lastLog?.created_at || null,
    lastError: (lastMeta.error as string) || null,
  };
}

/**
 * Processes a single submission for moderation.
 * Concurrency-safe: only transitions if current status is 'pending' and moderation_status is 'unreviewed'.
 */
export async function processSubmissionModeration(
  submissionId: string
): Promise<{ success: boolean; result?: ModerationResult; error?: string }> {
  const supabase = createAdminSupabaseClient();

  // 1. Fetch submission and check eligibility
  const { data: sub, error: subErr } = await supabase
    .from("submissions")
    .select("*, media_assets(*)")
    .eq("id", submissionId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Submission not found." };
  }

  // Idempotency: If already moderated by human or completed, do not overwrite
  if (sub.moderation_status !== "unreviewed" || sub.status !== "pending") {
    return {
      success: true,
      error: `Submission is already in status '${sub.status}' (${sub.moderation_status}).`,
    };
  }

  // 2. Fetch app_settings for moderation_mode and daily budget
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .single();

  const mode: ModerationMode = (settings?.moderation_mode as ModerationMode) || "AI_ASSISTED";
  const dailyBudget: number = (settings?.daily_ai_request_budget as number) || DEFAULT_DAILY_BUDGET;

  // If mode is MANUAL, route immediately to needs_review without calling Gemini
  if (mode === "MANUAL") {
    await supabase
      .from("submissions")
      .update({
        status: "needs_review",
        moderation_status: "manual_review_queued",
        moderation_reason: "Manual moderation mode active. Awaiting admin review.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .eq("moderation_status", "unreviewed");

    await supabase.from("moderation_logs").insert({
      submission_id: sub.id,
      previous_status: "pending",
      new_status: "needs_review",
      moderation_reason: "Manual moderation mode active.",
      decision_source: "manual_policy",
    });

    return {
      success: true,
      result: {
        decision: "needs_review",
        risk_level: "low",
        category: "manual_mode",
        reason_code: "manual_policy_active",
        short_reason: "Manual moderation mode active. Awaiting admin review.",
        detected_flags: [],
        requires_human_review: true,
        model_version: "manual_mode",
      },
    };
  }

  // 3. Check Daily Quota Budget before executing AI request
  const quota = await getAiQuotaUsage();
  if (quota.requestsToday >= dailyBudget) {
    // Budget exhausted: route safely to needs_review, never auto-approve
    const exhaustionReason = `Daily AI moderation budget (${dailyBudget}) reached. Routed to manual review.`;
    await supabase
      .from("submissions")
      .update({
        status: "needs_review",
        moderation_status: "budget_exhausted_manual",
        moderation_reason: exhaustionReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .eq("moderation_status", "unreviewed");

    await supabase.from("system_logs").insert({
      event_type: "AI_MODERATION_BUDGET_EXHAUSTED",
      severity: "warning",
      metadata: {
        submission_id: sub.id,
        requestsToday: quota.requestsToday,
        dailyBudget,
      },
    });

    return {
      success: true,
      result: {
        decision: "needs_review",
        risk_level: "low",
        category: "budget_limit",
        reason_code: "daily_ai_budget_exhausted",
        short_reason: exhaustionReason,
        detected_flags: [],
        requires_human_review: true,
        model_version: "budget_gatekeeper",
      },
    };
  }

  // 4. Atomically claim submission to prevent concurrent workers
  const { data: claimed, error: claimErr } = await supabase
    .from("submissions")
    .update({
      moderation_status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id)
    .eq("status", "pending")
    .eq("moderation_status", "unreviewed")
    .select()
    .single();

  if (claimErr || !claimed) {
    // Another worker or admin already claimed this submission
    return { success: false, error: "Submission already claimed by another worker or moderator." };
  }

  // 5. Check if submission has media attachments
  const hasMedia = Array.isArray(sub.media_assets) && sub.media_assets.some((m: { deleted_at: string | null }) => !m.deleted_at);

  // 6. Execute Gemini Moderation
  const startTime = Date.now();
  const modResult = await moderateContentWithGemini({
    message: sub.message,
    recipient: sub.recipient,
    hasMedia,
  });
  const durationMs = Date.now() - startTime;

  // 7. Determine Next Status based on Mode and AI Decision
  // Rules:
  // - SMART_AUTOMATIC: If AI decision is 'approved' AND requires_human_review is false -> 'queued'
  // - AI_ASSISTED: Always routes to 'needs_review' or 'pending' with recommendation in notes, NEVER auto-publishes
  // - Media always forces human review
  let finalStatus: "approved" | "queued" | "needs_review" | "rejected" = "needs_review";

  if (mode === "SMART_AUTOMATIC") {
    if (modResult.decision === "approved" && !modResult.requires_human_review && !hasMedia) {
      finalStatus = "queued"; // Auto-queue safe confession
    } else if (modResult.decision === "rejected") {
      finalStatus = "rejected";
    } else {
      finalStatus = "needs_review";
    }
  } else {
    // AI_ASSISTED Mode: Human review is strictly mandatory before queue/publish
    if (modResult.decision === "rejected") {
      finalStatus = "needs_review"; // Flagged for admin to confirm rejection
    } else {
      finalStatus = "needs_review"; // Recommended for admin to review and approve
    }
  }

  const moderationNote = `[AI ${modResult.decision.toUpperCase()}] ${modResult.short_reason} (${modResult.model_version})`;

  // 8. Atomically update submission status
  // Protect against manual override: Ensure admin hasn't intervened in the meantime
  const { data: updatedSub, error: updateErr } = await supabase
    .from("submissions")
    .update({
      status: finalStatus,
      moderation_status: `ai_${modResult.decision}`,
      moderation_reason: moderationNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id)
    .eq("moderation_status", "in_review") // Guarantee we only update if we still hold the lease
    .select()
    .single();

  if (updateErr || !updatedSub) {
    console.warn(`[Moderation] Admin manual intervention detected for ${sub.id}. Discarding AI overwrite.`);
    return { success: true, error: "Admin manually moderated submission during processing. Kept admin decision." };
  }

  // 9. Record Moderation Audit Log
  await supabase.from("moderation_logs").insert({
    submission_id: sub.id,
    previous_status: "pending",
    new_status: finalStatus,
    moderation_reason: moderationNote,
    decision_source: `gemini_${mode.toLowerCase()}`,
  });

  // 10. Record AI Quota Usage in system_logs
  await supabase.from("system_logs").insert({
    event_type: "AI_MODERATION_REQUEST",
    severity: modResult.decision === "rejected" ? "warning" : "info",
    metadata: {
      submission_id: sub.id,
      success: modResult.category !== "ai_error_fallback",
      model: modResult.model_version,
      decision: modResult.decision,
      risk_level: modResult.risk_level,
      category: modResult.category,
      reason_code: modResult.reason_code,
      detected_flags: modResult.detected_flags,
      durationMs,
      promptTokens: modResult.tokens_used?.prompt_tokens || 0,
      candidateTokens: modResult.tokens_used?.candidate_tokens || 0,
    },
  });

  return { success: true, result: modResult };
}

/**
 * Worker: Claims and processes pending submissions in batch.
 */
export async function runPendingModerationWorker(maxJobs: number = 5): Promise<{
  processed: number;
  results: Array<{ id: string; success: boolean }>;
}> {
  const supabase = createAdminSupabaseClient();

  // Find next eligible unreviewed submissions
  const { data: pendingList } = await supabase
    .from("submissions")
    .select("id")
    .eq("status", "pending")
    .eq("moderation_status", "unreviewed")
    .order("created_at", { ascending: true })
    .limit(maxJobs);

  if (!pendingList || pendingList.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: Array<{ id: string; success: boolean }> = [];

  for (const item of pendingList) {
    const res = await processSubmissionModeration(item.id);
    results.push({ id: item.id, success: res.success });
  }

  return {
    processed: results.length,
    results,
  };
}
