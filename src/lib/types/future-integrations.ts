/**
 * Future System Architecture Contracts & Interfaces
 *
 * Prepared interfaces for Phase 02 integrations with:
 * - Supabase Database & Storage
 * - Supabase Auth & Cron
 * - Gemini API (Automated AI Moderation)
 * - Instagram Graph API (Feed Carousel & Stories)
 * - Cloudflare Turnstile (Bot Protection)
 * - Sharp Image Rendering
 */

/**
 * 1. Supabase Database Interfaces
 */
export interface SupabaseDatabaseSchema {
  tables: {
    submissions: {
      Row: {
        id: string;
        recipient: string | null;
        message: string;
        media_url: string | null;
        media_type: "image" | "video" | null;
        media_size_bytes: number | null;
        status: "pending" | "approved" | "rejected" | "queued" | "published";
        created_at: string;
        moderated_at: string | null;
        moderated_by: string | null;
        ip_hash: string | null;
      };
      Insert: Omit<SupabaseDatabaseSchema["tables"]["submissions"]["Row"], "id" | "created_at">;
      Update: Partial<SupabaseDatabaseSchema["tables"]["submissions"]["Insert"]>;
    };
    publishing_queue: {
      Row: {
        id: string;
        slot_timestamp: string;
        slot_label: "12:00_WIB" | "19:00_WIB";
        submission_ids: string[];
        status: "pending" | "generating" | "ready" | "published" | "failed";
        feed_container_id: string | null;
        story_container_id: string | null;
        published_at: string | null;
      };
    };
    storage_audit: {
      Row: {
        id: string;
        current_used_bytes: number;
        capacity_percentage: number;
        cleaned_files_count: number;
        created_at: string;
      };
    };
  };
}

/**
 * 2. Supabase Storage & FIFO Cleanup
 */
export interface StorageCapacityPolicy {
  maxCapacityThresholdPercent: 95;
  fifoTargetCleanupPercent: 85;
  reserveStorageBeforeUpload: (fileSizeBytes: number) => Promise<boolean>;
  runFifoCleanup: () => Promise<{ freedBytes: number; deletedCount: number }>;
}

/**
 * 3. Gemini API AI Content Moderation Contract
 */
export interface GeminiModerationRequest {
  text: string;
  hasAttachment: boolean;
  mimeType?: string;
  mediaBase64OrUri?: string;
}

export interface GeminiModerationResult {
  flagged: boolean;
  confidenceScore: number; // 0 to 1
  categories: {
    harassment: boolean;
    hateSpeech: boolean;
    sexuallyExplicit: boolean;
    dangerousContent: boolean;
    doxxingOrPII: boolean;
  };
  suggestedAction: "auto_approve" | "needs_human_review" | "auto_reject";
  reasoningNotes?: string;
}

/**
 * 4. Instagram Graph API Publishing Contracts
 */
export interface InstagramFeedCarouselPayload {
  caption: string;
  imageUrls: string[]; // Up to 5 slides
  scheduledPublishTime?: string;
}

export interface InstagramStoryPayload {
  mediaUrl: string; // 1080x1920 Companion Story
  storySwipeUpOrSticker?: string;
}

export interface InstagramPublishResult {
  success: boolean;
  feedPostId?: string;
  storyPostId?: string;
  permalink?: string;
  errorMessage?: string;
}

/**
 * 5. Cloudflare Turnstile Verification Contract
 */
export interface TurnstileVerificationRequest {
  token: string;
  remoteIp?: string;
}

export interface TurnstileVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

/**
 * 6. Sharp Image Rendering Contracts
 */
export interface SlideRenderingOptions {
  dimensions: {
    feed: { width: 1080; height: 1350 }; // 4:5 Portrait Feed
    story: { width: 1080; height: 1920 }; // 9:16 Companion Story
  };
  typography: {
    fontFamily: string;
    headlineSize: number;
    bodySize: number;
    lineHeight: number;
  };
  branding: {
    watermarkText: string;
    handle: string;
  };
}
