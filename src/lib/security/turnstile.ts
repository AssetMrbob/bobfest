/**
 * Cloudflare Turnstile Server Verification Helper
 *
 * Verifies Turnstile bot token server-side.
 * Strictly separates production and development environments.
 * Rejects test dummy keys and tokens in production.
 * Enforces token expiration and replay protection.
 */

// Cloudflare dummy test keys (ONLY permissible in development/test, NEVER production)
const CLOUDFLARE_DUMMY_KEYS = [
  "1x0000000000000000000000000000000AA", // Always passes
  "2x0000000000000000000000000000000AA", // Always fails
  "3x0000000000000000000000000000000AA", // Yields token-already-spent
];

// Short-lived in-memory cache to prevent token replay attacks (5 minute TTL)
const spentTokens = new Map<string, number>();

export interface TurnstileResult {
  success: boolean;
  message?: string;
}

export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === "production";

  // 1. Production security checks
  if (isProduction) {
    // Fail closed if Turnstile secret key is missing in production
    if (!secretKey) {
      return {
        success: false,
        message: "Bot protection is not configured on the server. Submissions are temporarily paused.",
      };
    }

    // Never accept dummy test keys in production
    if (CLOUDFLARE_DUMMY_KEYS.includes(secretKey)) {
      return {
        success: false,
        message: "Insecure test Turnstile keys are rejected in production mode.",
      };
    }

    // Reject missing token in production
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return {
        success: false,
        message: "Security verification token is missing. Please complete the security check.",
      };
    }

    // Reject dummy tokens in production
    if (token.includes("DUMMY") || token.includes("TEST")) {
      return {
        success: false,
        message: "Invalid verification token.",
      };
    }
  } else {
    // Development mode behavior:
    // If no secret key is set, allow local development testing
    if (!secretKey) {
      return { success: true };
    }
    // If token is missing in development when secret key IS set, prompt for token
    if (!token) {
      return {
        success: false,
        message: "Security verification token is missing.",
      };
    }
  }

  // 2. Replay Protection: Check if token has already been spent
  const now = Date.now();
  const tokenRecord = spentTokens.get(token);
  if (tokenRecord && tokenRecord > now) {
    return {
      success: false,
      message: "Security verification token has already been used. Please refresh.",
    };
  }

  // Prune expired spent tokens
  if (spentTokens.size > 5000) {
    for (const [key, expiry] of spentTokens.entries()) {
      if (expiry <= now) spentTokens.delete(key);
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const outcome = await response.json();
    if (!outcome.success) {
      return {
        success: false,
        message: "Security challenge verification failed. Please try again.",
      };
    }

    // Mark token as spent for 5 minutes (300,000 ms) to prevent replay
    spentTokens.set(token, now + 5 * 60 * 1000);

    return { success: true };
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return {
      success: false,
      message: "Unable to verify security challenge. Please try again later.",
    };
  }
}
