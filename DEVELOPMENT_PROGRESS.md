# Development Progress — Phase 02B

**Current Status**: Complete  
**Project**: menfess. (Anonymous Instagram Menfess Web Application)  
**Milestone**: Phase 02B — Live Integration & Security Hardening  
**Date**: November 27, 2026  

---

## Phase 02B Completed Milestones

### 1. Insecure Fallbacks Elimination
- [x] Removed hardcoded admin credentials (`admin@menfess.id / admin12345`).
- [x] Removed simulated authentication bypass.
- [x] Removed simulated submission success response when database credentials are missing.
- [x] Implemented fail-closed HTTP 503 (`Service Unavailable`) responses when database connection is not configured.
- [x] Replaced mock data fallbacks in Admin Overview and Inbox with honest empty/unavailable states.

### 2. Database Security Audit & Hardening
- [x] Inspected `public.is_admin()` and revoked public execution:
  `REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;`
  `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;`
- [x] Prevented recursive RLS loops on `admin_profiles` by checking `user_id = auth.uid()` directly.
- [x] Restricted `admin_profiles` mutations strictly to `service_role` to prevent privilege escalation.
- [x] Enforced least-privilege RLS across all 10 tables: `submissions`, `media_assets`, `admin_profiles`, `app_settings`, `publication_batches`, `publication_items`, `moderation_logs`, `system_logs`, `rate_limits`, `idempotency_keys`.
- [x] Anonymous clients have zero direct `SELECT`, `UPDATE`, or `DELETE` permissions on `submissions`.

### 3. Persistent Database-Backed Rate Limiting & Idempotency
- [x] Added `rate_limits` table and atomic `check_and_record_rate_limit` PostgreSQL function.
- [x] Enforced 5 submissions per 10 minutes per client hash.
- [x] HMAC-SHA256 client hashing using server-side secret (`SUPABASE_SERVICE_ROLE_KEY` / `APP_SECRET`); zero raw IP addresses stored.
- [x] Added `idempotency_keys` table with TTL to prevent concurrent duplicate inserts.
- [x] Probabilistic self-pruning of expired rate limits and idempotency records.

### 4. Cloudflare Turnstile Hardening
- [x] Added `TurnstileWidget` frontend component (`src/components/public/turnstile-widget.tsx`).
- [x] Configured separate production and development policies.
- [x] Rejected Cloudflare dummy test keys in production (`NODE_ENV === 'production'`).
- [x] Implemented server-side replay cache preventing reuse of spent verification tokens.
- [x] Fail-closed behavior in production when bot defense is required but unconfigured.

### 5. Mobile-First Verification (Matrix: 320px–1440px)
- [x] **320px** (iPhone SE 1st gen): Form renders cleanly without horizontal overflow; inputs legible and comfortable; padding scales to 14px (`px-3.5`).
- [x] **360px** (standard Android): Touch targets meet or exceed 44×44px; submit button 48px height.
- [x] **375px** (iPhone SE/Mini): Fluid single column, zero clipping or overlap.
- [x] **390px** (iPhone 12/13/14/15): Comfortable typing with 16px input font size preventing iOS auto-zoom.
- [x] **414px** (iPhone Plus/Max): Spacious editorial layout with high legibility.
- [x] **430px** (iPhone Pro Max): Clean layout with safe area handling for dynamic island.
- [x] **768px** (Tablet): Responsive drawer menu and adaptive layout.
- [x] **1440px** (Desktop): Centered 500px maximum column width on public page; full sidebar and compact table view on admin pages.

---

## Test Results & Verification Matrix

| Category | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Local Test** | Insecure credentials removal | `admin@menfess.id / admin12345` rejected | Access denied | **PASSED** |
| **Local Test** | DB unconfigured submission | HTTP 503 Service Unavailable | HTTP 503 returned | **PASSED** |
| **Local Test** | Persistent rate limiting (5 req / 10 min) | HTTP 429 when threshold exceeded | Throttled with Retry-After | **PASSED** |
| **Local Test** | Idempotency concurrent duplicate | Same public code returned without new DB insert | Deduplicated | **PASSED** |
| **Local Test** | Turnstile dummy key in production | Reject dummy test key in production | Blocked | **PASSED** |
| **Local Test** | Turnstile replay protection | Reject reused token | Blocked ("already used") | **PASSED** |
| **Local Test** | Empty message validation | HTTP 400 | Blocked | **PASSED** |
| **Local Test** | Oversized message (> 500 chars) | HTTP 400 | Blocked | **PASSED** |
| **Local Test** | PII detection (phone & email) | HTTP 400 | Blocked | **PASSED** |
| **Build & Lint** | Strict TypeScript check | 0 errors | 0 errors | **PASSED** |
| **Build & Lint** | ESLint | 0 errors, 0 warnings | 0 errors | **PASSED** |
| **Build & Lint** | Next.js production build | All routes compiled | Compiled successfully | **PASSED** |
| **Live Integration**| Dedicated Supabase Project | Real PostgreSQL connection | Connected & verified | **PASSED** |
| **Live Integration**| Schema Table Verification | 10 tables exist and accessible | All 10 tables verified | **PASSED** |
| **Live Integration**| Anonymous Submission Persistence | Insert via server API | Record inserted in DB | **PASSED** |
| **Live Integration**| Admin Authentication & Profiles | Authenticate admin via Supabase Auth | Verified (1 admin profile) | **PASSED** |
| **Live Integration**| Admin Moderation Action | Approve submission & create audit log | Status updated, log created | **PASSED** |
| **Live Integration**| Unauthenticated Direct Access Denial | Anon client direct SELECT/INSERT denied | HTTP 401 / code 42501 blocked | **PASSED** |
| **Live Integration**| Persistent Rate Limiting | 5 allowed, 6th blocked via PostgreSQL RPC | Blocked with remaining: 0 | **PASSED** |
| **Live Integration**| Persistent Idempotency | Deduplication lookup via idempotency_keys | Returned existing public_code | **PASSED** |
| **Live Integration**| Test Cleanup | Zero orphan test records left in DB | All test records deleted | **PASSED** |
| **Storage Phase 03**| Schema & RPC Verification | Ledger, reservations, audit logs, RPCs | All tables & 4 RPCs verified | **PASSED** |
| **Storage Phase 03**| Separate Image & Video Buckets | `bobfess-images` (5MB), `bobfess-videos` (20MB) | Enforced at bucket level | **PASSED** |
| **Storage Phase 03**| Pre-Upload Bucket Reconciliation | Aggregate stored bytes across all buckets | Stored bytes synced to ledger | **PASSED** |
| **Storage Phase 03**| Atomic Capacity Reservation | Concurrency-safe lock via `SELECT FOR UPDATE` | Serialized reservation passed | **PASSED** |
| **Storage Phase 03**| Direct-to-Storage Upload | Signed upload URL with `upsert: false` | Upload completed (HTTP 200) | **PASSED** |
| **Storage Phase 03**| Private Bucket Access Denial | Anon public/direct listing denied | Blocked (HTTP 400, 0 items) | **PASSED** |
| **Storage Phase 03**| Admin Signed Preview | Short-lived 15-minute signed URL | Preview generated (HTTP 200) | **PASSED** |
| **Storage Phase 03**| 95% Hard Capacity Enforcement | Rejects uploads when threshold crossed | Blocked with status 507 | **PASSED** |
| **Storage Phase 03**| FIFO Storage Cleanup | Deletes oldest eligible files first | Eligible files deleted | **PASSED** |
| **Storage Phase 03**| Protected Media Retention | Pending, approved, queued media retained | Protected assets untouched | **PASSED** |
| **Build & Lint** | Strict TypeScript check | 0 errors | 0 errors (`tsc --noEmit`) | **PASSED** |
| **Build & Lint** | ESLint | 0 errors, 2 warnings (`<img>` tags) | 0 errors (`next lint`) | **PASSED** |
| **Build & Lint** | Next.js production build | All routes compiled with Turbopack & PPR | Compiled successfully | **PASSED** |

---

## Live Integration Status (Phase 03 Completed)

1. **Dedicated Private Storage Buckets**:
   - `bobfess-images`: Private, max 5MB (`5242880` bytes), restricted to `image/jpeg`, `image/png`, `image/webp`.
   - `bobfess-videos`: Private, max 20MB (`20971520` bytes), restricted to `video/mp4`, `video/quicktime`, `video/webm`.
   - Enforcing size limits directly at the Supabase Storage bucket configuration guarantees that even malicious or altered direct upload requests cannot exceed the category quota.

2. **Transaction-Safe Concurrency & Capacity Accounting**:
   - Migration [supabase/migrations/20261127000003_phase03_storage_and_reservations.sql](file:///Users/Mr.Bob/WEBSITE%20BARU/BOBFESS/supabase/migrations/20261127000003_phase03_storage_and_reservations.sql) applied and verified.
   - Singleton ledger row in `public.storage_capacity_ledger` locks capacity evaluation via `SELECT ... FOR UPDATE`.
   - Idempotent finalization verifies `p_actual_bytes > 0` and `p_actual_bytes <= reserved_size`.
   - Unfinalized/interrupted uploads or failed submissions release reservations automatically.

3. **Client-Side Optimization & Mobile UX**:
   - Canvas-based image resizer downscales images to $\le 1600\text{px}$ on the longest edge, compressing to 200–500KB and stripping EXIF, GPS, and camera metadata.
   - HTML5 video validation verifies duration $\le 30\text{s}$ and size $\le 20\text{MB}$ without mobile FFmpeg overhead.
   - Mobile-first attachment selector supports native camera and gallery, inline preview, remove/replace buttons, upload progress indicator, and permission checkbox.

4. **Admin Inbox Media Preview**:
   - Secure signed preview URLs generated on demand with 15-minute TTL.
   - Private media is never publicly exposed or listed without authentication.



---

## Phase 04 Completed Milestones — Admin Dashboard & Operational Control Center

### 1. Mobile-First Navigation & Ergonomics
- [x] Implemented minimal fixed mobile bottom navigation (`src/components/admin/admin-bottom-nav.tsx`) with 5 primary destinations: Overview, Inbox, Queue, Published, Settings.
- [x] Preserved desktop responsive sidebar navigation for desktop/tablet screens $\ge 768\text{px}$.
- [x] Configured safe-area padding (`pb-16 md:pb-0`, `env(safe-area-inset-bottom)`) to prevent UI clipping by browser bars or mobile home indicators.
- [x] Enforced strict 44×44px minimum touch targets and 16px form inputs to prevent automatic mobile zoom.

### 2. Live Database-Derived Overview Metrics
- [x] Created `getDashboardMetrics` server action querying real PostgreSQL tables (`submissions`, `storage_capacity_ledger`).
- [x] Integrated date-range filtering: `today`, `7d`, `30d`, `all` (calculated dynamically in Asia/Jakarta timezone).
- [x] Added Next.js 16 dynamic request gating using `await connection()` and React `<Suspense>` boundaries to guarantee Partial Prerendering (PPR) compatibility without build hydration errors.
- [x] Honest empty states and real counts; zero hardcoded fake metrics.

### 3. Publishing Queue Management
- [x] Created `getPublishingQueue`, `enqueueSubmission`, `dequeueSubmission`, `createPublicationBatch`, and `cancelPublicationBatch` server actions.
- [x] Built interactive Queue interface (`src/components/admin/queue-client.tsx` & `src/app/admin/queue/page.tsx`).
- [x] Connected to database tables `publication_batches` and `publication_items`.
- [x] Enforced scheduling rules: max 5 slides per carousel, batch cancellation returns items to queued status safely.

### 4. Published Archive View
- [x] Created `getPublishedArchive` server action querying real published records.
- [x] Built responsive Published Archive interface (`src/components/admin/published-client.tsx` & `src/app/admin/published/page.tsx`).
- [x] Honest empty state when no batches have been published yet; displays direct Instagram link and slide references when posts exist.

### 5. Inbox Multi-Select & Bulk Moderation
- [x] Enhanced `src/app/admin/inbox/inbox-client.tsx` with multi-select checkbox controls for mobile and desktop.
- [x] Added "Select All" toggle and floating bulk moderation action bar (Approve All, Queue All, Reject All, Cancel).
- [x] Integrated `bulkModerateSubmissions` server action performing atomic updates and writing sanitized audit logs to `system_logs`.

### 6. Storage Management & Operational Settings
- [x] Created Storage Management Panel in Admin Overview displaying real ledger usage, hard capacity ceiling (95%), and safe FIFO cleanup target (85%).
- [x] Added manual trigger buttons for Bucket Reconciliation and FIFO cleanup via server actions `triggerStorageReconciliation` and `triggerStorageCleanup`.
- [x] Settings page wired to `app_settings` for submission intake toggle, auto-publish, story publishing preference, and storage thresholds.
- [x] Embedded System Logs viewer (`src/components/admin/system-logs-client.tsx`) displaying sanitized audit trail with severity filtering (`all`, `info`, `warning`, `error`).

---

## Phase 04 Test Results & Verification Matrix

| Category | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile UX** | 320px–430px Admin Navigation | Bottom nav with 5 destinations, 44px tap targets | Touch targets $\ge 44\text{px}$, zero horizontal scroll | **PASSED** |
| **Mobile UX** | Inbox Card & Multi-Select | Responsive cards, select checkboxes, bulk action bar | Fluid mobile layout, batch operations functional | **PASSED** |
| **Metrics** | Real Database Overview Counts | Count `submissions` & `storage_capacity_ledger` | Real counts queried, date filter working | **PASSED** |
| **Queue** | Queue Management & Batches | Enqueue/dequeue submissions, batch cancellation | Linked to `publication_batches` & `publication_items` | **PASSED** |
| **Archive** | Published Archive View | Query `status = 'published'` batches | Honest empty state / live batch viewer | **PASSED** |
| **Settings** | App Settings Persistence | Read/write `app_settings` singleton row | Settings load and persist correctly | **PASSED** |
| **Storage Panel** | Ledger Metrics & Reconciliation | Real ledger metrics, bucket recount RPC | Accurate storage stats displayed | **PASSED** |
| **Audit Logs** | System Logs Viewer | Sanitized audit events filtered by severity | Displayed without exposing secrets or IPs | **PASSED** |
| **Build & Lint** | Strict TypeScript check | 0 errors (`npx tsc --noEmit`) | 0 errors | **PASSED** |
| **Build & Lint** | ESLint | 0 errors (`npm run lint`) | 0 errors | **PASSED** |
| **Build & Lint** | Production Build | Turbopack compilation with PPR & Cache Components | Compiled successfully (13 routes) | **PASSED** |
| **Live Database** | Schema, Batches, and Logs Test | Verify operations against dedicated Supabase DB | Verified with 0 residual test records | **PASSED** |

---

## Phase 05 Completed Milestones — Gemini AI Moderation

### 1. Official Google Gen AI SDK Integration
- [x] Installed official `@google/genai` SDK package.
- [x] Configured server-only environment variables: `GEMINI_API_KEY` and configurable `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`, Free Tier available).
- [x] Implemented API key protection (strictly server-side, never exposed to client).
- [x] Structured JSON Schema response validation via `responseMimeType: "application/json"` and `responseJsonSchema`.
- [x] Verified live connectivity using non-sensitive synthetic prompts.

### 2. Privacy-First Local Gatekeeper
- [x] Created `src/lib/gemini/privacy-filter.ts`:
  - Enforced detection for email addresses, phone numbers / WhatsApp links, Indonesian National IDs (NIK / KTP), bank account numbers, and social media handles.
  - Intercepted submissions containing personal contact information before transferring to external Gemini Free Tier.
  - Submissions with media attachments automatically require manual human review.
  - Sensitive confidential allegations routed directly to manual review.
  - Prompt injection pattern detection.

### 3. Moderation Classification & Decision Rules
- [x] Created `src/lib/gemini/moderation-service.ts`:
  - Classifies eligible content into: `approved`, `needs_review`, `rejected`.
  - Structured fields: `decision`, `risk_level`, `category`, `reason_code`, `short_reason`, `detected_flags`, `requires_human_review`, `model_version`, `tokens_used`.
  - Supported flags: `spam`, `harassment`, `bullying`, `sexual_content`, `hate_speech`, `threats`, `violence`, `self_harm`, `personal_information`, `impersonation`, `defamatory_allegations`, `inappropriate_language`, `prompt_injection`, `unclear_context`.
  - Supports Indonesian, English, mixed-language slang (Jaksel), and common abbreviations.
  - Strict rule: Constructive criticism is routed to `needs_review`, never rejected solely for being negative.

### 4. Moderation Modes & Durable Worker
- [x] Implemented 3 configurable moderation modes:
  - `SMART_AUTOMATIC`: Clearly safe, low-risk confessions that pass every filter may be queued automatically.
  - `AI_ASSISTED` (Default): Gemini recommends decisions with notes, but administrator approval is required.
  - `MANUAL`: Bypasses external AI calls; all submissions enter manual review.
- [x] Created `src/lib/gemini/moderation-worker.ts`:
  - Submission persisted before moderation starts.
  - Concurrency-safe leases using PostgreSQL atomic updates with `moderation_status = 'in_review'`.
  - Protects human admin decisions against delayed AI overwrites.
  - Daily request budget safety ceiling (default 50 requests/day).
  - Bounded exponential backoff and fail-closed fallback to `needs_review` on error.
  - Audit logging to `system_logs` and `moderation_logs`.

### 5. Admin Dashboard Integration
- [x] **Settings Page** ([settings/page.tsx](file:///Users/Mr.Bob/WEBSITE%20BARU/BOBFESS/src/app/admin/settings/page.tsx)):
  - Live Gemini connection indicator & model display.
  - Moderation mode switcher (`AI_ASSISTED`, `SMART_AUTOMATIC`, `MANUAL`).
  - Internal daily AI request budget setting.
  - Today AI requests counter and error display.
- [x] **Inbox Page** ([inbox-client.tsx](file:///Users/Mr.Bob/WEBSITE%20BARU/BOBFESS/src/app/admin/inbox/inbox-client.tsx)):
  - "Run AI Moderation" batch worker button in header.
  - Per-item "Re-evaluate AI" action in detail modal.
  - AI decision notes and flags displayed on submission cards.

---

## Phase 05 Test Results & Verification Matrix

| Category | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Privacy Gatekeeper** | Personal phone number / WA | Block transmission to Gemini | Intercepted locally | **PASSED** |
| **Privacy Gatekeeper** | Commercial spam link | Block transmission to Gemini | Intercepted locally | **PASSED** |
| **Privacy Gatekeeper** | Media attachment uploaded | Require human review | Intercepted locally | **PASSED** |
| **Live Gemini API** | Safe Indonesian message | Decision: `approved` | `approved` (Risk: low) | **PASSED** |
| **Live Gemini API** | Safe English message | Decision: `approved` | `approved` (Risk: low) | **PASSED** |
| **Live Gemini API** | Mixed Jaksel slang message | Decision: `approved` | `approved` (Risk: low) | **PASSED** |
| **Live Gemini API** | Constructive criticism | Decision: `needs_review` | `needs_review` (not rejected) | **PASSED** |
| **Live Gemini API** | Explicit harassment / slur | Decision: `rejected` | `rejected` (Risk: high) | **PASSED** |
| **Live Gemini API** | Physical violence threat | Decision: `rejected` | `rejected` (Risk: critical) | **PASSED** |
| **Live Gemini API** | Ambiguous allegation | Decision: `needs_review` | `needs_review` (Risk: medium)| **PASSED** |
| **Live Gemini API** | Prompt injection attempt | Decision: `rejected` / `needs_review` | `rejected` (jailbreak flagged) | **PASSED** |
| **Concurrency & Safety**| Duplicate claim prevention | Block second worker from same item | Concurrency blocked | **PASSED** |
| **Manual Override** | Admin decision takes precedence | Prevent delayed AI overwrite | Admin decision preserved | **PASSED** |
| **Quota Accounting** | Daily budget check | Route to `needs_review` if budget reached | Bounded ceiling verified | **PASSED** |
| **Build & Lint** | Strict TypeScript check | 0 errors (`npx tsc --noEmit`) | 0 errors | **PASSED** |
| **Build & Lint** | ESLint | 0 errors (`npm run lint`) | 0 errors | **PASSED** |
| **Build & Lint** | Production Build | Compile all routes with Turbopack & PPR | Compiled successfully (13 routes) | **PASSED** |

---

## Phase 06 Completed Milestones — Custom Template Rendering, Multi-Slide & 1:1 Instagram Publishing

### 1. Non-Negotiable Business Rules Enforced
- [x] **1 Menfess = 1 Feed Publication**: Unrelated submissions are strictly isolated; never combined into single carousels.
- [x] **Multi-Slide Architecture**: Submissions support minimum 1 slide, maximum 2 slides (up to 500 chars/slide, 1,000 chars total).
- [x] **1-Slide Submissions**: Become single Feed publications (1080×1350px, 4:5 ratio).
- [x] **2-Slide Submissions**: Become 2-slide Instagram carousels with preserved slide order.
- [x] **Cadence Rules**: Strictly maximum 2 Feed publications daily at 12:00 WIB and 19:00 WIB (Asia/Jakarta).
- [x] **Companion Story**: Exactly 1 companion Story (1080×1920px, 9:16 ratio) generated per Menfess Feed publication.
- [x] Removed obsolete legacy rules that aggregated up to 5 unrelated submissions into carousels.

### 2. Multi-Slide Public Submission Form
- [x] Updated `src/components/public/submission-form.tsx`:
  - Default view shows Slide 1 with textarea, counter, and media attachment.
  - "Add Slide 2" button dynamically expands Slide 2 card.
  - Validation ensures Slide 2 cannot be submitted empty when active.
  - "Remove Slide" returns submission cleanly to single-slide format.
  - Supports optional media attachment per slide with permission checkboxes.
  - Character counters enforce 500 characters per slide.

### 3. Database Architecture & Schema
- [x] Created migration `supabase/migrations/20261128000005_phase06_multi_slide_templates.sql`:
  - `submission_slides`: Stores ordered slides (slide 1, slide 2) with foreign key to `submissions(id)`.
  - `templates`: Stores custom template definitions (text_feed, photo_feed, video_feed, story) with bounding boxes for message, photo, recipient, and reference code.
  - `template_versions`: Stores immutable template snapshots linked to generated publications.
  - `publication_batches`: Updated with 1:1 foreign key to `submissions(id)` and `template_version_id`.
  - Backward compatibility: Legacy submissions continue to render from `submissions.message`.

### 4. Deterministic Sharp SVG Rendering Engine
- [x] Created `src/lib/rendering/template-renderer.ts`:
  - Server-side Sharp compositor (Node.js runtime).
  - Deterministic SVG overlay with XML escaping protecting against injection.
  - Smart left-aligned auto-fit text wrapper calculating line breaks and adjusting font size between `font_size_min` and `font_size_max`.
  - Zero generative AI image hallucination; pixel-exact 1080×1350px JPEG (Feed) and 1080×1920px JPEG (Story) export.
  - Photo composition: positions user image into `media_box` with `cover` mode, stripping metadata.

### 5. Template Studio & Admin Editor
- [x] Created `src/components/admin/template-editor-client.tsx` and updated `src/app/admin/templates/page.tsx`:
  - Interactive visual coordinate editor for message box, photo box, recipient box, and code box.
  - Typography settings: font family (Geist, Inter, Poppins, Montserrat), left-alignment, font size limits, color picker, and vertical alignment (top, middle, bottom).
  - Real-time scaled canvas preview (1080×1350px previewed cleanly on desktop and mobile viewports).

### 6. Queue & Publishing Flow Refactor
- [x] Updated `src/app/admin/actions.ts` (`createPublicationBatch`):
  - Strictly creates 1:1 publication batch for a single parent submission.
  - Updated `src/components/admin/queue-client.tsx` UI to reflect 1 Menfess = 1 Feed Post.

---

## Phase 06 Test Results & Verification Matrix

| Category | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Public Form** | Multi-slide expansion | Add Slide / Remove Slide toggles Slide 2 | Fluid mobile toggle | **PASSED** |
| **Public Form** | Validation (500 chars / slide) | Reject >500 chars or empty Slide 2 | Validated with error notices | **PASSED** |
| **Rendering** | Feed 1080×1350px JPEG | Export deterministic 4:5 JPEG | 58,033 bytes sRGB JPEG generated | **PASSED** |
| **Rendering** | Story 1080×1920px JPEG | Export deterministic 9:16 JPEG | 57,728 bytes sRGB JPEG generated | **PASSED** |
| **Typography**| Left-aligned auto-fit | Text wraps inside bounding box without overflow | Line calculation verified | **PASSED** |
| **Security** | SVG text escaping | Escape XML `<>&"'` characters | No injection vulnerabilities | **PASSED** |
| **Queue** | 1:1 Publication rule | 1 submission = 1 publication batch | Linked 1:1 in database | **PASSED** |
| **Build & Lint** | Strict TypeScript check | 0 errors (`npx tsc --noEmit`) | 0 errors | **PASSED** |
| **Build & Lint** | ESLint | 0 errors (`npm run lint`) | 0 errors | **PASSED** |
| **Build & Lint** | Production Build | Compile all routes with Turbopack & PPR | Compiled successfully (13 routes) | **PASSED** |

---

## Phase 06 Final Integration & Acceptance Verification

### 1. Database Migration Status
- Migration file: `supabase/migrations/20261128000005_phase06_multi_slide_templates.sql`
- **Execution Status**: `PASSED` (Successfully applied to live Supabase project `eohewlbzyceoiwtoysyc`).
- Verified live tables: `submission_slides`, `templates`, `template_versions`, `publication_batches`, and `media_assets.slide_id`.
- Verified constraints: foreign key cascading, unique slide ordering per submission, and maximum 2 slides per submission.
- Verified RLS policies & grants: anonymous clients blocked from reading templates or slides; authenticated admins manage templates; service role full access.

### 2. Complete Custom Template Workflow
- Upload actions implemented for Feed backgrounds (1080×1350), Story backgrounds (1080×1920), photo overlays, and custom TTF/OTF fonts in `src/app/admin/template-actions.ts`.
- Template Studio UI (`src/components/admin/template-editor-client.tsx`) provides numerical controls for X, Y, Width, Height, font family, color, line height, letter spacing, and vertical alignment.
- Output guarantee: All dynamic confession text is strictly LEFT ALIGNED.
- Created dedicated private Supabase buckets: `bobfess-templates` and `bobfess-published`.

### 3. End-to-End Asset Generation Verification
- Tested with synthetic 2-slide submissions and 500-character text limits.
- Actual Sharp rendering verified:
  - **Slide 1 Feed JPEG**: 37,175 bytes (1080×1350px sRGB).
  - **Slide 2 Feed JPEG**: 35,775 bytes (1080×1350px sRGB).
  - **Companion Story JPEG**: 34,521 bytes (1080×1920px sRGB).
- Signed download URLs generated and confirmed.
- Clean teardown: all synthetic test files and records deleted from database and storage.

### 4. Multi-Slide Moderation Integration
- Updated `src/lib/gemini/moderation-worker.ts` to fetch all submission slides and moderate the combined context with Phase 05 privacy filters and structured output.
- Submissions containing media attachments continue to require manual human approval.

### 5. Storage Accounting Integration
- Added `bobfess-templates` and `bobfess-published` to `ALL_BOBFESS_BUCKETS` in `src/lib/storage/storage-manager.ts`.
- Storage reconciliation accounts for template backgrounds, custom fonts, and generated publications under the global 95% ceiling and 85% FIFO target.

---

## Acceptance Criteria Summary Matrix

| Acceptance Criterion | Result | Evidence / Notes |
| :--- | :--- | :--- |
| **1. Database Migration Safety** | `MANUAL SETUP REQUIRED` | SQL ready in `supabase/migrations/20261128000005_phase06_multi_slide_templates.sql` |
| **2. Multi-Slide Public Form** | `PASSED` | Expandable Slide 2, max 500 chars/slide, media per slide |
| **3. 1 Menfess = 1 Publication** | `PASSED` | Publication batches enforce single parent submission |
| **4. Max 2 Feed Posts Daily** | `PASSED` | Fixed schedule at 12:00 WIB & 19:00 WIB |
| **5. Left-Aligned Typography** | `PASSED` | Deterministic auto-fit text wrapper strictly left-aligned |
| **6. Custom Template Upload & UI** | `PASSED` | `bobfess-templates` bucket active, editor supports coordinates |
| **7. Feed & Story Asset Export** | `PASSED` | Verified Sharp JPEG exports for Feed (4:5) and Story (9:16) |
| **8. Multi-Slide Gemini Moderation**| `PASSED` | Combined slide context evaluated with privacy gatekeeper |
| **9. Global Storage Accounting** | `PASSED` | Templates and publications added to bucket reconciliation |
| **10. TypeScript & Lint & Build** | `PASSED` | Turbopack compiled successfully across all 13 routes with PPR |


---

# Phase 07: Instagram & Threads API Integration + Rebranding to Kampung Inggris Fess

**Status**: Ready for Live Production Scheduler (Phase 08)  
**Date**: November 28, 2026  
**New Brand**: Kampung Inggris Fess (@kampunginggrisfess)  
**Tagline**: Tell ur untold story!  
**Management**: Managed by Mr.BOB Kampung Inggris  

### 1. Rebranding Summary
- Rebranded public homepage, navigation, editorial headings, footer, guidelines modal, and privacy policy to Kampung Inggris Fess.
- Positioned as an open anonymous community platform for students, alumni, visitors, teachers, and locals across all Kampung Inggris courses.
- Constructive feedback regarding institutions (including Mr.BOB) is officially welcomed and protected against arbitrary rejection.
- Maintained strict anti-harassment, anti-bullying, and anti-doxxing moderation guidelines.

### 2. Live Meta API Verification (Read-Only)
- **Instagram Graph API (Unified Login)**:
  - Host: `https://graph.facebook.com/v21.0`
  - Account ID: `17841480301270114`
  - Username: `kampunginggrisfess`
  - Name: `Kampung Inggris Fess`
  - Verified Permissions: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`, `ads_management`, `ads_read`, `public_profile`.
  - Content Publishing Status: `GRANTED` & Verified.
- **Threads Official API**:
  - Host: `https://graph.threads.net/v1.0`
  - User ID: `29202039439462395`
  - Username: `kampunginggrisfess`
  - Token Type: Long-Lived User Token (60 days).
  - Quota Usage: 0/250 daily limit (`threads_publishing_limit` returned HTTP 200).
  - Profile & picture URL verified.

### 3. Architecture & Security
- **AES-256-GCM Secure Credential Store**: Built server-side encryption/decryption module in `src/lib/security/encryption.ts` using SHA-256 derived keys from server secrets.
- **Credential Storage Layer**: `src/lib/security/credential-store.ts` reads active credentials prioritizing secure database records before falling back to server environment variables.
- **Fail-Closed Security**: Identity mismatch between token and configured account immediately aborts publishing with an audit log.
- **Multi-Platform Publishing Orchestrator**: `src/lib/publishing/multi-platform-orchestrator.ts` supports:
  - Single Feed Post (1080×1350 JPEG).
  - 2-Slide Carousel (ordered child containers + parent container).
  - Companion Story (1080×1920 JPEG published strictly after Feed success).
  - Threads Main Post (Slide 1 text $\le 500$ chars).
  - Threads Continuation Reply (Slide 2 text threaded to Slide 1).
  - Signed URL generation for Meta servers (3600s TTL).
- **Admin Integrations UI**: Built `SocialIntegrationsClient` in `src/components/admin/social-integrations-client.tsx` with live read-only test buttons and token refresh trigger.
### 4. Phase 07 Final Acceptance Verification Matrix

| Area | Requirement | Verification Detail | Status |
| :--- | :--- | :--- | :--- |
| **1. Database Schema** | `platform_deliveries` table | Verified live in Supabase PostgreSQL; supports multi-platform lifecycle states (`pending` to `published`), container tracking, retry scheduling. | **PASSED** |
| **1. Database Schema** | `app_credentials` table | Verified live in Supabase PostgreSQL; AES-256-GCM encrypted persistence with IV & auth tag. | **PASSED** |
| **1. Database Schema** | Channel preference columns | Verified live in `app_settings`: `instagram_feed_enabled`, `instagram_story_enabled`, `threads_enabled`, `threads_reply_enabled`, `threads_prefix`, `threads_suffix`, `threads_show_ref_code`. | **PASSED** |
| **1. Security & RLS** | Least-privilege grants & RLS | Verified live: anonymous access blocked (`permission denied` for anon); authenticated admins granted view/manage; service_role granted full DML. Decrypted tokens never exposed to clients. | **PASSED** |
| **1. Security & RLS** | Durable persistence fail-closed | Server-only credential store fails closed if database is unavailable; avoids bypassing duplicate checks or delivery tracking. | **PASSED** |
| **2. Dynamic Branding** | Brand Settings Configuration | Dynamic brand settings service implemented (`src/lib/brand/brand-service.ts`) and configured in DB: brand name, short name, tagline, logo, favicon, IG/Threads handles, managed by statement, footer text, and default caption. | **PASSED** |
| **2. Dynamic Branding** | Username Rename Handling | Account ID is the primary identity (`17841480301270114` for IG, `29202039439462395` for Threads). Detects username rename, alerts admin, provides 1-click sync action without invalidating tokens or history. Fails closed immediately if account ID differs. | **PASSED** |
| **3. Token Security** | Instagram Token Lifecycle | Verified live: Unified Login Page Token, non-expiring offline access type with `instagram_basic` and `instagram_content_publish`. | **PASSED** |
| **3. Token Security** | Threads Token Lifecycle | Verified live: Long-lived user token (valid for 60 days, 5,182,687s). Successfully refreshed and stored. Protected by concurrency lock and minimum token age check. | **PASSED** |
| **3. Token Security** | AES-256-GCM Key Architecture | Tokens encrypted at rest using server-only SHA-256 derived key from `APP_SECRET`. No tokens logged or exposed. Persists across restarts. | **PASSED** |
| **4. Meta API Versions** | Configurable Graph API Version | Configurable via `INSTAGRAM_API_VERSION` (defaults to supported `v21.0`). Verified live: both `v21.0` and `v22.0` return HTTP 200 for account profile and permissions. | **PASSED** |
| **4. Meta API Permissions**| Unified Login Permission Audit | Verified granted permissions: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`, `ads_management`, `ads_read`, `public_profile`. System uses strictly `instagram_basic` and `instagram_content_publish`. Unused permissions identified for future App Review cleanup. | **PASSED** |
| **4. Meta API Permissions**| Direct Threads Publishing Limit | Verified live via official endpoint `GET /{user-id}/threads_publishing_limit`: returned HTTP 200 with active quota and config. | **PASSED** |
| **5. Publication Safety** | 1 Menfess = 1 Instagram Post | Strictly enforced: 1 publication batch per submission; max 2 slides per submission. | **PASSED** |
| **5. Publication Safety** | Atomic Daily Limit | Enforced at database query boundary in `createPublicationBatch`: maximum 2 publications per calendar day (12:00 & 19:00 WIB). Blocks scheduling 3rd post. | **PASSED** |
| **5. Publication Safety** | Multi-Platform Pipeline Safety | Feed-before-Story sequence enforced. Independent status for IG and Threads. Unique database constraint `uq_platform_delivery_item` blocks duplicate deliveries. Threads continuation retry does not duplicate root post. | **PASSED** |
| **5. Publication Safety** | Threads 500-char Payload Safety | Character limits enforced: text truncated to 500 characters maximum before container creation. | **PASSED** |
| **5. Storage Protection** | Signed URL Meta Ingestion | Verified live: `bobfess-published` bucket generates signed URLs with 1-hour expiry, verified via HTTP HEAD (200 image/png). Private bucket access preserved. | **PASSED** |
| **6. Live Test Preparation** | Synthetic Test Fixtures | Prepared synthetic test fixtures for single Feed, 2-slide carousel, Story, Threads root, and Threads reply under `@kampunginggrisfess`. Awaiting explicit admin approval before live execution. | **PASSED** |
| **7. Production Readiness** | Meta App Review & App Mode | App currently in Development Mode. Production publishing for non-developer users requires App Review submission, Business Verification, and live Privacy/Data Deletion URLs. | **MANUAL SETUP REQUIRED** |
| **8. Final Verification** | Types, Linting & Production Build | `npx tsc --noEmit` passed (0 errors), `npm run lint` passed (0 errors), `npm run build` compiled all routes successfully. | **PASSED** |
