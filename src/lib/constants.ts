/**
 * Core Application Constants & Future Business Rules
 *
 * Defines design tokens, limits, storage quotas, and publishing rules.
 */

export const DESIGN_TOKENS = {
  colors: {
    background: "#FFFFFF",
    surfaceSecondary: "#FAFAFA",
    primaryAccent: "#2563EB",
    primaryAccentHover: "#1D4ED8",
    primaryText: "#171717",
    secondaryText: "#737373",
    border: "#E5E7EB",
  },
  radius: {
    sm: "8px",
    md: "10px",
    lg: "12px",
  },
} as const;

export const APP_CONFIG = {
  name: "Kampung Inggris Fess",
  shortName: "KIFess",
  tagline: "Tell ur untold story!",
  description: "An anonymous community platform for Kampung Inggris students, alumni, visitors, and locals. Managed by Mr.BOB Kampung Inggris.",
  communityPositioning: "An anonymous community platform for Kampung Inggris. Managed by Mr.BOB Kampung Inggris.",
  instagramHandle: "kampunginggrisfess",
  instagramUrl: "https://www.instagram.com/kampunginggrisfess/",
  threadsHandle: "kampunginggrisfess",
  threadsUrl: "https://www.threads.com/@kampunginggrisfess",
} as const;

/**
 * Future Business Rules (Phase 02 Architecture)
 */
export const BUSINESS_RULES = {
  // Submission constraints
  maxCharacterCount: 500,
  maxImageSizeMB: 5,
  maxVideoSizeMB: 20,
  maxImageSizeBytes: 5 * 1024 * 1024,
  maxVideoSizeBytes: 20 * 1024 * 1024,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoTypes: ["video/mp4", "video/quicktime", "video/webm"],

  // Publishing schedule (Asia/Jakarta timezone)
  timezone: "Asia/Jakarta",
  maxDailyFeedPublications: 2,
  scheduledSlotsWIB: ["12:00", "19:00"],
  maxMessagesPerCarousel: 5,
  autoPublishCompanionStory: true,

  // Storage lifecycle rules
  storageMaxCapacityThresholdPercent: 95,
  storageFifoCleanupTargetPercent: 85,
  reserveStorageBeforeUpload: true,
  protectMediaInPendingJobs: true,
} as const;
