# menfess. — Project Blueprint

Comprehensive architecture, data contracts, and operational guidelines for the **menfess.** anonymous Instagram publishing platform.

---

## 1. System Vision & Product Principles

`menfess.` is an anonymous editorial menfess platform that curates submissions into clean, Swiss-inspired Instagram feed carousels and companion Stories.

### Core Tenets
1. **Absolute Simplicity & Editorial Elegance**: Clean typography, white surfaces, no gratuitous gradients or AI aesthetics.
2. **Safety & Non-Doxxing by Default**: Every submission is checked via automated moderation rules and human curation before batching.
3. **Respectful Publishing Rhythm**: Exactly 2 feed publications daily (12:00 and 19:00 Asia/Jakarta), preventing feed fatigue and maximizing engagement.
4. **Data Minimization & Storage Hygiene**: Strict FIFO storage recycling that safeguards pending jobs while preventing storage overflow.

---

## 2. Technical Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | High-performance React framework, Server Components, and API routes |
| **Language** | TypeScript (Strict Mode) | Type safety and rigorous contract adherence |
| **Styling** | Tailwind CSS v4 | Utility-driven, token-based design system |
| **Typography** | Geist Sans & Geist Mono | High-legibility modern editorial typography |
| **Icons** | Lucide React | Clean 1.5–2px stroke icons |
| **Persistence (Phase 02)** | Supabase (PostgreSQL) | Submissions, queue slots, audit trails, and moderation state |
| **File Storage (Phase 02)** | Supabase Storage (S3-compatible) | User-attached photos and rendered slide artifacts |
| **AI Moderation (Phase 02)** | Google Gemini 2.5 Flash | Multimodal text and image toxicity screening |
| **Social API (Phase 02)** | Instagram Graph API | Container creation and carousel publishing |
| **Image Generation (Phase 02)**| Sharp | Server-side 1080×1350 (4:5) slide canvas rendering |
| **Bot Protection (Phase 02)** | Cloudflare Turnstile | Server-verified anti-spam |

---

## 3. Future Business Rules & Architecture Contracts

```
+-----------------------------------------------------------------------------------+
|                               SUBMISSION PIPELINE                                 |
+-----------------------------------------------------------------------------------+
| [Public Visitor]                                                                  |
|       │                                                                           |
|       ▼                                                                           |
| 1. Form Validation (Max 500 chars, <=5MB img, <=20MB vid)                         |
|       │                                                                           |
|       ▼                                                                           |
| 2. Cloudflare Turnstile Bot Token Verification (Server-Side)                      |
|       │                                                                           |
|       ▼                                                                           |
| 3. Storage Quota Reservation (Ensure < 95% threshold)                             |
|       │                                                                           |
|       ▼                                                                           |
| 4. Gemini 2.5 Flash Automated Toxicity Screening                                  |
|       │                                                                           |
|       ├── If flagged ──► Needs Human Review (Admin Inbox)                         |
|       └── If clean   ──► Auto-Approve candidate                                   |
+-----------------------------------------------------------------------------------+
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                               PUBLISHING PIPELINE                                 |
+-----------------------------------------------------------------------------------+
| Scheduled Supabase Cron Job: 12:00 WIB & 19:00 WIB (Asia/Jakarta)                 |
|       │                                                                           |
|       ▼                                                                           |
| 1. Batch up to 5 approved messages into Carousel Queue                            |
|       │                                                                           |
|       ▼                                                                           |
| 2. Sharp Worker renders:                                                          |
|       • Feed Slides: 1080×1350 (4:5 Portrait)                                     |
|       • Companion Story: 1080×1920 (9:16 Vertical)                                |
|       │                                                                           |
|       ▼                                                                           |
| 3. Instagram Graph API:                                                           |
|       • Create Carousel Container                                                 |
|       • Publish Feed Post                                                         |
|       • Immediately publish Companion Story upon Feed success                     |
|       │                                                                           |
|       ▼                                                                           |
| 4. Status set to "published"                                                      |
|       │                                                                           |
|       ▼                                                                           |
| 5. Automated FIFO Storage Lifecycle:                                              |
|       • Trigger when storage >= 95% capacity                                      |
|       • Purge oldest published media targeting 85% capacity                       |
|       • Protected Rule: Never delete media linked to pending or publishing jobs   |
+-----------------------------------------------------------------------------------+
```

---

## 4. Database Schema Specification (Prepared)

### `submissions`
- `id` (UUID, Primary Key)
- `recipient` (VARCHAR(100), Optional)
- `message` (TEXT, 1–500 chars)
- `media_url` (TEXT, Optional)
- `media_type` (ENUM: `'image'`, `'video'`, NULL)
- `media_size_bytes` (BIGINT, Optional)
- `status` (ENUM: `'pending'`, `'approved'`, `'rejected'`, `'queued'`, `'published'`)
- `created_at` (TIMESTAMPTZ, Default NOW)
- `moderated_at` (TIMESTAMPTZ, Optional)
- `moderated_by` (UUID, Admin Reference)
- `ip_hash` (TEXT, Anonymized SHA-256 for rate-limiting)

### `publishing_queue`
- `id` (UUID, Primary Key)
- `slot_timestamp` (TIMESTAMPTZ)
- `slot_label` (ENUM: `'12:00_WIB'`, `'19:00_WIB'`)
- `submission_ids` (UUID[], Array of up to 5 IDs)
- `feed_container_id` (TEXT, Instagram Container ID)
- `story_container_id` (TEXT, Instagram Story Container ID)
- `status` (ENUM: `'pending'`, `'generating'`, `'ready'`, `'published'`, `'failed'`)
- `published_at` (TIMESTAMPTZ, Optional)

---

## 5. Security & Boundary Rules

1. **Zero Secret Exposure**: All API keys (Supabase Service Role, Gemini API key, Instagram tokens, Turnstile secret) stay strictly on the server side (`process.env`).
2. **Anonymous Public Experience**: Public visitors require zero authentication and are protected from metadata profiling.
3. **Fail-Safe Design**: If Gemini API or Instagram Graph API is unresponsive, submissions gracefully queue rather than dropping data.
