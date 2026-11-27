# menfess. — Project Blueprint

Comprehensive architecture, data contracts, security guidelines, and operational procedures for the **menfess.** anonymous Instagram publishing platform.

---

## 1. System Vision & Product Principles

`menfess.` is an anonymous editorial menfess platform that curates submissions into clean, Swiss-inspired Instagram feed carousels and companion Stories.

### Core Tenets
1. **Absolute Simplicity & Editorial Elegance**: Clean typography, white surfaces, no gratuitous gradients or AI aesthetics.
2. **Safety & Non-Doxxing by Default**: Every submission is checked via automated moderation rules and human curation before batching.
3. **Respectful Publishing Rhythm**: Exactly 2 feed publications daily (12:00 and 19:00 Asia/Jakarta), preventing feed fatigue and maximizing engagement.
4. **Data Minimization & Storage Hygiene**: Strict FIFO storage recycling that safeguards pending jobs while preventing storage overflow.

---

## 2. Global Mobile-First Standard (Permanent Project-Wide Requirement)

Mobile-first is a mandatory architectural baseline for all current and future phases of BOBFESS.

### 1. Viewport Matrix
Designs and implementations must be tested and optimized on mobile viewports first before desktop adaptation:
- **Small Mobile**: `320px` (iPhone SE 1st gen), `360px` (standard Android), `375px` (iPhone SE/Mini)
- **Standard Mobile**: `390px` (iPhone 12/13/14/15), `414px` (iPhone Plus/Max), `430px` (iPhone Pro Max)
- **Tablet & Desktop**: Fluid expansion (`md:`, `lg:`) with a centered maximum 500px column layout for submission forms.

### 2. Browser & In-App Target Compatibility
- **Primary Targets**: Instagram In-App Browser (WKWebView/Chrome WebView), iOS Safari, Android Chrome.
- **Dynamic Viewport Heights**: Must use `min-h-dvh` instead of `min-h-screen` to prevent toolbar jumping and bottom clipping.
- **Safe-Area Insets**: Proper padding for notches and dynamic island via `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.

### 3. Touch Ergonomics & Form Factors
- **44×44px Minimum Touch Targets**: Every button, navigation item, modal close trigger, and table action must provide at least 44×44px hit area.
- **16px Input Font Size (No iOS Auto-Zoom)**: All text inputs, textareas, and selects must use at least 16px (`text-base`) on mobile viewports to prevent iOS Safari from automatically zooming into the page.
- **Zero Horizontal Overflow**: `overflow-x-hidden` on body container, wrapping text, and fluid elements.
- **Mobile Admin Views**: Desktop tables must automatically adapt into touch-friendly cards/lists on mobile screens (`< 768px`) with one-tap moderation actions.

---

## 3. Technical Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | High-performance React framework, Server Components, and API routes |
| **Language** | TypeScript (Strict Mode) | Type safety and rigorous contract adherence |
| **Styling** | Tailwind CSS v4 | Utility-driven, token-based Swiss design system |
| **Typography** | Geist Sans & Geist Mono | High-legibility modern editorial typography |
| **Icons** | Lucide React | Clean 1.5–2px stroke icons |
| **Persistence (Phase 02)** | Supabase (PostgreSQL) | Submissions, queue slots, audit trails, and moderation state |
| **Authentication (Phase 02)**| Supabase Auth | Email/password administrator authentication with role check |
| **Security & Anti-Abuse** | In-Memory Sliding Window + Turnstile | Rate-limiting (5 req/10 min) and bot defense |
| **File Storage (Phase 03)** | Supabase Storage (S3-compatible) | User-attached photos and rendered slide artifacts |
| **AI Moderation (Phase 04)** | Google Gemini 2.5 Flash | Multimodal text and image toxicity screening |
| **Social API (Phase 04)** | Instagram Graph API | Container creation and carousel publishing |
| **Image Generation (Phase 04)**| Sharp | Server-side 1080×1350 (4:5) slide canvas rendering |

---

## 3. Database Schema Specification (Phase 02 Implemented)

### `submissions`
- `id` (UUID, Primary Key, `DEFAULT gen_random_uuid()`)
- `public_code` (VARCHAR(32), UNIQUE NOT NULL, e.g. `MF-K7W92QPA`)
- `recipient` (VARCHAR(100), Optional)
- `message` (TEXT, 1–500 chars, `CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 500)`)
- `status` (`submission_status_enum`: `'pending'`, `'needs_review'`, `'approved'`, `'queued'`, `'publishing'`, `'published'`, `'rejected'`, `'failed'`)
- `moderation_status` (VARCHAR(50), Default `'unreviewed'`)
- `moderation_reason` (TEXT, Optional)
- `created_at` (TIMESTAMPTZ, Default `now()`)
- `updated_at` (TIMESTAMPTZ, Default `now()`)
- `published_at` (TIMESTAMPTZ, Optional)

### `media_assets` (Prepared for Phase 03)
- `id` (UUID, Primary Key)
- `submission_id` (UUID, Foreign Key → `submissions.id` ON DELETE CASCADE)
- `storage_path` (TEXT NOT NULL)
- `mime_type` (VARCHAR(100) NOT NULL)
- `size_bytes` (BIGINT NOT NULL, `CHECK (size_bytes > 0)`)
- `status` (VARCHAR(50), Default `'pending'`)
- `created_at` (TIMESTAMPTZ, Default `now()`)
- `deleted_at` (TIMESTAMPTZ, Optional)

### `admin_profiles`
- `user_id` (UUID, Primary Key, Foreign Key → `auth.users.id` ON DELETE CASCADE)
- `role` (VARCHAR(50), Default `'admin'`)
- `created_at` (TIMESTAMPTZ, Default `now()`)

### `app_settings` (Single-Row Configuration)
- `id` (VARCHAR(50), Primary Key, Check `id = 'global'`)
- `accept_submissions` (BOOLEAN, Default `true`)
- `auto_publish_enabled` (BOOLEAN, Default `false`)
- `max_daily_feed_posts` (INT, Default `2`)
- `publish_times` (TEXT[], Default `ARRAY['12:00', '19:00']`)
- `timezone` (VARCHAR(50), Default `'Asia/Jakarta'`)
- `auto_story_enabled` (BOOLEAN, Default `true`)
- `max_carousel_slides` (INT, Default `5`)
- `max_message_length` (INT, Default `500`)
- `max_image_size_mb` (INT, Default `5`)
- `max_video_size_mb` (INT, Default `20`)
- `storage_capacity_limit_percent` (INT, Default `95`)
- `storage_warning_percent` (INT, Default `90`)
- `storage_cleanup_target_percent` (INT, Default `85`)
- `updated_at` (TIMESTAMPTZ, Default `now()`)

### `publication_batches`
- `id` (UUID, Primary Key)
- `scheduled_time` (TIMESTAMPTZ NOT NULL)
- `status` (VARCHAR(50), Default `'scheduled'`)
- `carousel_container_id` (TEXT, Optional)
- `story_container_id` (TEXT, Optional)
- `permalink` (TEXT, Optional)
- `published_at` (TIMESTAMPTZ, Optional)
- `created_at` (TIMESTAMPTZ, Default `now()`)

### `publication_items`
- `id` (UUID, Primary Key)
- `batch_id` (UUID, Foreign Key → `publication_batches.id` ON DELETE CASCADE)
- `submission_id` (UUID, Foreign Key → `submissions.id` ON DELETE CASCADE, UNIQUE)
- `slide_order` (INT NOT NULL)
- `created_at` (TIMESTAMPTZ, Default `now()`)

### `moderation_logs`
- `id` (UUID, Primary Key)
- `submission_id` (UUID, Foreign Key → `submissions.id` ON DELETE CASCADE)
- `previous_status` (VARCHAR(50) NOT NULL)
- `new_status` (VARCHAR(50) NOT NULL)
- `moderation_reason` (TEXT, Optional)
- `decision_source` (VARCHAR(50), Default `'admin'`)
- `admin_user_id` (UUID, Foreign Key → `auth.users.id` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, Default `now()`)

### `system_logs`
- `id` (UUID, Primary Key)
- `event_type` (VARCHAR(100) NOT NULL)
- `severity` (VARCHAR(20), Default `'info'`)
- `metadata` (JSONB, Default `'{}'::jsonb`)
- `created_at` (TIMESTAMPTZ, Default `now()`)

---

## 4. Row Level Security (RLS) Policies

All tables have RLS enabled with least-privilege security:

1. **Anonymous Public Users**:
   - Zero direct database access (`SELECT`, `UPDATE`, `DELETE` disallowed).
   - Submissions happen exclusively through the `/api/submissions` Route Handler using the privileged service-role client following validation, rate limiting, and PII checks.
2. **Authorized Administrators**:
   - Evaluated by the SQL function `public.is_admin()` which queries `public.admin_profiles WHERE user_id = auth.uid() AND role = 'admin'`.
   - Full read/write access to `submissions`, `media_assets`, `publication_batches`, `publication_items`, `moderation_logs`, `system_logs`, and `app_settings`.

---

## 5. First Administrator Provisioning

To provision the first administrator securely:

1. Create the user in Supabase Auth (Dashboard → Authentication → Users → Add User, or via SQL):
```sql
-- Replace with the desired admin email and password hash
-- Or create the user via Supabase Dashboard UI, then note their UUID
INSERT INTO public.admin_profiles (user_id, role)
VALUES ('<USER-UUID-FROM-AUTH.USERS>', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```
2. Only users present in `public.admin_profiles` with `role = 'admin'` can pass the `is_admin()` check and access `/admin/*` views.

---

## 6. Anonymous Submission Pipeline

```
[Public Visitor]
       │
       ▼
1. Client Form Submission (POST /api/submissions)
       │
       ├── Payload size check (<= 10KB)
       ├── Rate limit check (5 requests per 10 min per client hash)
       ├── Cloudflare Turnstile token validation (fail-closed in production)
       ├── Server text normalization (collapse newlines, trim, <= 500 chars)
       ├── PII detection (rejects phone numbers, emails, sensitive contact keywords)
       ├── Idempotency check (returns existing public code if duplicate click within 60s)
       │
       ▼
2. Database Insertion (via Server-Side Admin Client)
       │
       ├── Verify app_settings.accept_submissions === true
       ├── Generate unique public_code (e.g. MF-K7W92QPA)
       ├── Insert into submissions table with status = 'pending'
       └── Write audit event to system_logs
       │
       ▼
3. Return { success: true, publicCode: "MF-..." }
       │
       ▼
4. Client displays verified Success Screen with unique reference
```
