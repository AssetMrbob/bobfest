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

export async function POST(request: NextRequest) {
  try {
    // 1. Verify that database is configured; fail closed with 503 if unconfigured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("placeholder") || supabaseUrl.includes("your-project")) {
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

    const { message, recipient, turnstileToken, idempotencyKey } = body;

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

    // 6. Content Validation & Normalization (500 chars, PII detection)
    const contentCheck = validateAndNormalizeContent(message, recipient);
    if (!contentCheck.valid) {
      return NextResponse.json(
        { error: contentCheck.rejectionReason },
        { status: 400 }
      );
    }

    // 7. Persistent Idempotency Check (prevent duplicate inserts on network retries)
    const effectiveIdempotencyKey =
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey
        : createHash("sha256")
            .update(`${clientHmac}:${contentCheck.normalizedMessage}:${contentCheck.normalizedRecipient || ""}`)
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
        recipient: contentCheck.normalizedRecipient || null,
        message: contentCheck.normalizedMessage,
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

    // 10. Persist idempotency key
    await setIdempotencyPersistent(supabase, effectiveIdempotencyKey, inserted.public_code, 60);

    // 11. Write audit log (zero credentials, zero raw IPs)
    await supabase.from("system_logs").insert({
      event_type: "submission_created",
      severity: "info",
      metadata: {
        public_code: inserted.public_code,
        recipient_present: Boolean(contentCheck.normalizedRecipient),
      },
    });

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
