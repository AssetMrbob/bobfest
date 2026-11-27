import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  validateAndNormalizeContent,
  generatePublicCode,
} from "@/lib/security/content-filter";
import {
  getClientHash,
  checkRateLimit,
  checkIdempotency,
  setIdempotency,
} from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // 1. Request payload size check (max 10KB for text submission)
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

    // 2. Client identification & Rate Limiting
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0].trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const clientHash = getClientHash(ip, userAgent);

    const rateLimit = checkRateLimit(clientHash, 5, 10 * 60 * 1000);
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

    // 3. Turnstile bot protection check
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.message },
        { status: 403 }
      );
    }

    // 4. Content Validation & Normalization (500 chars, PII rejection)
    const contentCheck = validateAndNormalizeContent(message, recipient);
    if (!contentCheck.valid) {
      return NextResponse.json(
        { error: contentCheck.rejectionReason },
        { status: 400 }
      );
    }

    // 5. Idempotency Check (prevent duplicate clicks)
    const effectiveIdempotencyKey =
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey
        : createHash("sha256")
            .update(`${clientHash}:${contentCheck.normalizedMessage}:${contentCheck.normalizedRecipient || ""}`)
            .digest("hex");

    const existingPublicCode = checkIdempotency(effectiveIdempotencyKey);
    if (existingPublicCode) {
      return NextResponse.json({
        success: true,
        publicCode: existingPublicCode,
        message: "Your message is awaiting moderation.",
        isDuplicate: true,
      });
    }

    const publicCode = generatePublicCode();

    // 6. Database Insertion
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("placeholder")) {
      // Supabase is not configured yet in local environment.
      // Save in idempotency map and return clean response explaining the credentials state
      setIdempotency(effectiveIdempotencyKey, publicCode);

      return NextResponse.json({
        success: true,
        publicCode,
        status: "pending",
        message: "Your message is awaiting moderation. (Local mode: Supabase credentials pending in .env.local)",
      });
    }

    // Insert into real Supabase Database via privileged admin client
    const supabase = createAdminSupabaseClient();

    // Verify app_settings allows submissions
    const { data: settings } = await supabase
      .from("app_settings")
      .select("accept_submissions, max_message_length")
      .eq("id", "global")
      .single();

    if (settings && !settings.accept_submissions) {
      return NextResponse.json(
        { error: "Submissions are currently paused by administration." },
        { status: 503 }
      );
    }

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

    // Record idempotency
    setIdempotency(effectiveIdempotencyKey, inserted.public_code);

    // Audit log
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
