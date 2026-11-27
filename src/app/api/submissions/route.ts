import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  validateAndNormalizeContent,
  generatePublicCode,
} from "@/lib/security/content-filter";
import {
  getClientHmac,
  checkRateLimitPersistent,
  checkIdempotencyPersistent,
  setIdempotencyPersistent,
} from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { processSubmissionModeration } from "@/lib/gemini/moderation-worker";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify that database is configured; fail closed with 503 if unconfigured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !secretKey || supabaseUrl.includes("placeholder") || supabaseUrl.includes("your-project")) {
      return NextResponse.json(
        { error: "Submission service is currently unavailable. Database connection is not configured." },
        { status: 503 }
      );
    }

    // 2. Request payload size check (max 10KB)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10240) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed size (10KB)." },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const { message, recipient, turnstileToken, idempotencyKey, mediaAttachment, slides } = body;

    // Support both multi-slide (slides array) and legacy single message
    interface IncomingSlide {
      slideOrder: number;
      message: string;
      mediaAttachment?: {
        reservationToken: string;
        storagePath: string;
        mimeType: string;
        mediaType?: string;
      };
    }

    const rawSlides: IncomingSlide[] = Array.isArray(slides) && slides.length > 0
      ? slides
      : [{ slideOrder: 1, message: String(message || ""), mediaAttachment }];

    if (rawSlides.length > 2) {
      return NextResponse.json(
        { error: "Maximum 2 slides allowed per submission." },
        { status: 400 }
      );
    }
    if (mediaAttachment) {
      if (
        typeof mediaAttachment !== "object" ||
        !mediaAttachment.reservationToken ||
        !mediaAttachment.storagePath ||
        !mediaAttachment.mimeType
      ) {
        return NextResponse.json(
          { error: "Invalid media attachment payload." },
          { status: 400 }
        );
      }
    }

    // 3. Client identification (HMAC-SHA256 with server secret, never storing raw IP)
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0].trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const clientHmac = getClientHmac(ip, userAgent);

    // Initialize privileged admin client for server-side evaluation
    const supabase = createAdminSupabaseClient();

    // 4. Persistent Database-Backed Rate Limiting
    const rateLimit = await checkRateLimitPersistent(supabase, clientHmac, 5, 10);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many submissions. Please wait ${rateLimit.resetSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.resetSeconds.toString(),
          },
        }
      );
    }

    // 5. Cloudflare Turnstile bot verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.message },
        { status: 403 }
      );
    }

    // 6. Content Validation & Normalization for all slides
    const validatedSlides: Array<{
      slideOrder: number;
      normalizedMessage: string;
      mediaAttachment?: IncomingSlide["mediaAttachment"];
    }> = [];

    let combinedMessage = "";

    for (let i = 0; i < rawSlides.length; i++) {
      const s = rawSlides[i];
      const sCheck = validateAndNormalizeContent(s.message, recipient);
      if (!sCheck.valid) {
        return NextResponse.json(
          { error: `Slide ${i + 1}: ${sCheck.rejectionReason}` },
          { status: 400 }
        );
      }
      validatedSlides.push({
        slideOrder: i + 1,
        normalizedMessage: sCheck.normalizedMessage,
        mediaAttachment: s.mediaAttachment,
      });
      combinedMessage += (combinedMessage ? "\n---\n" : "") + sCheck.normalizedMessage;
    }

    const firstSlideNormalized = validatedSlides[0].normalizedMessage;
    const normalizedRecipient = validateAndNormalizeContent(firstSlideNormalized, recipient).normalizedRecipient;

    // 7. Persistent Idempotency Check (prevent duplicate inserts on network retries)
    const effectiveIdempotencyKey =
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey
        : createHash("sha256")
            .update(`${clientHmac}:${combinedMessage}:${normalizedRecipient || ""}`)
            .digest("hex");

    const existingPublicCode = await checkIdempotencyPersistent(supabase, effectiveIdempotencyKey);
    if (existingPublicCode) {
      return NextResponse.json({
        success: true,
        publicCode: existingPublicCode,
        message: "Your message is awaiting moderation.",
        isDuplicate: true,
      });
    }

    // 8. Verify app_settings allows incoming submissions
    const { data: settings } = await supabase
      .from("app_settings")
      .select("accept_submissions, max_message_length")
      .eq("id", "global")
      .maybeSingle();

    if (settings && !settings.accept_submissions) {
      return NextResponse.json(
        { error: "Submissions are currently paused by administration." },
        { status: 503 }
      );
    }

    const publicCode = generatePublicCode();

    // 9. Real Database Insertion
    const { data: inserted, error: dbError } = await supabase
      .from("submissions")
      .insert({
        public_code: publicCode,
        recipient: normalizedRecipient || null,
        message: firstSlideNormalized,
        status: "pending",
        moderation_status: "unreviewed",
      })
      .select("id, public_code, created_at")
      .single();

    if (dbError || !inserted) {
      console.error("Database submission error:", dbError);
      return NextResponse.json(
        { error: "Failed to persist submission to database. Please try again later." },
        { status: 500 }
      );
    }

    // 9a. Persist slides into submission_slides table if table is active
    for (const s of validatedSlides) {
      try {
        await supabase.from("submission_slides").insert({
          submission_id: inserted.id,
          slide_order: s.slideOrder,
          message: s.normalizedMessage,
        });
      } catch (slideErr) {
        console.warn("Non-fatal slide persistence notice:", slideErr);
      }
    }

    // 9b. Finalize and verify media attachment if present
    if (mediaAttachment) {
      try {
        const targetBucket = mediaAttachment.mediaType === "video" ? "bobfess-videos" : "bobfess-images";
        const { data: objectMeta, error: metaError } = await supabase.storage
          .from(targetBucket)
          .list(mediaAttachment.storagePath.split("/").slice(0, -1).join("/"), {
            search: mediaAttachment.storagePath.split("/").pop(),
          });

        const targetFile = objectMeta?.[0];
        const actualBytes = targetFile?.metadata?.size;

        if (metaError || !targetFile || !actualBytes || actualBytes <= 0) {
          // Object not found in storage or 0 bytes - rollback submission
          await supabase.from("submissions").delete().eq("id", inserted.id);
          await supabase.rpc("release_storage_reservation_atomic", {
            p_token: mediaAttachment.reservationToken,
          });
          return NextResponse.json(
            { error: "Uploaded media file could not be verified in storage." },
            { status: 400 }
          );
        }

        // Finalize atomic reservation
        const { data: finalizeData, error: finalizeErr } = await supabase.rpc(
          "finalize_storage_reservation_atomic",
          {
            p_token: mediaAttachment.reservationToken,
            p_actual_bytes: actualBytes,
          }
        );

        if (finalizeErr || !finalizeData?.[0]?.success) {
          // Exceeded quota or validation failure - remove object and rollback submission
          await supabase.storage.from(targetBucket).remove([mediaAttachment.storagePath]);
          await supabase.from("submissions").delete().eq("id", inserted.id);
          return NextResponse.json(
            { error: finalizeData?.[0]?.error_message || "Media validation failed." },
            { status: 400 }
          );
        }

        // Create confirmed media_assets record linked to submission
        const { error: mediaDbErr } = await supabase.from("media_assets").insert({
          submission_id: inserted.id,
          storage_path: `${targetBucket}/${mediaAttachment.storagePath}`,
          mime_type: mediaAttachment.mimeType,
          size_bytes: actualBytes,
          status: "pending",
        });

        if (mediaDbErr) {
          console.error("Failed to link media asset record:", mediaDbErr);
        }
      } catch (mediaErr) {
        console.error("Media finalization error:", mediaErr);
      }
    }

    // 10. Persist idempotency key
    await setIdempotencyPersistent(supabase, effectiveIdempotencyKey, inserted.public_code, 60);

    // 11. Write audit log (zero credentials, zero raw IPs)
    await supabase.from("system_logs").insert({
      event_type: "submission_created",
      severity: "info",
      metadata: {
        public_code: inserted.public_code,
        recipient_present: Boolean(normalizedRecipient),
      },
    });

    // 12. Trigger background moderation (Durable: submission already safely persisted)
    try {
      await processSubmissionModeration(inserted.id);
    } catch (modErr) {
      console.error("Non-fatal background moderation trigger error:", modErr);
    }

    return NextResponse.json({
      success: true,
      publicCode: inserted.public_code,
      status: "pending",
      message: "Your message is awaiting moderation.",
    });
  } catch (err) {
    console.error("Unexpected submission error:", err);
    return NextResponse.json(
      { error: "Internal server error processing submission." },
      { status: 500 }
    );
  }
}
