import sharp, { OverlayOptions } from "sharp";
import { CustomTemplate, BoundingBox } from "@/lib/types/template";

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

/**
 * Deterministic text layout calculator with left alignment and auto-fit font sizing.
 * Wraps text into lines that fit inside the given width and adjusts font size
 * until all lines fit within the bounding box height, or reaches minFontSize.
 */
export function layoutTextAutoFit(
  text: string,
  box: BoundingBox,
  fontFamily: string,
  minFontSize: number = 24,
  maxFontSize: number = 44,
  lineHeightMultiplier: number = 1.35
): {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  totalHeight: number;
} {
  // Approximate average character width ratio for sans-serif fonts (like Geist, Inter)
  // Typically charWidth ~ 0.55 * fontSize
  const charWidthRatio = 0.55;

  let chosenFontSize = maxFontSize;
  let finalLines: string[] = [];

  for (let size = maxFontSize; size >= minFontSize; size -= 2) {
    const maxCharsPerLine = Math.max(10, Math.floor(box.width / (size * charWidthRatio)));
    const lineHeight = Math.round(size * lineHeightMultiplier);

    const paragraphs = text.split("\n");
    const currentLines: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        currentLines.push(""); // Preserve empty paragraph break
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
          currentLine += " " + word;
        } else {
          currentLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        currentLines.push(currentLine);
      }
    }

    const totalHeight = currentLines.length * lineHeight;

    if (totalHeight <= box.height || size === minFontSize) {
      chosenFontSize = size;
      finalLines = currentLines;
      break;
    }
  }

  const finalLineHeight = Math.round(chosenFontSize * lineHeightMultiplier);
  return {
    fontSize: chosenFontSize,
    lineHeight: finalLineHeight,
    lines: finalLines,
    totalHeight: finalLines.length * finalLineHeight,
  };
}

/**
 * Generates an SVG string representation of dynamic confession text over a template.
 */
export function generateTextOverlaySvg(
  message: string,
  recipient: string | null | undefined,
  publicCode: string | null | undefined,
  slideOrder: number | null | undefined,
  template: CustomTemplate
): string {
  const { width, height } = template.dimensions;
  const { message_box, recipient_box, code_box } = template.layout_config;

  const textLayout = layoutTextAutoFit(
    message,
    message_box,
    template.font_family,
    template.font_size_min,
    template.font_size_max,
    template.line_height
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
      const y = startY + (idx + 1) * textLayout.lineHeight;
      return `<tspan x="${message_box.x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  const recipientSvg =
    recipient && recipient_box
      ? `<text x="${recipient_box.x}" y="${recipient_box.y + 35}" font-family="${escapeXml(
          template.font_family
        )}, sans-serif" font-size="28" font-weight="600" fill="${escapeXml(
          template.text_color
        )}" opacity="0.8">To: ${escapeXml(recipient)}</text>`
      : "";

  const codeSvg =
    publicCode && code_box
      ? `<text x="${code_box.x}" y="${code_box.y + 25}" font-family="monospace" font-size="20" font-weight="600" fill="${escapeXml(
          template.text_color
        )}" opacity="0.5">REF: ${escapeXml(publicCode)}${
          slideOrder ? ` · SLIDE ${slideOrder}/2` : ""
        }</text>`
      : "";

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .message-text {
      font-family: '${escapeXml(template.font_family)}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: ${textLayout.fontSize}px;
      font-weight: 500;
      fill: ${escapeXml(template.text_color)};
      letter-spacing: ${template.letter_spacing}px;
      text-anchor: start;
    }
  </style>
  ${recipientSvg}
  <text class="message-text">
    ${tspans}
  </text>
  ${codeSvg}
</svg>
  `.trim();
}

export interface RenderSlideOptions {
  message: string;
  recipient?: string | null;
  publicCode?: string | null;
  slideOrder?: 1 | 2;
  template: CustomTemplate;
  backgroundBuffer?: Buffer;
  photoBuffer?: Buffer;
}

/**
 * High-performance, deterministic Sharp image compositor.
 * Renders an Instagram-ready 1080×1350 JPEG asset.
 */
export async function renderFeedSlideJpeg(options: RenderSlideOptions): Promise<Buffer> {
  const { message, recipient, publicCode, slideOrder, template, backgroundBuffer, photoBuffer } = options;
  const { width, height } = template.dimensions;

  // 1. Prepare Base Canvas (Either uploaded background or minimalist white canvas)
  const canvas = backgroundBuffer
    ? sharp(backgroundBuffer).resize(width, height, { fit: "cover" })
    : sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      });

  const composites: OverlayOptions[] = [];

  // 2. If photo submission, composite user photo inside media_box
  if (photoBuffer && template.layout_config.media_box) {
    const box = template.layout_config.media_box;
    const resizedPhoto = await sharp(photoBuffer)
      .resize(box.width, box.height, { fit: "cover", position: "centre" })
      .toBuffer();

    composites.push({
      input: resizedPhoto,
      left: box.x,
      top: box.y,
    });
  }

  // 3. Generate dynamic text SVG overlay
  const textSvg = generateTextOverlaySvg(message, recipient, publicCode, slideOrder, template);
  composites.push({
    input: Buffer.from(textSvg),
    top: 0,
    left: 0,
  });

  // 4. Composite and export as high quality sRGB JPEG
  return await canvas
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/**
 * Generates an Instagram Companion Story (1080×1920 9:16).
 */
export async function renderCompanionStoryJpeg(
  feedSlideBuffer: Buffer,
  storyTemplate?: CustomTemplate,
  backgroundBuffer?: Buffer
): Promise<Buffer> {
  const width = 1080;
  const height = 1920;

  // Base 1080x1920 canvas
  const canvas = backgroundBuffer
    ? sharp(backgroundBuffer).resize(width, height, { fit: "cover" })
    : sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 250, g: 250, b: 250, alpha: 1 },
        },
      });

  // Scale feed slide to fit nicely inside Story safe area
  // Feed slide is 1080x1350 -> scaled down to 864x1080
  const previewWidth = 864;
  const previewHeight = 1080;
  const scaledSlide = await sharp(feedSlideBuffer)
    .resize(previewWidth, previewHeight, { fit: "contain" })
    .toBuffer();

  const composites: OverlayOptions[] = [
    {
      input: scaledSlide,
      left: Math.round((width - previewWidth) / 2),
      top: 380, // Positioned safely within Instagram Story vertical margins
    },
  ];

  return await canvas
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
