import sharp, { OverlayOptions } from "sharp";
import { CustomTemplate, BoundingBox, LayerElementConfig } from "@/lib/types/template";
import { loadParsedFont, measureTextWidth } from "./font-manager";
import { Font } from "opentype.js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Escapes special XML characters to prevent SVG injection.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface TextLayoutResult {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  totalHeight: number;
  fits: boolean;
  overflowReason?: string;
}

/**
 * Accurate, deterministic text layout calculator using actual opentype glyph measurement.
 * Handles paragraphs, space breaks, and breaks long unbroken words safely if word exceeds box width.
 * Performs deterministic auto-fit from font_size_max down to font_size_min.
 */
export function layoutTextWithGlyphMeasurement(
  font: Font,
  text: string,
  box: BoundingBox | LayerElementConfig,
  minFontSize: number = 24,
  maxFontSize: number = 44,
  lineHeightMultiplier: number = 1.35,
  letterSpacing: number = 0
): TextLayoutResult {
  let chosenFontSize = maxFontSize;
  let finalLines: string[] = [];
  let fits = false;

  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    const lineHeight = Math.round(size * lineHeightMultiplier);
    const paragraphs = text.split("\n");
    const currentLines: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        currentLines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = measureTextWidth(font, testLine, size, letterSpacing);

        if (testWidth <= box.width) {
          currentLine = testLine;
        } else {
          // Word itself might be wider than box.width (unbroken long word)
          if (!currentLine) {
            // Need to break the single long word character by character
            let partial = "";
            for (const ch of word) {
              const testPartial = partial + ch;
              if (measureTextWidth(font, testPartial, size, letterSpacing) <= box.width) {
                partial = testPartial;
              } else {
                if (partial) currentLines.push(partial);
                partial = ch;
              }
            }
            currentLine = partial;
          } else {
            currentLines.push(currentLine);
            // Check if next word fits on new line
            const singleWordWidth = measureTextWidth(font, word, size, letterSpacing);
            if (singleWordWidth <= box.width) {
              currentLine = word;
            } else {
              // Break long word
              let partial = "";
              for (const ch of word) {
                const testPartial = partial + ch;
                if (measureTextWidth(font, testPartial, size, letterSpacing) <= box.width) {
                  partial = testPartial;
                } else {
                  if (partial) currentLines.push(partial);
                  partial = ch;
                }
              }
              currentLine = partial;
            }
          }
        }
      }

      if (currentLine) {
        currentLines.push(currentLine);
      }
    }

    const totalHeight = currentLines.length * lineHeight;
    if (totalHeight <= box.height) {
      chosenFontSize = size;
      finalLines = currentLines;
      fits = true;
      break;
    }

    if (size === minFontSize) {
      chosenFontSize = size;
      finalLines = currentLines;
      fits = totalHeight <= box.height;
    }
  }

  const finalLineHeight = Math.round(chosenFontSize * lineHeightMultiplier);
  const totalHeight = finalLines.length * finalLineHeight;

  return {
    fontSize: chosenFontSize,
    lineHeight: finalLineHeight,
    lines: finalLines,
    totalHeight,
    fits,
    overflowReason: fits
      ? undefined
      : `Text height (${totalHeight}px) exceeds bounding box height (${box.height}px) even at minimum font size (${minFontSize}px).`,
  };
}

/**
 * Generates an SVG string representation of dynamic confession text over a template
 * with embedded base64 font for 100% deterministic font rendering.
 */
export async function generateTextOverlaySvg(
  message: string,
  recipient: string | null | undefined,
  publicCode: string | null | undefined,
  slideOrder: number | null | undefined,
  template: CustomTemplate
): Promise<{ svg: string; fits: boolean; overflowReason?: string }> {
  const { width, height } = template.dimensions;
  const { message_box, recipient_box, code_box, show_recipient, show_code, show_slide_number } =
    template.layout_config;

  const { font, fontBuffer, fontFamily } = await loadParsedFont(template.font_file_path);
  const fontBase64 = fontBuffer.toString("base64");

  const textLayout = layoutTextWithGlyphMeasurement(
    font,
    message,
    message_box,
    template.font_size_min,
    template.font_size_max,
    template.line_height,
    template.letter_spacing
  );

  // Vertical alignment within message_box
  let startY = message_box.y;
  if (template.vertical_align === "middle") {
    startY += Math.max(0, (message_box.height - textLayout.totalHeight) / 2);
  } else if (template.vertical_align === "bottom") {
    startY += Math.max(0, message_box.height - textLayout.totalHeight);
  }

  // Generate SVG lines
  const tspans = textLayout.lines
    .map((line, idx) => {
      // baseline offset roughly 80% of lineHeight
      const y = startY + (idx + 1) * textLayout.lineHeight;
      return `<tspan x="${message_box.x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  const shouldShowRecipient =
    show_recipient !== false && recipient && recipient_box && recipient_box.visible !== false;
  const recipientSvg = shouldShowRecipient
    ? `<text x="${recipient_box.x}" y="${recipient_box.y + Math.min(35, recipient_box.height)}" font-family="'${escapeXml(
        fontFamily
      )}', sans-serif" font-size="${Math.min(28, Math.round(recipient_box.height * 0.7))}px" font-weight="600" fill="${escapeXml(
        template.text_color
      )}" opacity="0.85">To: ${escapeXml(recipient)}</text>`
    : "";

  const shouldShowCode =
    show_code !== false && publicCode && code_box && code_box.visible !== false;
  const slidePart =
    show_slide_number !== false && slideOrder ? ` · SLIDE ${slideOrder}/2` : "";
  const codeSvg = shouldShowCode
    ? `<text x="${code_box.x}" y="${code_box.y + Math.min(25, code_box.height)}" font-family="monospace, sans-serif" font-size="${Math.min(
        20,
        Math.round(code_box.height * 0.6)
      )}px" font-weight="600" fill="${escapeXml(
        template.text_color
      )}" opacity="0.55">REF: ${escapeXml(publicCode)}${slidePart}</text>`
    : "";

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: '${escapeXml(fontFamily)}';
        src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
        font-weight: ${template.font_weight || "normal"};
        font-style: normal;
      }
      .message-text {
        font-family: '${escapeXml(fontFamily)}', sans-serif;
        font-size: ${textLayout.fontSize}px;
        font-weight: ${template.font_weight || "500"};
        fill: ${escapeXml(template.text_color)};
        letter-spacing: ${template.letter_spacing}px;
        text-anchor: start;
      }
    </style>
  </defs>
  ${recipientSvg}
  <text class="message-text">
    ${tspans}
  </text>
  ${codeSvg}
</svg>
  `.trim();

  return {
    svg,
    fits: textLayout.fits,
    overflowReason: textLayout.overflowReason,
  };
}

export interface RenderSlideOptions {
  message: string;
  recipient?: string | null;
  publicCode?: string | null;
  slideOrder?: 1 | 2;
  template: CustomTemplate;
  backgroundBuffer?: Buffer;
  overlayBuffer?: Buffer;
  photoBuffer?: Buffer;
}

/**
 * Downloads a storage file buffer from Supabase Storage if path is provided.
 */
export async function downloadStorageAsset(storagePath: string | null | undefined): Promise<Buffer | null> {
  if (!storagePath) return null;
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient.storage
      .from("bobfess-templates")
      .download(storagePath);
    if (error || !data) return null;
    const arrayBuf = await data.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

/**
 * High-performance, deterministic Sharp image compositor.
 * Enforces layer order:
 * 1. Background
 * 2. User attachment (media_box)
 * 3. Optional transparent foreground overlay
 * 4. Dynamic text (SVG)
 * Renders an Instagram-ready 1080×1350 JPEG asset.
 */
export async function renderFeedSlideJpeg(options: RenderSlideOptions): Promise<{
  buffer: Buffer;
  fits: boolean;
  overflowReason?: string;
}> {
  const { message, recipient, publicCode, slideOrder, template } = options;
  const { width, height } = template.dimensions;

  // 1. Resolve Background
  let bgBuf = options.backgroundBuffer;
  if (!bgBuf && template.background_storage_path) {
    bgBuf = (await downloadStorageAsset(template.background_storage_path)) || undefined;
  }

  const canvas = bgBuf
    ? sharp(bgBuf).resize(width, height, { fit: "cover" })
    : sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      });

  const composites: OverlayOptions[] = [];

  // 2. User attachment (photoBuffer inside media_box)
  const photoBuf = options.photoBuffer;
  const mediaBox = template.layout_config.media_box;
  if (photoBuf && mediaBox && mediaBox.visible !== false) {
    const fitMode = mediaBox.fitMode || "cover";
    const resizedPhoto = await sharp(photoBuf)
      .resize(mediaBox.width, mediaBox.height, { fit: fitMode, position: "centre" })
      .toBuffer();

    composites.push({
      input: resizedPhoto,
      left: Math.round(mediaBox.x),
      top: Math.round(mediaBox.y),
    });
  }

  // 3. Optional transparent foreground overlay
  let overlayBuf = options.overlayBuffer;
  if (!overlayBuf && template.overlay_storage_path) {
    overlayBuf = (await downloadStorageAsset(template.overlay_storage_path)) || undefined;
  }
  if (overlayBuf) {
    const resizedOverlay = await sharp(overlayBuf)
      .resize(width, height, { fit: "cover" })
      .toBuffer();
    composites.push({
      input: resizedOverlay,
      left: 0,
      top: 0,
    });
  }

  // 4. Dynamic Text SVG
  const textRes = await generateTextOverlaySvg(message, recipient, publicCode, slideOrder, template);
  composites.push({
    input: Buffer.from(textRes.svg),
    top: 0,
    left: 0,
  });

  const buffer = await canvas
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return {
    buffer,
    fits: textRes.fits,
    overflowReason: textRes.overflowReason,
  };
}

/**
 * Generates an Instagram Companion Story (1080×1920 9:16).
 * Follows configured Story template positioning for the embedded Feed image.
 */
export async function renderCompanionStoryJpeg(
  feedSlideBuffer: Buffer,
  storyTemplate?: CustomTemplate,
  backgroundBuffer?: Buffer,
  overlayBuffer?: Buffer
): Promise<Buffer> {
  const width = storyTemplate?.dimensions.width || 1080;
  const height = storyTemplate?.dimensions.height || 1920;

  // Resolve story background
  let bgBuf = backgroundBuffer;
  if (!bgBuf && storyTemplate?.background_storage_path) {
    bgBuf = (await downloadStorageAsset(storyTemplate.background_storage_path)) || undefined;
  }

  const canvas = bgBuf
    ? sharp(bgBuf).resize(width, height, { fit: "cover" })
    : sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 250, g: 250, b: 250, alpha: 1 },
        },
      });

  const composites: OverlayOptions[] = [];

  // Feed image placement in Story
  const feedBox = storyTemplate?.layout_config.story_feed_box ||
    storyTemplate?.layout_config.media_box || {
      x: 108,
      y: 400,
      width: 864,
      height: 1080,
      fitMode: "contain" as const,
    };

  const fitMode = feedBox.fitMode || "contain";
  const scaledSlide = await sharp(feedSlideBuffer)
    .resize(feedBox.width, feedBox.height, { fit: fitMode, position: "centre" })
    .toBuffer();

  composites.push({
    input: scaledSlide,
    left: Math.round(feedBox.x),
    top: Math.round(feedBox.y),
  });

  // Optional story foreground overlay
  let storyOverlayBuf = overlayBuffer;
  if (!storyOverlayBuf && storyTemplate?.overlay_storage_path) {
    storyOverlayBuf = (await downloadStorageAsset(storyTemplate.overlay_storage_path)) || undefined;
  }
  if (storyOverlayBuf) {
    const resizedOverlay = await sharp(storyOverlayBuf)
      .resize(width, height, { fit: "cover" })
      .toBuffer();
    composites.push({
      input: resizedOverlay,
      left: 0,
      top: 0,
    });
  }

  return await canvas
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
