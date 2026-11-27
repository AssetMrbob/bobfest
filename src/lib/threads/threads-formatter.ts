/**
 * Threads Content & Payload Formatter
 * 
 * Formatting Correction Rules:
 * 1. Remove all automatically generated labels:
 *    - [Kampung Inggris Fess] branding labels
 *    - Slide 1 labels (e.g. "Slide 1:", "[Slide 1]", "(Slide 1)")
 *    - Slide 2 labels (e.g. "Slide 2:", "[Slide 2]", "(Slide 2)")
 *    - Slide numbering and continuation labels (e.g. "(1/2)", "2/2:", "(Cont.)", "(bersambung)", "(Lanjutan)")
 * 2. For single-slide submissions:
 *    - Publish original approved message directly as the root post.
 * 3. For two-slide submissions:
 *    - Publish first message as the root post.
 *    - Publish second message as a direct reply to the root post.
 *    - Do not add any slide numbering or continuation labels to either post.
 * 4. Preserve original wording, punctuation, emojis, and paragraph breaks.
 * 5. Default to clean, natural text without automatic branding prefixes, hashtags, reference codes, or promotional CTAs.
 * 6. Preserve administrator-configured optional captions (prefix, suffix, tracking code) if explicitly enabled.
 * 7. Enforce Threads 500-character limit with zero silent truncation.
 */

export interface ThreadsPayloadFormattingOptions {
  threadsPrefix?: string | null;
  threadsSuffix?: string | null;
  threadsShowRefCode?: boolean | null;
}

export interface FormattedThreadsPayloadItem {
  text: string;
  charCount: number;
  exceedsLimit: boolean;
  isExceedingLimit: boolean;
  error?: string;
}

export interface FormattedThreadsPayload {
  rootPost: FormattedThreadsPayloadItem;
  replyPost: FormattedThreadsPayloadItem | null;
  isMultiSlide: boolean;
  isTwoSlide: boolean;
  slideCount: number;
  isValid: boolean;
  error?: string;
}

/**
 * Cleans a confession message for Threads publication by stripping
 * automatically generated labels and numbering while preserving
 * original wording, punctuation, emojis, and paragraph breaks.
 */
export function cleanThreadsMessage(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText.trim();
  let prev = "";

  // Iteratively strip stacked/nested labels (e.g. "[Kampung Inggris Fess]\nSlide 1: ...")
  while (cleaned !== prev) {
    prev = cleaned;

    // 1. Remove [Kampung Inggris Fess] branding labels (at beginning, end, or standalone)
    cleaned = cleaned.replace(/^\s*\[\s*Kampung\s+Inggris\s+Fess\s*\]\s*[:\-\—\.]*\s*/i, "");
    cleaned = cleaned.replace(/^\s*Kampung\s+Inggris\s+Fess\s*[:\-\—]\s*/i, "");
    cleaned = cleaned.replace(/\s*\[\s*Kampung\s+Inggris\s+Fess\s*\]\s*$/i, "");
    cleaned = cleaned.replace(/^\s*#KampungInggrisFess\b\s*/i, "");
    cleaned = cleaned.replace(/\s*#KampungInggrisFess\b\s*$/i, "");

    // 2. Remove Slide 1 / Slide 2 / Slide N labels
    cleaned = cleaned.replace(/^\s*\[?\s*Slide\s*\d+(?:\s*\/\s*\d+)?\s*\]?\s*[:\-\—\.]*\s*/i, "");
    cleaned = cleaned.replace(/^\s*\(?\s*Slide\s*\d+(?:\s*\/\s*\d+)?\s*\)?\s*[:\-\—\.]*\s*/i, "");
    cleaned = cleaned.replace(/\s*\[?\s*Slide\s*\d+(?:\s*\/\s*\d+)?\s*\]?\s*$/i, "");
    cleaned = cleaned.replace(/\s*\(?\s*Slide\s*\d+(?:\s*\/\s*\d+)?\s*\)?\s*$/i, "");

    // 3. Remove Slide numbering e.g. "1/2:", "(1/2)", "[1/2]", "2/2", "(2/2)", "[2/2]", "(1/1)", etc.
    cleaned = cleaned.replace(/^\s*[\(\[]?\s*\d+\s*\/\s*\d+\s*[\)\]]?\s*[:\-\—\.]*\s*/, "");
    cleaned = cleaned.replace(/\s*[\(\[]?\s*\d+\s*\/\s*\d+\s*[\)\]]?\s*$/, "");

    // 4. Remove continuation labels like "(Cont.)", "[Cont.]", "Continuation:", "(bersambung)", "(Lanjutan)", "Lanjutan:", "cont'd", etc.
    cleaned = cleaned.replace(
      /^\s*[\(\[]?\s*(?:Cont(?:\.|inuation)?|bersambung|lanjutan|cont['’]?d)\s*[\)\]]?\s*[:\-\—\.]*\s*/i,
      ""
    );
    cleaned = cleaned.replace(
      /\s*(?:\.{2,}\s*)?[\(\[]?\s*(?:Cont(?:\.|inuation)?|bersambung|lanjutan|cont['’]?d)\s*[\)\]]?\s*$/i,
      ""
    );

    cleaned = cleaned.trim();
  }

  return cleaned;
}

/**
 * Formats a submission into Threads payloads for root post and optional reply post.
 * Both manual publishing, automated background worker, and admin preview use this
 * identical function to guarantee exact payload parity.
 * Supports both object params and positional params (submission, slides, settings).
 */
export function formatThreadsPayload(
  submissionOrParams: {
    public_code?: string;
    message?: string;
    submission?: { public_code: string; message: string };
    slides?: Array<{ slide_order: number; message: string }> | null;
    settings?: ThreadsPayloadFormattingOptions | null;
  },
  maybeSlides?: Array<{ slide_order: number; message: string }> | null,
  maybeSettings?: ThreadsPayloadFormattingOptions | null
): FormattedThreadsPayload {
  // Support both object and positional invocations
  let submission: { public_code: string; message: string };
  let slides: Array<{ slide_order: number; message: string }> | null | undefined;
  let settings: ThreadsPayloadFormattingOptions | null | undefined;

  if (submissionOrParams && "submission" in submissionOrParams && submissionOrParams.submission) {
    submission = submissionOrParams.submission;
    slides = submissionOrParams.slides;
    settings = submissionOrParams.settings;
  } else {
    submission = {
      public_code: submissionOrParams.public_code || "MENFESS",
      message: submissionOrParams.message || "",
    };
    slides = maybeSlides !== undefined ? maybeSlides : (submissionOrParams.slides || null);
    settings = maybeSettings !== undefined ? maybeSettings : (submissionOrParams.settings || null);
  }

  // Determine slide messages
  const orderedSlides = (slides && slides.length > 0)
    ? [...slides].sort((a, b) => a.slide_order - b.slide_order)
    : [{ slide_order: 1, message: submission.message }];

  const rawSlide1 = orderedSlides[0]?.message || submission.message || "";
  const rawSlide2 = orderedSlides.length > 1 ? orderedSlides[1]?.message : null;

  // 1. Clean root message
  const cleanedSlide1 = cleanThreadsMessage(rawSlide1);

  // 2. Administrator-configured optional additions (preserved if explicitly enabled)
  // Clean, natural text by default: no automatic prefix, suffix, refTag, or CTAs.
  const prefix = (settings?.threadsPrefix && settings.threadsPrefix.trim() !== "" && !settings.threadsPrefix.includes("Kampung Inggris Fess"))
    ? `${settings.threadsPrefix.trim()}\n\n`
    : "";

  const suffix = (settings?.threadsSuffix && settings.threadsSuffix.trim() !== "")
    ? `\n\n${settings.threadsSuffix.trim()}`
    : "";

  const refTag = (settings?.threadsShowRefCode === true)
    ? `\n\n#${submission.public_code}`
    : "";

  // 3. Assemble root text adhering strictly to 500-char limit without silent truncation
  let rootText = "";
  let rootExceedsLimit = false;
  let rootError: string | undefined;

  if (cleanedSlide1.length > 500) {
    rootText = cleanedSlide1;
    rootExceedsLimit = true;
    rootError = `Message text (${cleanedSlide1.length} chars) exceeds Threads limit of 500 chars. Held for manual review.`;
  } else {
    // Attempt with all administrator-configured optional additions
    const fullText = `${prefix}${cleanedSlide1}${refTag}${suffix}`;
    if (fullText.length <= 500) {
      rootText = fullText;
    } else {
      // Omit optional additions progressively to protect original message
      const textWithoutSuffix = `${prefix}${cleanedSlide1}${refTag}`;
      if (textWithoutSuffix.length <= 500) {
        rootText = textWithoutSuffix;
      } else {
        const textWithRefOnly = `${cleanedSlide1}${refTag}`;
        if (textWithRefOnly.length <= 500) {
          rootText = textWithRefOnly;
        } else {
          // Strictly fallback to clean original approved message
          rootText = cleanedSlide1;
        }
      }
    }
  }

  const rootPost: FormattedThreadsPayloadItem = {
    text: rootText,
    charCount: rootText.length,
    exceedsLimit: rootExceedsLimit,
    isExceedingLimit: rootExceedsLimit,
    error: rootError,
  };

  // 4. Assemble continuation reply (Slide 2) if two-slide submission
  let replyPost: FormattedThreadsPayloadItem | null = null;
  const isTwoSlide = Boolean(rawSlide2 && rawSlide2.trim().length > 0);

  if (isTwoSlide && rawSlide2) {
    const cleanedSlide2 = cleanThreadsMessage(rawSlide2);
    const replyExceeds = cleanedSlide2.length > 500;
    const replyError = replyExceeds
      ? `Slide 2 text (${cleanedSlide2.length} chars) exceeds Threads limit of 500 chars. Held for manual review.`
      : undefined;

    replyPost = {
      text: cleanedSlide2,
      charCount: cleanedSlide2.length,
      exceedsLimit: replyExceeds,
      isExceedingLimit: replyExceeds,
      error: replyError,
    };
  }

  // 5. Validation status
  let isValid = !rootPost.exceedsLimit;
  let overallError: string | undefined;

  if (rootPost.exceedsLimit) {
    isValid = false;
    overallError = rootPost.error;
  } else if (replyPost && replyPost.exceedsLimit) {
    isValid = false;
    overallError = replyPost.error;
  }

  const isMultiSlide = isTwoSlide;
  const slideCount = isTwoSlide ? 2 : 1;

  return {
    rootPost,
    replyPost,
    isMultiSlide,
    isTwoSlide,
    slideCount,
    isValid,
    error: overallError,
  };
}
