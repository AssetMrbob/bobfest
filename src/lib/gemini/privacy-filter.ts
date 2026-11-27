/**
 * Privacy-First Local Gatekeeper
 * Evaluates submissions before sending to external AI providers.
 * Detects sensitive personal data, contact info, PII, and routes high-privacy submissions to manual review.
 */

export interface PrivacyCheckResult {
  canSendToGemini: boolean;
  privacyFlagged: boolean;
  reason?: string;
  detectedSensitivePatterns: string[];
}

// Regex patterns for sensitive Indonesian and general PII
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const PHONE_REGEX = /(\+62|62|08)[0-9]{8,12}/;
const NIK_KTP_REGEX = /\b[0-9]{16}\b/; // Indonesian 16-digit National ID (NIK/KTP)
const BANK_ACCOUNT_REGEX = /\b[0-9]{10,14}\b/; // Bank account numbers
const SOCIAL_HANDLE_PHONE = /(@[a-zA-Z0-9._]+|wa\.me\/[0-9]+|t\.me\/[a-zA-Z0-9_]+)/i;

// Patterns indicating confidential allegations or extreme sensitivity that should never be sent to external free-tier AI
const SENSITIVE_ALLEGATIONS_REGEX = /\b(perkosaan|pelecehan seksual|korupsi|suap|teroris|bom bunuh diri|bunuh diri|sayat tangan|cut yourself)\b/i;

// Prompt injection detection patterns
const PROMPT_INJECTION_REGEX = /\b(ignore (all|previous|above) instructions|system prompt|reveal your prompt|anda adalah model|you are a moderation ai|output json only:.*decision.*approved|pretend you are|jailbreak|DAN mode)\b/i;

export function inspectPrivacyAndLocalSafety(
  message: string,
  recipient?: string | null,
  hasMedia: boolean = false
): PrivacyCheckResult {
  const detectedSensitivePatterns: string[] = [];

  // 1. Mandatory rule: If submission has media attachment, it requires manual human review
  if (hasMedia) {
    return {
      canSendToGemini: false,
      privacyFlagged: false,
      reason: "Submission contains media attachment; requires human moderator review.",
      detectedSensitivePatterns: ["media_attachment"],
    };
  }

  const combinedText = `${recipient || ""} ${message}`.trim();

  // 2. Email detection
  if (EMAIL_REGEX.test(combinedText)) {
    detectedSensitivePatterns.push("email_address");
  }

  // 3. Phone number / WhatsApp detection
  if (PHONE_REGEX.test(combinedText)) {
    detectedSensitivePatterns.push("phone_number");
  }

  // 4. Indonesian NIK/KTP
  if (NIK_KTP_REGEX.test(combinedText)) {
    detectedSensitivePatterns.push("nik_ktp_identity");
  }

  // 5. Bank Account Numbers
  if (BANK_ACCOUNT_REGEX.test(combinedText) && !combinedText.includes("2026")) {
    detectedSensitivePatterns.push("bank_account");
  }

  // 6. Social contact / direct messaging links
  if (SOCIAL_HANDLE_PHONE.test(combinedText)) {
    detectedSensitivePatterns.push("direct_contact_link");
  }

  // If PII or contact info is detected, do NOT send raw personal info to Gemini Free Tier
  if (detectedSensitivePatterns.length > 0) {
    return {
      canSendToGemini: false,
      privacyFlagged: true,
      reason: "Contains personal identifying contact details or financial/ID information.",
      detectedSensitivePatterns,
    };
  }

  // 7. Extreme confidential allegations or acute self-harm (Privacy & Safety protection)
  if (SENSITIVE_ALLEGATIONS_REGEX.test(combinedText)) {
    return {
      canSendToGemini: false,
      privacyFlagged: true,
      reason: "Contains high-sensitivity allegations or acute crisis topics requiring immediate confidential human handling.",
      detectedSensitivePatterns: ["acute_crisis_or_allegation"],
    };
  }

  // 8. Prompt Injection attempt detected locally
  if (PROMPT_INJECTION_REGEX.test(combinedText)) {
    // We can still send or locally flag as prompt injection
    return {
      canSendToGemini: true,
      privacyFlagged: false,
      reason: "Prompt injection markers detected.",
      detectedSensitivePatterns: ["suspected_prompt_injection"],
    };
  }

  return {
    canSendToGemini: true,
    privacyFlagged: false,
    detectedSensitivePatterns: [],
  };
}
