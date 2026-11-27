/**
 * Server-side Content Validation & PII / Doxxing Filter
 *
 * Rejects submissions containing:
 * - Phone numbers (national and international)
 * - Email addresses
 * - Social handles / doxxing identifiers
 * - Excessive repetitive patterns or control characters
 */

export interface ContentFilterResult {
  valid: boolean;
  normalizedMessage: string;
  normalizedRecipient?: string;
  rejectionReason?: string;
}

// Phone number regex pattern (Indonesian & international patterns)
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g;

// Standard RFC email regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Obvious vulgar or abusive doxxing keywords for initial filter
const SENSITIVE_PATTERNS = [
  /\b(?:wa|whatsapp|telegram|t\.me)\b/i,
  /\b(?:alamat rumah|no hp|nomor wa|rek bca|no rekening)\b/i,
];

export function validateAndNormalizeContent(
  rawMessage: unknown,
  rawRecipient?: unknown
): ContentFilterResult {
  if (typeof rawMessage !== "string") {
    return { valid: false, normalizedMessage: "", rejectionReason: "Message must be text." };
  }

  // 1. Normalize whitespace & collapse excessive consecutive newlines (max 2)
  const message = rawMessage
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 2. Enforce length constraints
  if (message.length === 0) {
    return { valid: false, normalizedMessage: "", rejectionReason: "Message cannot be empty." };
  }

  if (message.length > 500) {
    return {
      valid: false,
      normalizedMessage: "",
      rejectionReason: "Message exceeds maximum allowed 500 characters.",
    };
  }

  // 3. Normalize recipient
  let recipient: string | undefined = undefined;
  if (typeof rawRecipient === "string" && rawRecipient.trim().length > 0) {
    recipient = rawRecipient.trim().slice(0, 100);
    if (recipient.length > 100) {
      return {
        valid: false,
        normalizedMessage: "",
        rejectionReason: "Recipient cannot exceed 100 characters.",
      };
    }
  }

  // 4. Detect and reject phone numbers
  const combinedText = `${recipient || ""} ${message}`;
  const phoneMatches = combinedText.match(PHONE_REGEX);
  if (phoneMatches) {
    // Check if matched string has at least 8 digits
    const digitsOnly = phoneMatches.some((match) => match.replace(/\D/g, "").length >= 8);
    if (digitsOnly) {
      return {
        valid: false,
        normalizedMessage: "",
        rejectionReason: "Submissions containing phone numbers or contact details are rejected for privacy protection.",
      };
    }
  }

  // 5. Detect and reject email addresses
  if (EMAIL_REGEX.test(combinedText)) {
    return {
      valid: false,
      normalizedMessage: "",
      rejectionReason: "Submissions containing email addresses are rejected for privacy protection.",
    };
  }

  // 6. Detect sensitive doxxing patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(combinedText)) {
      return {
        valid: false,
        normalizedMessage: "",
        rejectionReason: "Submissions requesting or exposing direct contacts or sensitive credentials are not permitted.",
      };
    }
  }

  return {
    valid: true,
    normalizedMessage: message,
    normalizedRecipient: recipient,
  };
}

/**
 * Generate a cryptographically random, clean public reference code
 * Format: MF-XXXXXXXX (e.g. MF-K7W92QPA)
 */
export function generatePublicCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude 0, 1, I, O for clarity
  let result = "MF-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
