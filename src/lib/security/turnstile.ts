/**
 * Cloudflare Turnstile Server Verification Helper
 *
 * Verifies Turnstile bot token server-side.
 * In production (`NODE_ENV === "production"`), fails closed if Turnstile is required but unconfigured.
 */

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

  // If secret key is not set:
  if (!secretKey) {
    if (isProduction) {
      // Fail closed in production for security compliance
      return {
        success: false,
        message: "Bot protection is not configured on the server. Submissions are temporarily paused.",
      };
    }
    // In local development, allow submissions to proceed without Turnstile secret
    return { success: true };
  }

  if (!token) {
    return {
      success: false,
      message: "Security challenge verification token is missing.",
    };
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
        message: "Security challenge failed. Please refresh and try again.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return {
      success: false,
      message: "Unable to verify bot challenge. Please try again later.",
    };
  }
}
