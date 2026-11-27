import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createSingleImageFeedContainer,
  createCarouselFeedContainer,
  createStoryContainer,
  publishInstagramContainer,
} from "@/lib/instagram/instagram-service";
import {
  createThreadsContainer,
  publishThreadsContainer,
} from "@/lib/threads/threads-service";
// Helper to generate signed download URL for Meta server ingestion
async function getSignedMediaUrl(bucket: string, path: string, expiresInSec: number = 3600): Promise<string | null> {
  const adminClient = createAdminSupabaseClient();
  const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export interface DeliveryResult {
  platform: "instagram" | "threads";
  publicationType: "feed" | "story" | "threads_main" | "threads_reply";
  status: "published" | "failed" | "skipped";
  mediaId?: string;
  permalink?: string;
  error?: string;
}

export interface PlatformPublishingReport {
  batchId: string;
  submissionId: string;
  deliveries: DeliveryResult[];
  overallStatus: "completed" | "partial" | "failed";
}

/**
 * Orchestrates multi-platform publication for an approved publication batch.
 *
 * Rules:
 * 1. Independent tracking: A failure in Threads does not block or redo Instagram.
 * 2. Instagram: Feed MUST succeed before Story is attempted.
 * 3. Threads: Slide 1 (main) MUST succeed before Slide 2 (continuation reply) is attempted.
 * 4. Strictly 1 Menfess = 1 Instagram publication (never mix submissions).
 * 5. Dry-run safety: Can generate payloads and verify without posting live.
 */
export async function executeMultiPlatformPublishing(params: {
  batchId: string;
  dryRun?: boolean;
}): Promise<PlatformPublishingReport> {
  const adminClient = createAdminSupabaseClient();
  const deliveries: DeliveryResult[] = [];

  // 1. Fetch batch, submission, and slides
  const { data: batch, error: bErr } = await adminClient
    .from("publication_batches")
    .select(`
      id,
      submission_id,
      feed_asset_paths,
      story_asset_path,
      caption,
      approved_for_publishing
    `)
    .eq("id", params.batchId)
    .single();

  if (bErr || !batch || !batch.submission_id) {
    throw new Error(`Batch not found or missing submission_id: ${bErr?.message || "Invalid batch"}`);
  }

  const { data: submission } = await adminClient
    .from("submissions")
    .select(`
      id,
      public_code,
      message,
      recipient
    `)
    .eq("id", batch.submission_id)
    .single();

  if (!submission) {
    throw new Error(`Submission not found for batch ${params.batchId}`);
  }

  // Fetch ordered slides
  const { data: slides } = await adminClient
    .from("submission_slides")
    .select("*")
    .eq("submission_id", submission.id)
    .order("slide_order", { ascending: true });

  const slideList: Array<{ slide_order: number; message: string }> =
    slides && slides.length > 0
      ? slides.map((s) => ({ slide_order: s.slide_order, message: s.message }))
      : [{ slide_order: 1, message: submission.message }];

  // 2. Read App Settings for channel enablement
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .single();

  const igFeedEnabled = settings?.instagram_feed_enabled !== false;
  const igStoryEnabled = settings?.instagram_story_enabled !== false && igFeedEnabled;
  const threadsEnabled = settings?.threads_enabled !== false;
  const threadsReplyEnabled = settings?.threads_reply_enabled !== false;

  // 3. Instagram Publication Pipeline
  let igFeedSuccess = false;

  if (igFeedEnabled && batch.feed_asset_paths && batch.feed_asset_paths.length > 0) {
    if (params.dryRun) {
      deliveries.push({
        platform: "instagram",
        publicationType: "feed",
        status: "published",
        mediaId: "dry_run_feed_id",
        permalink: "https://instagram.com/p/dry_run",
      });
      igFeedSuccess = true;
    } else {
      try {
        // Generate signed URLs (1 hour validity for Meta fetching)
        const signedUrls: string[] = [];
        for (const path of batch.feed_asset_paths) {
          const sUrl = await getSignedMediaUrl("bobfess-published", path, 3600);
          if (!sUrl) throw new Error(`Failed to generate signed URL for asset: ${path}`);
          signedUrls.push(sUrl);
        }

        const caption = batch.caption || `#KampungInggrisFess #${submission.public_code}`;
        let containerRes: { containerId?: string; error?: string };

        if (signedUrls.length === 1) {
          containerRes = await createSingleImageFeedContainer(signedUrls[0], caption);
        } else {
          containerRes = await createCarouselFeedContainer([signedUrls[0], signedUrls[1]], caption);
        }

        if (containerRes.error || !containerRes.containerId) {
          throw new Error(containerRes.error || "Failed to create feed container");
        }

        const pubRes = await publishInstagramContainer(containerRes.containerId);
        if (pubRes.error || !pubRes.publishedMediaId) {
          throw new Error(pubRes.error || "Failed to publish feed container");
        }

        deliveries.push({
          platform: "instagram",
          publicationType: "feed",
          status: "published",
          mediaId: pubRes.publishedMediaId,
          permalink: pubRes.permalink,
        });
        igFeedSuccess = true;

        // Update batch permalink and status
        await adminClient.from("publication_batches").update({
          carousel_container_id: containerRes.containerId,
          permalink: pubRes.permalink || null,
          status: "published",
          published_at: new Date().toISOString(),
        }).eq("id", batch.id);

      } catch (err) {
        deliveries.push({
          platform: "instagram",
          publicationType: "feed",
          status: "failed",
          error: (err as Error).message,
        });
      }
    }
  }

  // Instagram Story (Only after Feed succeeds)
  if (igStoryEnabled && batch.story_asset_path) {
    if (!igFeedSuccess && !params.dryRun) {
      deliveries.push({
        platform: "instagram",
        publicationType: "story",
        status: "skipped",
        error: "Story skipped because Feed publication did not succeed.",
      });
    } else if (params.dryRun) {
      deliveries.push({
        platform: "instagram",
        publicationType: "story",
        status: "published",
        mediaId: "dry_run_story_id",
      });
    } else {
      try {
        const storyUrl = await getSignedMediaUrl("bobfess-published", batch.story_asset_path, 3600);
        if (!storyUrl) throw new Error(`Failed to generate signed URL for Story: ${batch.story_asset_path}`);

        const storyContainer = await createStoryContainer(storyUrl);
        if (storyContainer.error || !storyContainer.containerId) {
          throw new Error(storyContainer.error || "Failed to create Story container");
        }

        const storyPub = await publishInstagramContainer(storyContainer.containerId);
        if (storyPub.error || !storyPub.publishedMediaId) {
          throw new Error(storyPub.error || "Failed to publish Story");
        }

        deliveries.push({
          platform: "instagram",
          publicationType: "story",
          status: "published",
          mediaId: storyPub.publishedMediaId,
        });

        await adminClient.from("publication_batches").update({
          story_container_id: storyContainer.containerId,
        }).eq("id", batch.id);

      } catch (err) {
        deliveries.push({
          platform: "instagram",
          publicationType: "story",
          status: "failed",
          error: (err as Error).message,
        });
      }
    }
  }

  // 4. Threads Publication Pipeline
  let threadsRootId: string | undefined;

  if (threadsEnabled && slideList.length > 0) {
    const slide1Text = slideList[0].message;
    const refTag = settings?.threads_show_ref_code ? `\n\n#${submission.public_code}` : "";
    const prefix = settings?.threads_prefix ? `${settings.threads_prefix}\n\n` : "";
    const suffix = settings?.threads_suffix ? `\n\n${settings.threads_suffix}` : "";

    // Fit text within Threads 500-char limit
    let rootText = `${prefix}${slide1Text}${refTag}${suffix}`;
    if (rootText.length > 500) {
      // Prioritize raw approved text
      rootText = slide1Text.slice(0, 500);
    }

    if (params.dryRun) {
      deliveries.push({
        platform: "threads",
        publicationType: "threads_main",
        status: "published",
        mediaId: "dry_run_threads_root_id",
        permalink: "https://threads.net/@kampunginggrisfess/post/dry_run",
      });
      threadsRootId = "dry_run_threads_root_id";
    } else {
      try {
        const containerRes = await createThreadsContainer({ text: rootText });
        if (containerRes.error || !containerRes.containerId) {
          throw new Error(containerRes.error || "Failed to create Threads main container");
        }

        const pubRes = await publishThreadsContainer(containerRes.containerId);
        if (pubRes.error || !pubRes.publishedMediaId) {
          throw new Error(pubRes.error || "Failed to publish Threads main container");
        }

        threadsRootId = pubRes.publishedMediaId;
        deliveries.push({
          platform: "threads",
          publicationType: "threads_main",
          status: "published",
          mediaId: threadsRootId,
          permalink: pubRes.permalink,
        });
      } catch (err) {
        deliveries.push({
          platform: "threads",
          publicationType: "threads_main",
          status: "failed",
          error: (err as Error).message,
        });
      }
    }

    // Threads Continuation (Slide 2 reply)
    if (threadsReplyEnabled && slideList.length > 1) {
      if (!threadsRootId) {
        deliveries.push({
          platform: "threads",
          publicationType: "threads_reply",
          status: "skipped",
          error: "Continuation reply skipped because main post failed.",
        });
      } else if (params.dryRun) {
        deliveries.push({
          platform: "threads",
          publicationType: "threads_reply",
          status: "published",
          mediaId: "dry_run_threads_reply_id",
          permalink: "https://threads.net/@kampunginggrisfess/post/dry_run_reply",
        });
      } else {
        try {
          const slide2Text = slideList[1].message.slice(0, 500);
          const replyContainer = await createThreadsContainer({
            text: slide2Text,
            replyToId: threadsRootId,
          });

          if (replyContainer.error || !replyContainer.containerId) {
            throw new Error(replyContainer.error || "Failed to create Threads reply container");
          }

          const replyPub = await publishThreadsContainer(replyContainer.containerId);
          if (replyPub.error || !replyPub.publishedMediaId) {
            throw new Error(replyPub.error || "Failed to publish Threads reply");
          }

          deliveries.push({
            platform: "threads",
            publicationType: "threads_reply",
            status: "published",
            mediaId: replyPub.publishedMediaId,
            permalink: replyPub.permalink,
          });
        } catch (err) {
          deliveries.push({
            platform: "threads",
            publicationType: "threads_reply",
            status: "failed",
            error: (err as Error).message,
          });
        }
      }
    }
  }

  // Record platform_deliveries if table exists
  for (const d of deliveries) {
    try {
      await adminClient.from("platform_deliveries").upsert({
        batch_id: batch.id,
        submission_id: submission.id,
        platform: d.platform,
        publication_type: d.publicationType,
        status: d.status,
        scheduled_time: new Date().toISOString(),
        published_media_id: d.mediaId || null,
        permalink: d.permalink || null,
        sanitized_error_message: d.error || null,
        published_at: d.status === "published" ? new Date().toISOString() : null,
      }, { onConflict: "batch_id,platform,publication_type" });
    } catch {
      // Non-fatal if platform_deliveries migration has not yet been applied
    }
  }

  const hasFailures = deliveries.some((d) => d.status === "failed");
  const hasSuccess = deliveries.some((d) => d.status === "published");
  const overallStatus = !hasFailures ? "completed" : hasSuccess ? "partial" : "failed";

  return {
    batchId: batch.id,
    submissionId: submission.id,
    deliveries,
    overallStatus,
  };
}
