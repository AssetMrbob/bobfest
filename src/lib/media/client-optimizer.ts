/**
 * Client-Side Media Processing & Image Optimization.
 *
 * Requirements:
 * - Resize images to maximum 1600px on the longest side.
 * - Target compressed size 200–500KB without quality loss (Canvas WebP/JPEG conversion).
 * - Remove EXIF and metadata automatically by canvas redraw.
 * - Video: validate duration (<= 30s) and file size (<= 20MB) using HTML5 video element.
 * - Avoid expensive in-browser FFmpeg for mobile performance and battery conservation.
 */

export interface OptimizedImageResult {
  file: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface VideoValidationResult {
  valid: boolean;
  duration: number;
  sizeBytes: number;
  error?: string;
}

/**
 * Resizes and strips EXIF from user image files using HTML Canvas.
 */
export async function optimizeImageClient(
  file: File,
  maxDimension = 1600,
  targetQuality = 0.85
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Calculate proportional downscale
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Unable to initialize image canvas context."));
        return;
      }

      // Draw onto canvas (strips all EXIF, GPS, and camera metadata)
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output mime type (prefer WebP, fallback to JPEG)
      const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed."));
            return;
          }
          resolve({
            file: blob,
            mimeType: outputMime,
            width,
            height,
            sizeBytes: blob.size,
          });
        },
        outputMime,
        targetQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file."));
    };

    img.src = objectUrl;
  });
}

/**
 * Validates video duration and container compatibility without full transcoding.
 */
export async function validateVideoClient(
  file: File,
  maxDurationSeconds = 30,
  maxSizeBytes = 20 * 1024 * 1024
): Promise<VideoValidationResult> {
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      duration: 0,
      sizeBytes: file.size,
      error: `Video size exceeds ${Math.round(maxSizeBytes / (1024 * 1024))}MB limit.`,
    };
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duration = video.duration;

      if (duration > maxDurationSeconds) {
        resolve({
          valid: false,
          duration,
          sizeBytes: file.size,
          error: `Video duration (${Math.round(duration)}s) exceeds 30-second limit.`,
        });
      } else {
        resolve({
          valid: true,
          duration,
          sizeBytes: file.size,
        });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        duration: 0,
        sizeBytes: file.size,
        error: "Unable to read video file. Ensure format is MP4, MOV, or WebM.",
      });
    };

    video.src = objectUrl;
  });
}
