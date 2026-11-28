/**
 * Authorized Direct-to-Storage Upload URL Generation Endpoint.
 *
 * Enforces:
 * 1. Client rate limiting & HMAC identification.
 * 2. MIME type whitelisting (JPEG, PNG, WebP, MP4, MOV, WebM).
 * 3. Atomic pessimistic concurrency capacity reservation against 95% ceiling.
 * 4. Automatic FIFO cleanup trigger if reservation fails due to capacity.
 * 5. Returns short-lived Supabase signed upload URL with upsert=false.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getClientHmac } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getBucketForMediaType, runFifoStorageCleanup } from "@/lib/storage/storage-manager";

const ALLOWED_MIME_TYPES: Record<string, { mediaType: "image" | "video"; ext: string }> = {
  "image/jpeg": { mediaType: "image", ext: "jpg" },
  "image/png": { mediaType: "image", ext: "png" },
  "image/webp": { mediaType: "image", ext: "webp" },
  // Video uploads temporarily disabled until server-side video transcoding & container validation is finalized
  // "video/mp4": { mediaType: "video", ext: "mp4" },
  // "video/quicktime": { mediaType: "video", ext: "mov" },
  // "video/webm": { mediaType: "video", ext: "webm" },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const { mimeType, turnstileToken } = body;

    if (!mimeType || typeof mimeType !== "string" || !ALLOWED_MIME_TYPES[mimeType]) {
      if (mimeType && mimeType.startsWith("video/")) {
        return NextResponse.json(
          {
            error:
              "Video attachments are temporarily disabled while server-side video transcoding pipeline is being finalized. Please upload an image (JPEG, PNG, WebP).",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Unsupported media format. Allowed: JPEG, PNG, WebP." },
        { status: 400 }
      );
    }

    // Anti-bot check
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0].trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    if (process.env.NODE_ENV === "production") {
      const turnstileResult = await verifyTurnstileToken(turnstileToken, ip);
      if (!turnstileResult.success) {
        return NextResponse.json(
          { error: turnstileResult.message || "Bot verification failed." },
          { status: 403 }
        );
      }
    }

    const clientHmac = getClientHmac(ip, userAgent);
    const mediaConfig = ALLOWED_MIME_TYPES[mimeType];

    // Generate unique unguessable storage path
    const randomHex = randomBytes(16).toString("hex");
    const reservationToken = randomBytes(24).toString("hex");
    const storagePath = `incoming/${mediaConfig.mediaType}s/${Date.now()}_${randomHex}.${mediaConfig.ext}`;

    // 1. Attempt atomic reservation via locked RPC
    let reservation: {
      allowed: boolean;
      reserved_size: number;
      current_stored: number;
      active_reserved: number;
      hard_capacity: number;
      available_bytes: number;
      error_message: string | null;
    } | undefined;

    const { data: initialData, error: initialError } = await supabase.rpc(
      "reserve_storage_capacity_atomic",
      {
        p_token: reservationToken,
        p_path: storagePath,
        p_media_type: mediaConfig.mediaType,
        p_mime: mimeType,
        p_client_hash: clientHmac,
        p_ttl_seconds: 7200,
      }
    );

    if (!initialError && initialData && initialData.length > 0) {
      reservation = initialData[0];
    }

    // 2. If capacity exceeded, trigger automatic FIFO cleanup and retry once
    if (initialError || (reservation && !reservation.allowed)) {
      console.warn("Storage capacity exceeded. Initiating FIFO cleanup...");
      const cleanupResult = await runFifoStorageCleanup(supabase, 20971520); // Reclaim at least 20MB

      if (cleanupResult.freedBytes > 0) {
        // Retry reservation
        const { data: retryData } = await supabase.rpc("reserve_storage_capacity_atomic", {
          p_token: reservationToken,
          p_path: storagePath,
          p_media_type: mediaConfig.mediaType,
          p_mime: mimeType,
          p_client_hash: clientHmac,
          p_ttl_seconds: 7200,
        });
        if (retryData && retryData.length > 0) {
          reservation = retryData[0];
        }
      }
    }

    if (!reservation || !reservation.allowed) {
      return NextResponse.json(
        {
          error:
            "Storage capacity limit reached (95%). New media uploads are currently deferred until storage is cleared.",
        },
        { status: 507 } // Insufficient Storage
      );
    }

    const targetBucket = getBucketForMediaType(mediaConfig.mediaType);

    // 3. Generate signed upload URL from Supabase Storage (upsert = false)
    const { data: uploadSign, error: signError } = await supabase.storage
      .from(targetBucket)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signError || !uploadSign) {
      // Release reservation if Supabase Storage signing fails
      await supabase.rpc("release_storage_reservation_atomic", {
        p_token: reservationToken,
      });
      return NextResponse.json(
        { error: "Failed to generate secure upload authorization." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: uploadSign.signedUrl,
      path: uploadSign.path,
      token: uploadSign.token,
      bucket: targetBucket,
      reservationToken,
      mediaType: mediaConfig.mediaType,
      maxSizeBytes: reservation.reserved_size,
    });
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json(
      { error: "An internal server error occurred while preparing media upload." },
      { status: 500 }
    );
  }
}
