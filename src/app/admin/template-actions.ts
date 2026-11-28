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
import { generateAndPersistPublicationAssets } from "@/lib/rendering/publication-asset-generator";

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
  templateId?: string,
  batchId?: string
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

  const res = await generateAndPersistPublicationAssets({
    submissionId,
    templateId,
    batchId,
  });

  if (!res.success) {
    return {
      success: false,
      validationError: res.validationError,
      error: res.error,
    };
  }

  // Generate signed preview URLs for admin UI
  const adminClient = createAdminSupabaseClient();
  const feedUrls: string[] = [];
  if (res.feedAssetPaths) {
    for (const p of res.feedAssetPaths) {
      const { data } = await adminClient.storage.from("bobfess-published").createSignedUrl(p, 3600);
      if (data?.signedUrl) feedUrls.push(data.signedUrl);
    }
  }

  let storySignedUrl: string | undefined;
  if (res.storyAssetPath) {
    const { data } = await adminClient.storage.from("bobfess-published").createSignedUrl(res.storyAssetPath, 3600);
    storySignedUrl = data?.signedUrl;
  }

  return {
    success: true,
    feedAssetUrls: feedUrls,
    storyAssetUrl: storySignedUrl,
  };
}
