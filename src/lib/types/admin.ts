/**
 * Admin Panel & Operational Type Definitions
 */
import { Submission } from "./submission";

export interface DashboardMetrics {
  totalSubmissions: number;
  queuedMessages: number;
  publishedToday: number;
  messagesNeedingReview: number;
  nextScheduledSlot: {
    time: string;
    timezone: string;
    countdownMinutes: number;
    targetCount: number;
  };
  storage: {
    totalBytes: number;
    usedBytes: number;
    percentUsed: number;
    thresholdPercent: number;
    targetFifoPercent: number;
    isSafe: boolean;
  };
  integrations: {
    supabaseDb: IntegrationState;
    supabaseStorage: IntegrationState;
    geminiModeration: IntegrationState;
    instagramGraph: IntegrationState;
    cloudflareTurnstile: IntegrationState;
  };
}

export interface IntegrationState {
  name: string;
  connected: boolean;
  statusText: string;
  lastChecked?: string;
}

export interface QueueSlot {
  id: string;
  timeSlot: string; // "12:00 WIB" | "19:00 WIB"
  scheduledDate: string;
  carouselTitle: string;
  submissions: Submission[];
  status: "scheduled" | "processing" | "ready" | "published";
  estimatedSlides: number;
}

export interface PublishedPost {
  id: string;
  instagramPostId: string;
  permalink: string;
  publishedAt: string;
  feedSlideCount: number;
  companionStoryPublished: boolean;
  storyPublishedAt?: string;
  totalMessages: number;
  previewUrl: string;
  submissions: Array<{
    id: string;
    recipient?: string;
    snippet: string;
  }>;
}

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  showWatermark: boolean;
  isDefault: boolean;
}
