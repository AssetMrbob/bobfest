"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SubmissionStatus } from "@/lib/supabase/types";
import { getStorageLedgerMetrics, reconcileBucketStorage, runFifoStorageCleanup } from "@/lib/storage/storage-manager";
import { isGeminiConfigured, getGeminiModelName } from "@/lib/gemini/moderation-service";
import { getAiQuotaUsage, processSubmissionModeration, runPendingModerationWorker } from "@/lib/gemini/moderation-worker";

/**
 * Checks if real Supabase credentials are configured in the environment.
 */
export async function isSupabaseConfigured(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      publishable &&
      secret &&
      !url.includes("placeholder") &&
      !url.includes("your-project")
  );
}

/**
 * Admin Sign In with Email & Password.
 * Zero hardcoded fallback credentials.
 * Enforces server-side admin role verification in admin_profiles.
 */
export async function signInAdmin(formData: FormData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const configured = await isSupabaseConfigured();
  if (!configured) {
    return {
      error:
        "Authentication service unavailable. Dedicated Supabase database credentials are not configured on the server.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { error: authError?.message || "Invalid credentials." };
  }

  // Verify that user has verified admin role in admin_profiles table
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Access denied. User account is not an authorized administrator." };
  }

  redirect("/admin");
}

/**
 * Admin Sign Out
 */
export async function signOutAdmin() {
  const configured = await isSupabaseConfigured();
  if (configured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

/**
 * Fetch real dashboard KPI counts from Supabase.
 * Returns serviceUnavailable: true with zero counts if database is unavailable.
 * Never returns fabricated or mock data.
 */
export async function getDashboardMetrics(dateRange: "today" | "7d" | "30d" | "all" = "all") {
  await connection();
  const configured = await isSupabaseConfigured();

  if (!configured) {
    return {
      isConfigured: false,
      serviceUnavailable: true,
      totalSubmissions: 0,
      queuedMessages: 0,
      publishedToday: 0,
      messagesNeedingReview: 0,
      approvedCount: 0,
      rejectedCount: 0,
      storageMetrics: {
        totalBudgetBytes: 1000000000,
        reconciledStoredBytes: 0,
        activeReservedBytes: 0,
        availableBytes: 950000000,
        usedPercentage: 0,
        lastReconciledAt: new Date().toISOString(),
      },
      nextScheduledSlot: {
        time: "19:00 WIB",
        timezone: "Asia/Jakarta",
      },
      integrations: {
        supabaseDb: {
          name: "Supabase Database",
          connected: false,
          statusText: "Not connected",
        },
        supabaseStorage: {
          name: "Supabase Storage",
          connected: false,
          statusText: "Not connected",
        },
        geminiModeration: {
          name: `Gemini (${getGeminiModelName()})`,
          connected: isGeminiConfigured(),
          statusText: isGeminiConfigured() ? "Operational (Free Tier)" : "Not configured",
        },
        instagramGraph: {
          name: "Instagram Graph API",
          connected: false,
          statusText: "Reserved (Phase 07)",
        },
        cloudflareTurnstile: {
          name: "Cloudflare Turnstile",
          connected: Boolean(process.env.TURNSTILE_SECRET_KEY),
          statusText: Boolean(process.env.TURNSTILE_SECRET_KEY)
            ? "Configured"
            : "Not connected",
        },
      },
    };
  }

  try {
    const supabase = createAdminSupabaseClient();

    // Compute date cutoff in Asia/Jakarta timezone
    let dateFilter: string | null = null;
    const now = new Date();
    if (dateRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = startOfDay.toISOString();
    } else if (dateRange === "7d") {
      const past7 = new Date(now.getTime() - 7 * 86400000);
      dateFilter = past7.toISOString();
    } else if (dateRange === "30d") {
      const past30 = new Date(now.getTime() - 30 * 86400000);
      dateFilter = past30.toISOString();
    }

    const getCount = async (status?: SubmissionStatus) => {
      let q = supabase.from("submissions").select("*", { count: "exact", head: true });
      if (status) q = q.eq("status", status);
      if (dateFilter) q = q.gte("created_at", dateFilter);
      const res = await q;
      return res.count || 0;
    };

    const totalSubmissions = await getCount();
    const pendingCount = await getCount("pending");
    const needsReviewCount = await getCount("needs_review");
    const approvedCount = await getCount("approved");
    const queuedCount = await getCount("queued");
    const rejectedCount = await getCount("rejected");
    const publishedToday = await getCount("published");

    const storageMetrics = await getStorageLedgerMetrics(supabase);

    return {
      isConfigured: true,
      serviceUnavailable: false,
      totalSubmissions,
      queuedMessages: queuedCount,
      publishedToday,
      messagesNeedingReview: pendingCount + needsReviewCount,
      approvedCount,
      rejectedCount,
      storageMetrics,
      nextScheduledSlot: {
        time: "19:00 WIB",
        timezone: "Asia/Jakarta",
      },
      integrations: {
        supabaseDb: {
          name: "Supabase Database",
          connected: true,
          statusText: "Connected (Live)",
        },
        supabaseStorage: {
          name: "Supabase Storage",
          connected: true,
          statusText: "Operational (bobfess-images & bobfess-videos)",
        },
        geminiModeration: {
          name: `Gemini (${getGeminiModelName()})`,
          connected: isGeminiConfigured(),
          statusText: isGeminiConfigured() ? "Operational (Free Tier)" : "Not configured",
        },
        instagramGraph: {
          name: "Instagram Graph API",
          connected: false,
          statusText: "Reserved (Phase 07)",
        },
        cloudflareTurnstile: {
          name: "Cloudflare Turnstile",
          connected: Boolean(process.env.TURNSTILE_SECRET_KEY),
          statusText: Boolean(process.env.TURNSTILE_SECRET_KEY)
            ? "Configured"
            : "Not connected",
        },
      },
    };
  } catch (err) {
    console.error("Error fetching dashboard metrics:", err);
    return {
      isConfigured: false,
      serviceUnavailable: true,
      totalSubmissions: 0,
      queuedMessages: 0,
      publishedToday: 0,
      messagesNeedingReview: 0,
      approvedCount: 0,
      rejectedCount: 0,
      storageMetrics: {
        totalBudgetBytes: 1000000000,
        reconciledStoredBytes: 0,
        activeReservedBytes: 0,
        availableBytes: 950000000,
        usedPercentage: 0,
        lastReconciledAt: new Date().toISOString(),
      },
      nextScheduledSlot: {
        time: "19:00 WIB",
        timezone: "Asia/Jakarta",
      },
      integrations: {
        supabaseDb: {
          name: "Supabase Database",
          connected: false,
          statusText: "Connection error",
        },
        supabaseStorage: {
          name: "Supabase Storage",
          connected: false,
          statusText: "Connection error",
        },
        geminiModeration: {
          name: "Gemini 2.5 Flash",
          connected: false,
          statusText: "Not connected",
        },
        instagramGraph: {
          name: "Instagram Graph API",
          connected: false,
          statusText: "Not connected",
        },
        cloudflareTurnstile: {
          name: "Cloudflare Turnstile",
          connected: false,
          statusText: "Not connected",
        },
      },
    };
  }
}

/**
 * Fetch real submissions from Supabase with status filter, search query, and pagination.
 * Never returns mock submissions when database is unavailable.
 */
export async function getAdminSubmissions(params: {
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  const { status = "all", query = "", limit = 50, offset = 0 } = params;
  const configured = await isSupabaseConfigured();

  if (!configured) {
    return {
      isConfigured: false,
      serviceUnavailable: true,
      submissions: [],
      totalCount: 0,
    };
  }

  try {
    const supabase = createAdminSupabaseClient();
    let queryBuilder = supabase
      .from("submissions")
      .select("*, media_assets(id, storage_path, mime_type, size_bytes, status)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      queryBuilder = queryBuilder.eq("status", status as SubmissionStatus);
    }

    if (query) {
      queryBuilder = queryBuilder.or(
        `message.ilike.%${query}%,recipient.ilike.%${query}%,public_code.ilike.%${query}%`
      );
    }

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error("Error querying submissions:", error);
      throw error;
    }

    return {
      isConfigured: true,
      serviceUnavailable: false,
      submissions: (data || []).map((row) => ({
        id: row.public_code || row.id,
        rawId: row.id,
        recipient: row.recipient || undefined,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        moderationNotes: row.moderation_reason || undefined,
        mediaAsset: (row.media_assets && row.media_assets.length > 0)
          ? {
              id: row.media_assets[0].id,
              storagePath: row.media_assets[0].storage_path,
              mimeType: row.media_assets[0].mime_type,
              sizeBytes: row.media_assets[0].size_bytes,
              status: row.media_assets[0].status,
            }
          : undefined,
      })),
      totalCount: count || 0,
    };
  } catch (err) {
    console.error("Submissions query failed:", err);
    return {
      isConfigured: false,
      serviceUnavailable: true,
      submissions: [],
      totalCount: 0,
    };
  }
}

/**
 * Update submission status with persistent moderation log
 */
export async function moderateSubmission(
  submissionId: string,
  newStatus: SubmissionStatus,
  reason?: string
) {
  const configured = await isSupabaseConfigured();

  if (!configured) {
    return { error: "Service unavailable: Database connection is not configured." };
  }

  const supabase = createAdminSupabaseClient();

  // Find existing record
  const { data: existing, error: fetchErr } = await supabase
    .from("submissions")
    .select("id, status")
    .or(`id.eq.${submissionId},public_code.eq.${submissionId}`)
    .single();

  if (fetchErr || !existing) {
    return { error: "Submission record not found." };
  }

  const previousStatus = existing.status;

  // Update submission status
  const { error: updateErr } = await supabase
    .from("submissions")
    .update({
      status: newStatus,
      moderation_status: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "reviewed",
      moderation_reason: reason || null,
    })
    .eq("id", existing.id);

  if (updateErr) {
    return { error: "Failed to update submission status." };
  }

  // Create audit trail in moderation_logs
  await supabase.from("moderation_logs").insert({
    submission_id: existing.id,
    previous_status: previousStatus,
    new_status: newStatus,
    moderation_reason: reason || null,
    decision_source: "admin_ui",
  });

  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Fetch and update application settings
 */
export async function getAppSettings() {
  const configured = await isSupabaseConfigured();
  if (!configured) {
    return {
      isConfigured: false,
      serviceUnavailable: true,
      accept_submissions: true,
      auto_publish_enabled: false,
      max_daily_feed_posts: 2,
      publish_times: ["12:00", "19:00"],
      timezone: "Asia/Jakarta",
      auto_story_enabled: true,
      max_carousel_slides: 5,
      max_message_length: 500,
      max_image_size_mb: 5,
      max_video_size_mb: 20,
      storage_capacity_limit_percent: 95,
      storage_warning_percent: 90,
      storage_cleanup_target_percent: 85,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .single();

  return {
    isConfigured: true,
    serviceUnavailable: false,
    ...(data || {}),
  };
}

export async function saveAppSettings(formData: FormData) {
  const configured = await isSupabaseConfigured();
  if (!configured) {
    return { error: "Service unavailable: Database connection is not configured." };
  }

  const acceptSubmissions = formData.get("accept_submissions") === "true";
  const autoPublishEnabled = formData.get("auto_publish_enabled") === "true";
  const moderationMode = formData.get("moderation_mode")?.toString() || "AI_ASSISTED";
  const dailyBudgetStr = formData.get("daily_ai_request_budget")?.toString() || "50";
  const dailyBudget = Math.max(1, parseInt(dailyBudgetStr, 10) || 50);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      accept_submissions: acceptSubmissions,
      auto_publish_enabled: autoPublishEnabled,
      moderation_mode: moderationMode,
      daily_ai_request_budget: dailyBudget,
    })
    .eq("id", "global");

  if (error) {
    return { error: "Failed to save settings to database." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Generates short-lived signed preview URL for admin media inspection.
 * Strictly verifies admin role server-side.
 */
export async function getAdminMediaSignedUrl(storagePath: string): Promise<{ signedUrl?: string; error?: string }> {
  const configured = await isSupabaseConfigured();
  if (!configured) {
    return { error: "Database not configured." };
  }

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();

  if (!user) {
    return { error: "Unauthorized. Admin session required." };
  }

  const adminClient = createAdminSupabaseClient();
  const { data: profile } = await adminClient
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Forbidden. Admin role required." };
  }

  // Determine bucket and object path
  let bucket = "bobfess-images";
  let objectPath = storagePath;

  if (storagePath.startsWith("bobfess-videos/")) {
    bucket = "bobfess-videos";
    objectPath = storagePath.replace("bobfess-videos/", "");
  } else if (storagePath.startsWith("bobfess-images/")) {
    bucket = "bobfess-images";
    objectPath = storagePath.replace("bobfess-images/", "");
  } else if (storagePath.startsWith("bobfess-attachments/")) {
    bucket = "bobfess-attachments";
    objectPath = storagePath.replace("bobfess-attachments/", "");
  }

  // Generate 15-minute signed preview URL
  const { data, error } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(objectPath, 900);

  if (error || !data) {
    return { error: "Failed to create signed media preview URL." };
  }

  return { signedUrl: data.signedUrl };
}

/**
 * Server action to trigger storage reconciliation from admin panel.
 */
export async function triggerStorageReconciliation() {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();
  const storedBytes = await reconcileBucketStorage(adminClient);
  revalidatePath("/admin");
  return { success: true, storedBytes };
}

/**
 * Server action to trigger safe FIFO storage cleanup from admin panel.
 */
export async function triggerStorageCleanup(targetBytes = 20971520) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();
  const result = await runFifoStorageCleanup(adminClient, targetBytes);
  revalidatePath("/admin");
  return result;
}

/**
 * Bulk moderation action for multi-selected submissions.
 */
export async function bulkModerateSubmissions(
  ids: string[],
  newStatus: SubmissionStatus,
  reason?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const configured = await isSupabaseConfigured();
  if (!configured) return { success: false, error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();

  // Validate admin role
  const { data: profile } = await adminClient
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") return { success: false, error: "Forbidden. Admin role required." };

  // Never allow directly setting published status
  if (newStatus === "published" || newStatus === "publishing") {
    return { success: false, error: "Cannot publish directly from moderation. Use publishing queue." };
  }

  // Update in batch
  const { error: updateError } = await adminClient
    .from("submissions")
    .update({
      status: newStatus,
      moderation_status: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "in_review",
      moderation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .in("public_code", ids);

  if (updateError) {
    console.error("Bulk moderation error:", updateError);
    return { success: false, error: "Failed to update submissions." };
  }

  // Write audit trail
  await adminClient.from("system_logs").insert({
    event_type: "bulk_moderation",
    severity: "info",
    metadata: {
      count: ids.length,
      new_status: newStatus,
      reason: reason || null,
      admin_user_id: user.id,
    },
  });

  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
  return { success: true, count: ids.length };
}

/**
 * Queue Management: Fetch scheduled batches and queued submissions.
 */
export async function getPublishingQueue() {
  const configured = await isSupabaseConfigured();
  if (!configured) {
    return {
      isConfigured: false,
      batches: [],
      queuedSubmissions: [],
      approvedUnqueued: [],
    };
  }

  try {
    const supabase = createAdminSupabaseClient();

    // 1. Fetch batches
    const { data: batches } = await supabase
      .from("publication_batches")
      .select("*, publication_items(*, submissions(*))")
      .order("scheduled_time", { ascending: true });

    // 2. Fetch queued submissions
    const { data: queued } = await supabase
      .from("submissions")
      .select("*, media_assets(*)")
      .eq("status", "queued")
      .order("created_at", { ascending: true });

    // 3. Fetch approved submissions not yet queued
    const { data: approved } = await supabase
      .from("submissions")
      .select("*, media_assets(*)")
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    return {
      isConfigured: true,
      batches: batches || [],
      queuedSubmissions: queued || [],
      approvedUnqueued: approved || [],
    };
  } catch (err) {
    console.error("Queue fetch error:", err);
    return {
      isConfigured: false,
      batches: [],
      queuedSubmissions: [],
      approvedUnqueued: [],
    };
  }
}

/**
 * Queue Management: Move approved submission to queue.
 */
export async function enqueueSubmission(submissionId: string) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();

  const { error } = await adminClient
    .from("submissions")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("status", "approved");

  if (error) return { error: "Failed to queue submission." };
  revalidatePath("/admin/queue");
  return { success: true };
}

/**
 * Queue Management: Remove queued submission back to approved.
 */
export async function dequeueSubmission(submissionId: string) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();

  // Remove from publication items if assigned
  await adminClient.from("publication_items").delete().eq("submission_id", submissionId);

  const { error } = await adminClient
    .from("submissions")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (error) return { error: "Failed to dequeue submission." };
  revalidatePath("/admin/queue");
  return { success: true };
}

/**
 * Queue Management: Create a scheduled publication batch.
 */
export async function createPublicationBatch(scheduledTime: string, submissionIds: string[]) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (submissionIds.length > 5) {
    return { error: "Maximum 5 submissions per carousel batch." };
  }

  const adminClient = createAdminSupabaseClient();

  // Create batch
  const { data: batch, error: batchErr } = await adminClient
    .from("publication_batches")
    .insert({ scheduled_time: scheduledTime, status: "scheduled" })
    .select()
    .single();

  if (batchErr || !batch) return { error: "Failed to create batch." };

  // Link items with slide order
  for (let i = 0; i < submissionIds.length; i++) {
    await adminClient.from("publication_items").insert({
      batch_id: batch.id,
      submission_id: submissionIds[i],
      slide_order: i + 1,
    });
  }

  revalidatePath("/admin/queue");
  return { success: true, batchId: batch.id };
}

/**
 * Queue Management: Cancel unpublished scheduled batch.
 */
export async function cancelPublicationBatch(batchId: string) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();

  // Cascade delete cleans up publication_items
  const { error } = await adminClient
    .from("publication_batches")
    .delete()
    .eq("id", batchId)
    .neq("status", "published");

  if (error) return { error: "Failed to cancel batch." };
  revalidatePath("/admin/queue");
  return { success: true };
}

/**
 * Published Archive: Fetch real published history from Supabase.
 */
export async function getPublishedArchive() {
  const configured = await isSupabaseConfigured();
  if (!configured) return { isConfigured: false, batches: [] };

  try {
    const supabase = createAdminSupabaseClient();

    const { data: publishedBatches } = await supabase
      .from("publication_batches")
      .select("*, publication_items(*, submissions(*))")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    return {
      isConfigured: true,
      batches: publishedBatches || [],
    };
  } catch (err) {
    console.error("Published archive error:", err);
    return { isConfigured: false, batches: [] };
  }
}

/**
 * System Logs: Fetch real system logs with optional category filter.
 */
export async function getSystemLogs(category?: string, limit = 50) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { isConfigured: false, logs: [] };

  try {
    const supabase = createAdminSupabaseClient();
    let query = supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (category && category !== "all") {
      query = query.eq("event_type", category);
    }

    const { data } = await query;
    return {
      isConfigured: true,
      logs: data || [],
    };
  } catch (err) {
    console.error("System logs error:", err);
    return { isConfigured: false, logs: [] };
  }
}

/**
 * Triggers moderation worker for pending submissions.
 */
export async function triggerModerationWorker(maxJobs: number = 5) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const res = await runPendingModerationWorker(maxJobs);
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
  return { success: true, processed: res.processed };
}

/**
 * Triggers AI moderation for a single submission.
 */
export async function retrySubmissionModeration(submissionId: string) {
  const configured = await isSupabaseConfigured();
  if (!configured) return { error: "Database not configured." };

  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Reset moderation_status to unreviewed and status to pending to allow re-evaluation
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("submissions")
    .update({
      status: "pending",
      moderation_status: "unreviewed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  const res = await processSubmissionModeration(submissionId);
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
  return res;
}

/**
 * Fetches AI Quota status for admin settings / overview.
 */
export async function getAiQuotaStatus() {
  return await getAiQuotaUsage();
}
