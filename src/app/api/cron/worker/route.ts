import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runBackgroundWorker } from "@/lib/publishing/background-worker";

/**
 * Constant-time comparison to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
      // Dummy comparison to equalize timing
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Validates request authorization.
 * Strict rules:
 * - Only server-only CRON_SECRET accepted via Authorization header (Bearer token).
 * - Reject secrets in public query strings.
 * - Reject missing or malformed credentials.
 * - Environment protection: Fail closed if CRON_SECRET is not configured.
 */
function isAuthorizedCronRequest(req: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret || configuredSecret.trim().length < 16) {
    console.error("[CronWorker] CRON_SECRET is not configured or insufficiently strong.");
    return false;
  }

  // Check URL query parameters - MUST be rejected if secret is passed in query string
  const url = new URL(req.url);
  if (url.searchParams.has("secret") || url.searchParams.has("key") || url.searchParams.has("cron_secret")) {
    console.warn("[CronWorker] Rejected request attempting to pass secrets in URL query string.");
    return false;
  }

  // Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  return secureCompare(token, configuredSecret);
}

/**
 * POST /api/cron/worker
 * Secure background worker endpoint invoked by pg_cron + pg_net or trusted schedulers.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing bearer credentials." },
      { status: 401 }
    );
  }

  try {
    // Parse optional body for trigger parameters
    let body: { triggerSource?: "cron" | "manual" | "diagnostic"; forceRunSlot?: boolean; dryRun?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is standard for cron
    }

    const summary = await runBackgroundWorker({
      triggerSource: body.triggerSource || "cron",
      forceRunSlot: body.forceRunSlot || false,
      dryRun: body.dryRun ?? true, // Default to dry-run for safety unless specified
    });

    return NextResponse.json({
      success: summary.status === "success" || summary.status === "skipped_disabled",
      summary,
    });
  } catch (err) {
    console.error("[CronWorker] Unexpected worker execution failure:", err);
    return NextResponse.json(
      { error: "Internal worker execution error", message: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/worker
 * Diagnostic check endpoint (Authorized only, returns scheduler state without performing public mutations).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing bearer credentials." },
      { status: 401 }
    );
  }

  try {
    const summary = await runBackgroundWorker({
      triggerSource: "diagnostic",
      dryRun: true,
    });

    return NextResponse.json({
      diagnostic: true,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to retrieve diagnostics", message: (err as Error).message },
      { status: 500 }
    );
  }
}
