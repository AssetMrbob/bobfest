"use server";

import { revalidatePath } from "next/cache";
import { verifyInstagramConnection, syncInstagramUsername } from "@/lib/instagram/instagram-service";
import { verifyThreadsConnection, refreshThreadsToken, syncThreadsUsername } from "@/lib/threads/threads-service";
import { executeMultiPlatformPublishing } from "@/lib/publishing/multi-platform-orchestrator";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getBrandSettings, updateBrandSettings, BrandSettings } from "@/lib/brand/brand-service";

/**
 * Tests connection to Instagram Graph API (Unified Login).
 * Read-only, no publishing.
 */
export async function testInstagramConnectionAction() {
  const result = await verifyInstagramConnection();
  return result;
}

/**
 * Synchronizes Instagram username after detected rename on platform.
 */
export async function syncInstagramUsernameAction(newUsername: string) {
  const success = await syncInstagramUsername(newUsername);
  revalidatePath("/admin/settings");
  return { success };
}

/**
 * Tests connection to official Threads API.
 * Read-only, no publishing.
 */
export async function testThreadsConnectionAction() {
  const result = await verifyThreadsConnection();
  return result;
}

/**
 * Synchronizes Threads username after detected rename on platform.
 */
export async function syncThreadsUsernameAction(newUsername: string) {
  const success = await syncThreadsUsername(newUsername);
  revalidatePath("/admin/settings");
  return { success };
}

/**
 * Gets dynamic brand settings.
 */
export async function getBrandSettingsAction() {
  return await getBrandSettings();
}

/**
 * Updates dynamic brand settings.
 */
export async function updateBrandSettingsAction(data: Partial<BrandSettings>) {
  const success = await updateBrandSettings(data);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success };
}

/**
 * Refreshes the Threads long-lived access token.
 */
export async function refreshThreadsTokenAction() {
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
