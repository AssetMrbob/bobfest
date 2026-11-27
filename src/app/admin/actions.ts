"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SubmissionStatus } from "@/lib/supabase/types";

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
export async function getDashboardMetrics() {
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
          statusText: "Phase 03 Prepared",
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

    // Query real database counts
    const { count: totalSubmissions } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true });

    const { count: pendingCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: needsReviewCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "needs_review");

    const { count: approvedCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: queuedCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");

    const { count: rejectedCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    const { count: publishedToday } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    return {
      isConfigured: true,
      serviceUnavailable: false,
      totalSubmissions: totalSubmissions || 0,
      queuedMessages: queuedCount || 0,
      publishedToday: publishedToday || 0,
      messagesNeedingReview: (pendingCount || 0) + (needsReviewCount || 0),
      approvedCount: approvedCount || 0,
      rejectedCount: rejectedCount || 0,
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
          connected: false,
          statusText: "Phase 03 Prepared",
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
          statusText: "Phase 03 Prepared",
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
      .select("*", { count: "exact" })
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

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      accept_submissions: acceptSubmissions,
      auto_publish_enabled: autoPublishEnabled,
    })
    .eq("id", "global");

  if (error) {
    return { error: "Failed to save settings to database." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true };
}
