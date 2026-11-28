"use server";

import { assertAdminSession } from "@/lib/security/admin-auth";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { CustomTemplate } from "@/lib/types/template";
import { Json } from "@/lib/supabase/types";
import {
  renderFeedSlideJpeg,
  renderCompanionStoryJpeg,
} from "@/lib/rendering/template-renderer";

/**
 * Uploads a custom template asset:
 * - background: JPEG/PNG image (1080x1350 for Feed, 1080x1920 for Story)
 * - overlay: Transparent PNG image
 * - font: Licensed TTF/OTF font file
 */
export async function uploadTemplateAsset(formData: FormData): Promise<{
  success: boolean;
  storagePath?: string;
  error?: string;
}> {
  await assertAdminSession();
  const supabaseUser = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized. Admin session required." };

  const file = formData.get("file") as File;
  const assetType = formData.get("assetType") as "background" | "overlay" | "font";

  if (!file || file.size <= 0) {
    return { success: false, error: "No valid file uploaded." };
  }

  // Validate file size: max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "File exceeds 10MB limit." };
  }

  const adminClient = createAdminSupabaseClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folder = assetType === "font" ? "fonts" : assetType === "overlay" ? "overlays" : "backgrounds";
  const storagePath = `${folder}/${timestamp}_${safeName}`;

  const { error: uploadErr } = await adminClient.storage
    .from("bobfess-templates")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    return { success: false, error: uploadErr.message };
  }

  return { success: true, storagePath };
}

/**
 * Saves or updates a template configuration.
 */
export async function saveCustomTemplate(template: CustomTemplate): Promise<{
  success: boolean;
  templateId?: string;
  error?: string;
}> {
  await assertAdminSession();
  const supabaseUser = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized. Admin session required." };

  const adminClient = createAdminSupabaseClient();

  // If active is true, deactivate other templates in the same category
  if (template.is_active) {
    await adminClient
      .from("templates")
      .update({ is_active: false })
      .eq("category", template.category);
  }

  const isDefaultId = template.id.includes("default");

  const { data, error } = await adminClient
    .from("templates")
    .upsert({
      id: isDefaultId ? undefined : template.id,
      name: template.name,
      category: template.category,
      dimensions: template.dimensions as unknown as Json,
      background_storage_path: template.background_storage_path,
      font_family: template.font_family,
      font_file_path: template.font_file_path,
      font_size_min: template.font_size_min,
      font_size_max: template.font_size_max,
      text_color: template.text_color,
      line_height: template.line_height,
      letter_spacing: template.letter_spacing,
      vertical_align: template.vertical_align,
      layout_config: template.layout_config as unknown as Json,
      is_active: template.is_active,
      version: template.version + 1,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to persist template." };
  }

  // Create immutable template version snapshot
  await adminClient.from("template_versions").insert({
    template_id: data.id,
    version: data.version,
    snapshot: data,
  });

  revalidatePath("/admin/templates");
  return { success: true, templateId: data.id };
}

/**
 * Fetches all templates from database.
 */
export async function getCustomTemplates(): Promise<{
  templates: CustomTemplate[];
  error?: string;
}> {
  await assertAdminSession();
  const adminClient = createAdminSupabaseClient();
  const { data, error } = await adminClient
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { templates: [], error: error.message };
  }

  return { templates: (data as unknown as CustomTemplate[]) || [] };
}

export interface RenderPreviewRequest {
  template: CustomTemplate;
  message: string;
  recipient?: string;
  publicCode?: string;
  slideOrder?: 1 | 2;
  renderStory?: boolean;
  sampleMediaUrl?: string;
}

export interface RenderPreviewResponse {
  success: boolean;
  feedJpegBase64?: string;
  storyJpegBase64?: string;
  fits: boolean;
  overflowReason?: string;
  error?: string;
}

/**
 * Authoritative Unified Server-Side Preview Renderer.
 * Uses the exact same production Sharp pipeline to generate base64 JPEG previews for the admin studio.
 */
export async function renderUnifiedPreview(
  params: RenderPreviewRequest
): Promise<RenderPreviewResponse> {
  await assertAdminSession();

  try {
    const { template, message, recipient, publicCode, slideOrder, renderStory, sampleMediaUrl } = params;

    let photoBuffer: Buffer | undefined;
    if (sampleMediaUrl) {
      try {
        const res = await fetch(sampleMediaUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          photoBuffer = Buffer.from(ab);
        }
      } catch {
        // Fall back to no photo
      }
    }

    const feedResult = await renderFeedSlideJpeg({
      message,
      recipient: template.layout_config.show_recipient !== false ? recipient : undefined,
      publicCode: template.layout_config.show_code !== false ? publicCode : undefined,
      slideOrder: template.layout_config.show_slide_number !== false ? slideOrder : undefined,
      template,
      photoBuffer,
    });

    let storyJpegBase64: string | undefined;
    if (renderStory || template.category === "story") {
      const storyBuf = await renderCompanionStoryJpeg(feedResult.buffer, template);
      storyJpegBase64 = `data:image/jpeg;base64,${storyBuf.toString("base64")}`;
    }

    return {
      success: true,
      feedJpegBase64: `data:image/jpeg;base64,${feedResult.buffer.toString("base64")}`,
      storyJpegBase64,
      fits: feedResult.fits,
      overflowReason: feedResult.overflowReason,
    };
  } catch (err) {
    return {
      success: false,
      fits: false,
      error: (err as Error).message || "Rendering failed.",
    };
  }
}

/**
 * Generates and stores Instagram Feed and Story assets for a publication batch.
 * Guarantees zero text overflow, holding batch for review if validation fails.
 */
export async function generatePublicationAssets(
  submissionId: string,
  templateId?: string
): Promise<{
  success: boolean;
  feedAssetUrls?: string[];
  storyAssetUrl?: string;
  validationError?: string;
  error?: string;
}> {
  await assertAdminSession();
  const supabaseUser = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const adminClient = createAdminSupabaseClient();

  // 1. Fetch submission with slides and media
  const { data: sub } = await adminClient
    .from("submissions")
    .select("*, submission_slides(*), media_assets(*)")
    .eq("id", submissionId)
    .single();

  if (!sub) return { success: false, error: "Submission not found." };

  // 2. Fetch active template
  let templateQuery = adminClient.from("templates").select("*");
  if (templateId) {
    templateQuery = templateQuery.eq("id", templateId);
  } else {
    templateQuery = templateQuery.eq("category", "text_feed").eq("is_active", true);
  }
  const { data: activeTemplate } = await templateQuery.maybeSingle();

  // Default fallback template
  const template: CustomTemplate = (activeTemplate as unknown as CustomTemplate) || {
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
      message_box: { x: 100, y: 280, width: 880, height: 750 },
      recipient_box: { x: 100, y: 200, width: 880, height: 50 },
      code_box: { x: 100, y: 1200, width: 880, height: 40 },
    },
    is_active: true,
    version: 1,
  };

  const slides =
    sub.submission_slides && sub.submission_slides.length > 0
      ? sub.submission_slides.sort((a, b) => a.slide_order - b.slide_order)
      : [{ slide_order: 1, message: sub.message }];

  const feedAssetPaths: string[] = [];
  const feedBuffers: Buffer[] = [];

  // Download media if photo attached
  let photoBuffer: Buffer | undefined;
  if (sub.media_assets && sub.media_assets.length > 0) {
    const firstMedia = sub.media_assets[0];
    if (firstMedia?.storage_path) {
      const { data: mediaData } = await adminClient.storage
        .from("bobfess-media")
        .download(firstMedia.storage_path);
      if (mediaData) {
        photoBuffer = Buffer.from(await mediaData.arrayBuffer());
      }
    }
  }

  // Render each slide
  for (const s of slides) {
    const renderRes = await renderFeedSlideJpeg({
      message: s.message,
      recipient: template.layout_config.show_recipient !== false ? sub.recipient : undefined,
      publicCode: template.layout_config.show_code !== false ? sub.public_code : undefined,
      slideOrder:
        template.layout_config.show_slide_number !== false && slides.length > 1
          ? (s.slide_order as 1 | 2)
          : undefined,
      template,
      photoBuffer: s.slide_order === 1 ? photoBuffer : undefined,
    });

    // Check strict validation rule: text must fit inside bounding box
    if (!renderRes.fits) {
      return {
        success: false,
        validationError: `Slide ${s.slide_order} overflow error: ${renderRes.overflowReason}. Publication held for admin review.`,
      };
    }

    const path = `posts/${sub.public_code}_slide_${s.slide_order}.jpg`;
    await adminClient.storage.from("bobfess-published").upload(path, renderRes.buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    feedAssetPaths.push(path);
    feedBuffers.push(renderRes.buffer);
  }

  // Fetch story template if available
  const { data: storyTemplateData } = await adminClient
    .from("templates")
    .select("*")
    .eq("category", "story")
    .eq("is_active", true)
    .maybeSingle();

  const storyTemplate = (storyTemplateData as unknown as CustomTemplate) || undefined;

  // Render Story from Slide 1
  const storyBuffer = await renderCompanionStoryJpeg(feedBuffers[0], storyTemplate);
  const storyPath = `stories/${sub.public_code}_story.jpg`;
  await adminClient.storage.from("bobfess-published").upload(storyPath, storyBuffer, {
    contentType: "image/jpeg",
    upsert: true,
  });

  // Generate signed preview URLs
  const { data: s1Url } = await adminClient.storage
    .from("bobfess-published")
    .createSignedUrl(feedAssetPaths[0], 3600);
  const { data: storySignedUrl } = await adminClient.storage
    .from("bobfess-published")
    .createSignedUrl(storyPath, 3600);

  return {
    success: true,
    feedAssetUrls: s1Url?.signedUrl ? [s1Url.signedUrl] : [],
    storyAssetUrl: storySignedUrl?.signedUrl,
  };
}
