import { Submission } from "./types/submission";
import {
  DashboardMetrics,
  QueueSlot,
  PublishedPost,
  CarouselTemplate,
} from "./types/admin";

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "sub-101",
    recipient: "Library 3rd floor guy with the blue hoodie",
    message: "You left your notebook yesterday around 4 PM. Left it with the front desk librarian so you can get it back safely.",
    status: "pending",
    createdAt: "2026-11-27T14:45:00+07:00",
    moderationNotes: "Needs review: Mentions specific location, but helpful and non-identifying.",
  },
  {
    id: "sub-102",
    recipient: "To whoever needs to hear this",
    message: "Don't beat yourself up over this exam week. You prepared the best you could, and a grade will never define your worth.",
    status: "queued",
    createdAt: "2026-11-27T13:20:00+07:00",
    scheduledSlot: "19:00 WIB",
  },
  {
    id: "sub-103",
    recipient: "D",
    message: "Every time I walk past our old bench near the arts building, I still think about that rainy afternoon in October.",
    status: "queued",
    createdAt: "2026-11-27T12:05:00+07:00",
    scheduledSlot: "19:00 WIB",
  },
  {
    id: "sub-104",
    recipient: undefined,
    message: "Campus coffee shop baristas make the hardest days tolerable. Thank you for always remembering my iced oat latte order without me saying a word.",
    status: "approved",
    createdAt: "2026-11-27T11:30:00+07:00",
  },
  {
    id: "sub-105",
    recipient: "Prof. Sarah",
    message: "Your lectures are honestly the highlight of my week. Thank you for teaching with such clarity and patience.",
    status: "published",
    createdAt: "2026-11-27T09:15:00+07:00",
  },
  {
    id: "sub-106",
    recipient: "Room 402",
    message: "Please turn down the speaker bass after midnight. We have 7 AM presentations tomorrow.",
    status: "rejected",
    createdAt: "2026-11-27T08:10:00+07:00",
    moderationNotes: "Rejected: Targeted room complaint; please contact building administration directly.",
  },
  {
    id: "sub-107",
    recipient: "Architect class of '24",
    message: "Studio deadline week is finally over. Good luck with juries everybody! We made it through.",
    status: "queued",
    createdAt: "2026-11-27T07:50:00+07:00",
    scheduledSlot: "19:00 WIB",
  },
];

export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  totalSubmissions: 1420,
  queuedMessages: 4,
  publishedToday: 10,
  messagesNeedingReview: 1,
  nextScheduledSlot: {
    time: "19:00 WIB",
    timezone: "Asia/Jakarta",
    countdownMinutes: 218,
    targetCount: 5,
  },
  storage: {
    totalBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    usedBytes: 14.8 * 1024 * 1024 * 1024, // 14.8 GB
    percentUsed: 29.6,
    thresholdPercent: 95,
    targetFifoPercent: 85,
    isSafe: true,
  },
  integrations: {
    supabaseDb: {
      name: "Supabase Database",
      connected: false,
      statusText: "Prepared (Phase 02)",
      lastChecked: "2026-11-27 15:00",
    },
    supabaseStorage: {
      name: "Supabase Storage",
      connected: false,
      statusText: "Prepared (Phase 02)",
      lastChecked: "2026-11-27 15:00",
    },
    geminiModeration: {
      name: "Gemini 2.5 Flash Moderation",
      connected: false,
      statusText: "Prepared (Phase 02)",
      lastChecked: "2026-11-27 15:00",
    },
    instagramGraph: {
      name: "Instagram Graph API",
      connected: false,
      statusText: "Prepared (Phase 02)",
      lastChecked: "2026-11-27 15:00",
    },
    cloudflareTurnstile: {
      name: "Cloudflare Turnstile",
      connected: false,
      statusText: "Prepared (Phase 02)",
      lastChecked: "2026-11-27 15:00",
    },
  },
};

export const MOCK_QUEUE_SLOTS: QueueSlot[] = [
  {
    id: "slot-evening-today",
    timeSlot: "19:00 WIB",
    scheduledDate: "2026-11-27",
    carouselTitle: "Evening Batch #142 (4/5 Filled)",
    status: "scheduled",
    estimatedSlides: 4,
    submissions: [
      MOCK_SUBMISSIONS[1],
      MOCK_SUBMISSIONS[2],
      MOCK_SUBMISSIONS[6],
    ],
  },
  {
    id: "slot-noon-tomorrow",
    timeSlot: "12:00 WIB",
    scheduledDate: "2026-11-28",
    carouselTitle: "Midday Batch #143 (0/5 Filled)",
    status: "scheduled",
    estimatedSlides: 0,
    submissions: [],
  },
];

export const MOCK_PUBLISHED_POSTS: PublishedPost[] = [
  {
    id: "pub-01",
    instagramPostId: "C1x98kL2sY9",
    permalink: "https://instagram.com/p/mock-141",
    publishedAt: "2026-11-27T12:00:00+07:00",
    feedSlideCount: 5,
    companionStoryPublished: true,
    storyPublishedAt: "2026-11-27T12:00:45+07:00",
    totalMessages: 5,
    previewUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    submissions: [
      { id: "sub-090", recipient: "To the campus cat", snippet: "Stay warm this chilly evening." },
      { id: "sub-091", recipient: "Canteen stall 4", snippet: "Best nasi goreng in the whole city." },
      { id: "sub-092", snippet: "Wishing everyone a productive study session." },
      { id: "sub-093", recipient: "K", snippet: "I saw you smiling today, it made my day." },
      { id: "sub-094", snippet: "Semester ending countdown begins!" },
    ],
  },
  {
    id: "pub-02",
    instagramPostId: "C1v88jP9aZ1",
    permalink: "https://instagram.com/p/mock-140",
    publishedAt: "2026-11-26T19:00:00+07:00",
    feedSlideCount: 5,
    companionStoryPublished: true,
    storyPublishedAt: "2026-11-26T19:01:02+07:00",
    totalMessages: 5,
    previewUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80",
    submissions: [
      { id: "sub-080", recipient: "Batch 2022", snippet: "Who is taking advanced stats next term?" },
      { id: "sub-081", snippet: "Take a break, drink water, stretch your back." },
      { id: "sub-082", recipient: "Yellow raincoat", snippet: "Thanks for sharing your umbrella at the bus stop." },
    ],
  },
];

export const MOCK_TEMPLATES: CarouselTemplate[] = [
  {
    id: "tpl-swiss-clean",
    name: "Swiss Minimalist (Default)",
    description: "Monochrome editorial typography with 4:5 portrait ratio and generous whitespace.",
    canvasWidth: 1080,
    canvasHeight: 1350,
    backgroundColor: "#FFFFFF",
    textColor: "#171717",
    accentColor: "#2563EB",
    fontFamily: "Geist Sans",
    fontSize: 52,
    showWatermark: true,
    isDefault: true,
  },
  {
    id: "tpl-editorial-serif",
    name: "Editorial Quiet",
    description: "Subtle off-white background with high-contrast centered words.",
    canvasWidth: 1080,
    canvasHeight: 1350,
    backgroundColor: "#FAFAFA",
    textColor: "#171717",
    accentColor: "#2563EB",
    fontFamily: "Geist Mono",
    fontSize: 48,
    showWatermark: true,
    isDefault: false,
  },
];
