import { parse, Font } from "opentype.js";
import fs from "fs";
import path from "path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// In-memory cache for parsed fonts (key: font path or buffer hash)
const fontCache = new Map<string, Font>();
const fontBufferCache = new Map<string, Buffer>();

/**
 * Default fallback font path (Geist Regular TTF bundled with the project)
 */
export const DEFAULT_FONT_NAME = "Geist";
export const DEFAULT_FONT_PATH = path.join(process.cwd(), "public/fonts/Geist-Regular.ttf");

/**
 * Loads font buffer from local disk or Supabase Storage (bobfess-templates bucket).
 */
export async function getFontBuffer(fontFilePath: string | null | undefined): Promise<{
  buffer: Buffer;
  fontFamily: string;
}> {
  if (fontFilePath) {
    if (fontBufferCache.has(fontFilePath)) {
      return {
        buffer: fontBufferCache.get(fontFilePath)!,
        fontFamily: path.basename(fontFilePath, path.extname(fontFilePath)),
      };
    }

    try {
      const adminClient = createAdminSupabaseClient();
      const { data, error } = await adminClient.storage
        .from("bobfess-templates")
        .download(fontFilePath);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        fontBufferCache.set(fontFilePath, buf);
        return {
          buffer: buf,
          fontFamily: path.basename(fontFilePath, path.extname(fontFilePath)),
        };
      }
    } catch {
      // If remote download fails, fall through to default
    }
  }

  // Load default bundled Geist font
  if (fontBufferCache.has(DEFAULT_FONT_PATH)) {
    return {
      buffer: fontBufferCache.get(DEFAULT_FONT_PATH)!,
      fontFamily: DEFAULT_FONT_NAME,
    };
  }

  if (fs.existsSync(DEFAULT_FONT_PATH)) {
    const buf = fs.readFileSync(DEFAULT_FONT_PATH);
    fontBufferCache.set(DEFAULT_FONT_PATH, buf);
    return {
      buffer: buf,
      fontFamily: DEFAULT_FONT_NAME,
    };
  }

  // Fallback to node_modules location if exists
  const nextGeistPath = path.join(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"
  );
  if (fs.existsSync(nextGeistPath)) {
    const buf = fs.readFileSync(nextGeistPath);
    fontBufferCache.set(DEFAULT_FONT_PATH, buf);
    return {
      buffer: buf,
      fontFamily: DEFAULT_FONT_NAME,
    };
  }

  throw new Error("Default font Geist-Regular.ttf could not be located on the server.");
}

/**
 * Loads and parses an opentype.js Font instance.
 */
export async function loadParsedFont(fontFilePath: string | null | undefined): Promise<{
  font: Font;
  fontBuffer: Buffer;
  fontFamily: string;
}> {
  const cacheKey = fontFilePath || DEFAULT_FONT_PATH;
  if (fontCache.has(cacheKey) && fontBufferCache.has(cacheKey)) {
    return {
      font: fontCache.get(cacheKey)!,
      fontBuffer: fontBufferCache.get(cacheKey)!,
      fontFamily: path.basename(cacheKey, path.extname(cacheKey)),
    };
  }

  const { buffer, fontFamily } = await getFontBuffer(fontFilePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const font = parse(arrayBuffer);

  fontCache.set(cacheKey, font);
  fontBufferCache.set(cacheKey, buffer);

  return { font, fontBuffer: buffer, fontFamily };
}

/**
 * Measures the exact width of a text string at a given fontSize and letterSpacing using opentype glyph measurement.
 */
export function measureTextWidth(
  font: Font,
  text: string,
  fontSize: number,
  letterSpacing: number = 0
): number {
  if (!text) return 0;
  let width = 0;
  const glyphs = font.stringToGlyphs(text);

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    if (glyph.advanceWidth) {
      width += (glyph.advanceWidth / font.unitsPerEm) * fontSize;
    }
    if (i < glyphs.length - 1) {
      // Kerning if available
      const kerning = font.getKerningValue(glyph, glyphs[i + 1]);
      width += (kerning / font.unitsPerEm) * fontSize;
      width += letterSpacing;
    }
  }

  return width;
}
