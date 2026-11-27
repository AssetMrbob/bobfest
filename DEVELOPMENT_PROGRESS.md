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
| **Build & Lint** | Strict TypeScript check | 0 errors | 0 errors (`tsc --noEmit`) | **PASSED** |
| **Build & Lint** | ESLint | 0 errors, 0 warnings | 0 errors (`next lint`) | **PASSED** |
| **Build & Lint** | Next.js production build | All routes compiled with Turbopack & PPR | Compiled successfully | **PASSED** |

---

## Live Integration Status (Phase 02B Completed)

1. **Supabase Environment Variables**:
   - Modernized client architecture to use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` alongside `APP_SECRET`.
   - Maintained backward compatibility with `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Never print or leak secrets in conversation, logs, or client-side bundles.

2. **Database Permissions & Least-Privilege Granularity**:
   - Documented in [supabase/migrations/20261127000002_grant_permissions.sql](file:///Users/Mr.Bob/WEBSITE%20BARU/BOBFESS/supabase/migrations/20261127000002_grant_permissions.sql).
   - `anon` role restricted to `USAGE` on schema `public` with 0 direct table privileges.
   - `authenticated` role granted targeted operations under strict RLS policies (`is_admin()`).
   - `service_role` granted exact table and function execution privileges for backend API routes and workers.

3. **Production Build Architecture**:
   - Upgraded dynamic admin routes (`/admin`, `/admin/inbox`, `/admin/settings`) to use React `<Suspense>` boundaries matching Next.js 16 Cache Components and Partial Prerendering (PPR).

