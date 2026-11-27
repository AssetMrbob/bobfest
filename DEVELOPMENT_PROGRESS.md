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


