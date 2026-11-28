"use server";

import { assertAdminSession } from "@/lib/security/admin-auth";

import { revalidatePath } from "next/cache";
import { verifyInstagramConnection, syncInstagramUsername } from "@/lib/instagram/instagram-service";
import { verifyThreadsConnection, refreshThreadsToken, syncThreadsUsername } from "@/lib/threads/threads-service";
import { executeMultiPlatformPublishing } from "@/lib/publishing/multi-platform-orchestrator";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getBrandSettings, updateBrandSettings, BrandSettings } from "@/lib/brand/brand-service";
import { formatThreadsPayload } from "@/lib/threads/threads-formatter";

/**
 * Tests connection to Instagram Graph API (Unified Login).
 * Read-only, no publishing.
 */
export async function testInstagramConnectionAction() {
  await assertAdminSession();
  const result = await verifyInstagramConnection();
  return result;
}

/**
 * Synchronizes Instagram username after detected rename on platform.
 */
export async function syncInstagramUsernameAction(newUsername: string) {
  await assertAdminSession();
  const success = await syncInstagramUsername(newUsername);
  revalidatePath("/admin/settings");
  return { success };
}

/**
 * Tests connection to official Threads API.
 * Read-only, no publishing.
 */
export async function testThreadsConnectionAction() {
  await assertAdminSession();
  const result = await verifyThreadsConnection();
  return result;
}

/**
 * Synchronizes Threads username after detected rename on platform.
 */
export async function syncThreadsUsernameAction(newUsername: string) {
  await assertAdminSession();
  const success = await syncThreadsUsername(newUsername);
  revalidatePath("/admin/settings");
  return { success };
}

/**
 * Gets dynamic brand settings.
 */
export async function getBrandSettingsAction() {
  await assertAdminSession();
  return await getBrandSettings();
}

/**
 * Updates dynamic brand settings.
 */
export async function updateBrandSettingsAction(data: Partial<BrandSettings>) {
  await assertAdminSession();
  const success = await updateBrandSettings(data);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success };
}

/**
 * Refreshes the Threads long-lived access token.
 */
export async function refreshThreadsTokenAction() {
  await assertAdminSession();
  const result = await refreshThreadsToken();
  revalidatePath("/admin/settings");
  return result;
}

/**
 * Updates multi-platform publishing settings.
 */
export async function updateSocialSettingsAction(data: {
  instagramFeedEnabled: boolean;
  instagramStoryEnabled: boolean;
  threadsEnabled: boolean;
  threadsReplyEnabled: boolean;
  threadsPrefix: string;
  threadsSuffix: string;
  threadsShowRefCode: boolean;
}) {
  await assertAdminSession();
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient.from("app_settings").update({
    instagram_feed_enabled: data.instagramFeedEnabled,
    instagram_story_enabled: data.instagramStoryEnabled && data.instagramFeedEnabled,
    threads_enabled: data.threadsEnabled,
    threads_reply_enabled: data.threadsReplyEnabled,
    threads_prefix: data.threadsPrefix,
    threads_suffix: data.threadsSuffix,
    threads_show_ref_code: data.threadsShowRefCode,
  }).eq("id", "global");

  revalidatePath("/admin/settings");
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Runs a dry-run test of multi-platform payload preparation and validation.
 */
export async function dryRunPublishBatchAction(batchId: string) {
  await assertAdminSession();
  try {
    const report = await executeMultiPlatformPublishing({
      batchId,
      dryRun: true,
    });
    return { success: true, report };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Generates an accurate preview of the Threads payload for a scheduled batch.
 * Guarantees exact match with the actual publishing payload by using
 * formatThreadsPayload.
 */
export async function previewBatchThreadsPayloadAction(batchId: string) {
  await assertAdminSession();
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: batch, error: bErr } = await adminClient
      .from("publication_batches")
      .select("id, submission_id")
      .eq("id", batchId)
      .single();

    if (bErr || !batch?.submission_id) {
      return { error: "Batch or submission not found." };
    }

    const { data: submission } = await adminClient
      .from("submissions")
      .select("id, public_code, message")
      .eq("id", batch.submission_id)
      .single();

    if (!submission) {
      return { error: "Submission not found." };
    }

    const { data: slides } = await adminClient
      .from("submission_slides")
      .select("slide_order, message")
      .eq("submission_id", submission.id)
      .order("slide_order", { ascending: true })
      .limit(2);

    const { data: settings } = await adminClient
      .from("app_settings")
      .select("threads_prefix, threads_suffix, threads_show_ref_code")
      .eq("id", "global")
      .maybeSingle();

    const payload = formatThreadsPayload({
      submission,
      slides: slides || null,
      settings: {
        threadsPrefix: settings?.threads_prefix,
        threadsSuffix: settings?.threads_suffix,
        threadsShowRefCode: settings?.threads_show_ref_code,
      },
    });

    return { success: true, payload, preview: payload, publicCode: submission.public_code };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export const getThreadsBatchPreviewAction = previewBatchThreadsPayloadAction;

/**
 * Previews formatted Threads payload for arbitrary sample text and custom settings.
 */
export async function previewCustomThreadsPayloadAction(params: {
  message: string;
  slide2Message?: string;
  publicCode?: string;
  prefix?: string;
  suffix?: string;
  showRefCode?: boolean;
}) {
  await assertAdminSession();
  const payload = formatThreadsPayload({
    submission: {
      public_code: params.publicCode || "KI-SAMPLE",
      message: params.message,
    },
    slides: params.slide2Message
      ? [
          { slide_order: 1, message: params.message },
          { slide_order: 2, message: params.slide2Message },
        ]
      : [{ slide_order: 1, message: params.message }],
    settings: {
      threadsPrefix: params.prefix,
      threadsSuffix: params.suffix,
      threadsShowRefCode: params.showRefCode,
    },
  });

  return { success: true, payload };
}
