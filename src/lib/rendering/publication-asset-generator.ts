import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CustomTemplate } from "@/lib/types/template";
import {
  renderFeedSlideJpeg,
  renderCompanionStoryJpeg,
} from "./template-renderer";

export interface GeneratePublicationAssetsResult {
  success: boolean;
  feedAssetPaths?: string[];
  storyAssetPath?: string;
  templateVersionId?: string;
  validationError?: string;
  error?: string;
}

/**
 * Server-only service to generate and persist authoritative publication assets
 * for a submission / publication batch.
 *
 * Rules:
 * 1. Selects the correct active template for each slide according to its attachment type
 *    (photo_feed if slide has photo attachment, text_feed otherwise).
 * 2. Resolves media attachment from the correct private storage bucket ("bobfess-media", "bobfess-images").
 * 3. Enforces strict zero text overflow; holds publication for review if text does not fit.
 * 4. Verifies storage uploads before marking assets as ready.
 * 5. Returns persisted storage paths and pins the template version snapshot.
 */
export async function generateAndPersistPublicationAssets(params: {
  submissionId: string;
  templateId?: string;
  batchId?: string;
}): Promise<GeneratePublicationAssetsResult> {
  const adminClient = createAdminSupabaseClient();
  const { submissionId, templateId, batchId } = params;

  // 1. Fetch submission with slides and media assets
  const { data: sub, error: subErr } = await adminClient
    .from("submissions")
    .select("*, submission_slides(*), media_assets(*)")
    .eq("id", submissionId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: `Submission not found: ${subErr?.message || "Invalid submission"}` };
  }

  // 2. Fetch all active templates to match by category per slide
  const { data: allActiveTemplates } = await adminClient
    .from("templates")
    .select("*")
    .eq("is_active", true);

  const activeTemplates = (allActiveTemplates as unknown as CustomTemplate[]) || [];
  const textTemplate =
    activeTemplates.find((t) => t.category === "text_feed") ||
    activeTemplates[0] ||
    getDefaultTemplate("text_feed");
  const photoTemplate =
    activeTemplates.find((t) => t.category === "photo_feed") ||
    textTemplate;
  const storyTemplate =
    activeTemplates.find((t) => t.category === "story") ||
    getDefaultTemplate("story");

  // If specific templateId requested, use it as override
  let overrideTemplate: CustomTemplate | undefined;
  if (templateId) {
    const { data: specified } = await adminClient
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (specified) {
      overrideTemplate = specified as unknown as CustomTemplate;
    }
  }

  // 3. Prepare slides ordered
  const rawSlides =
    sub.submission_slides && sub.submission_slides.length > 0
      ? sub.submission_slides.sort((a, b) => a.slide_order - b.slide_order)
      : [{ id: "legacy-slide-1", slide_order: 1, message: sub.message }];

  const slides = rawSlides.slice(0, 2); // Max 2 slides
  const mediaList = sub.media_assets || [];

  const feedAssetPaths: string[] = [];
  const feedBuffers: Buffer[] = [];
  let pinnedTemplateId: string | undefined;

  // 4. Render each slide
  for (const s of slides) {
    // Resolve slide media attachment: match by slide_id if present, or fallback to first media on slide 1
    const slideMedia = mediaList.find((m) => m.slide_id === s.id) || (s.slide_order === 1 ? mediaList[0] : undefined);
    const hasPhoto = !!slideMedia && slideMedia.mime_type.startsWith("image/");

    let photoBuffer: Buffer | undefined;
    if (hasPhoto && slideMedia?.storage_path) {
      // Try bobfess-media first, then bobfess-images
      for (const bucket of ["bobfess-media", "bobfess-images"]) {
        const { data: mediaData } = await adminClient.storage
          .from(bucket)
          .download(slideMedia.storage_path);
        if (mediaData) {
          photoBuffer = Buffer.from(await mediaData.arrayBuffer());
          break;
        }
      }
    }

    // Select active template matching slide attachment category
    const chosenTemplate = overrideTemplate || (hasPhoto ? photoTemplate : textTemplate);
    pinnedTemplateId = chosenTemplate.id;

    const renderRes = await renderFeedSlideJpeg({
      message: s.message,
      recipient: chosenTemplate.layout_config.show_recipient !== false ? sub.recipient : undefined,
      publicCode: chosenTemplate.layout_config.show_code !== false ? sub.public_code : undefined,
      slideOrder:
        chosenTemplate.layout_config.show_slide_number !== false && slides.length > 1
          ? (s.slide_order as 1 | 2)
          : undefined,
      template: chosenTemplate,
      photoBuffer,
    });

    if (!renderRes.fits) {
      return {
        success: false,
        validationError: `Slide ${s.slide_order} overflow: ${renderRes.overflowReason}. Publication held for admin review.`,
      };
    }

    // Upload to bobfess-published storage bucket
    const feedPath = `posts/${sub.public_code}_slide_${s.slide_order}_${Date.now()}.jpg`;
    const { error: uploadErr } = await adminClient.storage
      .from("bobfess-published")
      .upload(feedPath, renderRes.buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadErr) {
      return {
        success: false,
        error: `Failed to persist feed slide ${s.slide_order} to storage: ${uploadErr.message}`,
      };
    }

    // Verify successful upload
    const { data: verifyList } = await adminClient.storage
      .from("bobfess-published")
      .list("posts", { search: feedPath.replace("posts/", "") });

    if (!verifyList || verifyList.length === 0) {
      return {
        success: false,
        error: `Verification failed for uploaded slide asset ${feedPath}. Storage write unconfirmed.`,
      };
    }

    feedAssetPaths.push(feedPath);
    feedBuffers.push(renderRes.buffer);
  }

  // 5. Render Companion Story from Slide 1
  let storyAssetPath: string | undefined;
  if (feedBuffers.length > 0) {
    const storyBuffer = await renderCompanionStoryJpeg(feedBuffers[0], storyTemplate);
    const sPath = `stories/${sub.public_code}_story_${Date.now()}.jpg`;

    const { error: sUploadErr } = await adminClient.storage
      .from("bobfess-published")
      .upload(sPath, storyBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (!sUploadErr) {
      storyAssetPath = sPath;
    }
  }

  // 6. Pin template version snapshot if template is in database
  let templateVersionId: string | undefined;
  if (pinnedTemplateId && !pinnedTemplateId.includes("default")) {
    const { data: latestVersion } = await adminClient
      .from("template_versions")
      .select("id")
      .eq("template_id", pinnedTemplateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersion) {
      templateVersionId = latestVersion.id;
    }
  }

  // 7. If batchId provided, persist directly to publication_batches
  if (batchId) {
    const { error: updateErr } = await adminClient
      .from("publication_batches")
      .update({
        feed_asset_paths: feedAssetPaths,
        story_asset_path: storyAssetPath || null,
        template_version_id: templateVersionId || null,
        rendered_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    if (updateErr) {
      return {
        success: false,
        error: `Failed to update publication_batches with asset paths: ${updateErr.message}`,
      };
    }
  }

  return {
    success: true,
    feedAssetPaths,
    storyAssetPath,
    templateVersionId,
  };
}

function getDefaultTemplate(category: "text_feed" | "photo_feed" | "story"): CustomTemplate {
  if (category === "photo_feed") {
    return {
      id: "default-photo-feed",
      name: "Split Photo & Text Feed",
      category: "photo_feed",
      dimensions: { width: 1080, height: 1350 },
      background_storage_path: null,
      font_family: "Geist",
      font_file_path: null,
      font_size_min: 22,
      font_size_max: 36,
      text_color: "#171717",
      line_height: 1.35,
      letter_spacing: 0,
      vertical_align: "top",
      layout_config: {
        media_box: { x: 100, y: 200, width: 880, height: 520, visible: true, locked: false, fitMode: "cover" },
        message_box: { x: 100, y: 760, width: 880, height: 420, visible: true, locked: false },
        recipient_box: { x: 100, y: 140, width: 880, height: 40, visible: true, locked: false },
        code_box: { x: 100, y: 1220, width: 880, height: 40, visible: true, locked: false },
      },
      is_active: true,
      version: 1,
    };
  }

  if (category === "story") {
    return {
      id: "default-story",
      name: "Standard Companion Story",
      category: "story",
      dimensions: { width: 1080, height: 1920 },
      background_storage_path: null,
      font_family: "Geist",
      font_file_path: null,
      font_size_min: 24,
      font_size_max: 38,
      text_color: "#171717",
      line_height: 1.35,
      letter_spacing: 0,
      vertical_align: "top",
      layout_config: {
        story_feed_box: { x: 108, y: 400, width: 864, height: 1080, visible: true, locked: false, fitMode: "contain" },
        message_box: { x: 100, y: 1520, width: 880, height: 240, visible: false, locked: false },
        code_box: { x: 100, y: 1800, width: 880, height: 40, visible: true, locked: false },
      },
      is_active: true,
      version: 1,
    };
  }

  return {
    id: "default-text-feed",
    name: "Classic Swiss Text Feed",
    category: "text_feed",
    dimensions: { width: 1080, height: 1350 },
    background_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 24,
    font_size_max: 44,
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      message_box: { x: 100, y: 280, width: 880, height: 750, visible: true, locked: false },
      recipient_box: { x: 100, y: 200, width: 880, height: 50, visible: true, locked: false },
      code_box: { x: 100, y: 1200, width: 880, height: 40, visible: true, locked: false },
    },
    is_active: true,
    version: 1,
  };
}
