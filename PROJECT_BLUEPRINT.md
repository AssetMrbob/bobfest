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
5. **Zero Insecure Fallbacks**: No hardcoded credentials, no simulated success responses when database is unavailable.

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
| **Persistence (Phase 02/02B)** | Supabase (PostgreSQL) | Submissions, persistent rate-limiting, idempotency, audit trails |
| **Authentication (Phase 02/02B)**| Supabase Auth | Email/password administrator authentication with role check |
| **Bot Protection (Phase 02B)** | Cloudflare Turnstile | Server-verified bot challenge with replay protection |
| **File Storage (Phase 03)** | Supabase Storage (S3-compatible) | User-attached photos and rendered slide artifacts |
| **AI Moderation (Phase 05)** | Google Gemini 2.5 Flash | Free Tier multimodal text and image toxicity screening |
| **Image Generation (Phase 06)**| Sharp | Server-side 1080×1350 (4:5) slide canvas rendering |
| **Social Publishing (Phase 07)** | Instagram Graph API & Threads API | Unified Login container publishing, companion stories, and Threads replies |
| **Token Security (Phase 07)** | AES-256-GCM Credential Store | Server-side encrypted persistence in `app_credentials` |
| **Scheduler (Phase 08)** | Supabase Cron / Edge Functions | Scheduled publishing at 12:00 and 19:00 WIB |
| **Durable Queue & Locking (Phase 08)** | Supabase PostgreSQL + Distributed Locks | Transactional slot reservation (2/day), atomic queue claims, and fencing |

---

## 4. Preserved Project Roadmap

- **Phase 01**: Foundation & UI/UX (Complete)
- **Phase 02**: Supabase & Submission System (Complete)
- **Phase 02B**: Integration & Security Hardening (Complete)
- **Phase 03**: Media Upload & Storage Management (Complete)
- **Phase 04**: Admin Dashboard Enhancement (Complete)
- **Phase 05**: Gemini AI Moderation (Free Tier) (Complete)
- **Phase 06**: Feed & Story Generator (Sharp) (Complete)
- **Phase 07**: Instagram Graph API & Threads API Multi-Platform Publishing (Complete & Verified)
- **Phase 08**: Automated Publishing, Scheduler & Background Workers (Complete & Verified)
- **Phase 09**: Security, Testing & Production Deployment (Upcoming)

---

## 5. Security & Hardening Architecture (Phase 02B)

### 1. Zero Insecure Fallbacks
- No default admin accounts (`admin@menfess.id` / `admin12345` removed).
- No simulated authentication.
- When database credentials are not configured, server actions and API routes return HTTP 503 (`Service Unavailable`). No fake submissions or simulated success responses are produced.

### 2. Database-Backed Persistent Rate Limiting
- Replaced in-memory state with the `rate_limits` table and atomic PostgreSQL stored procedure `check_and_record_rate_limit`.
- Enforces 5 requests per 10 minutes per client.
- Uses HMAC-SHA256 client identifiers salted with server secret (`SUPABASE_SERVICE_ROLE_KEY` / `APP_SECRET`). Never stores raw IP addresses.
- Auto-expires old records through background pruning.

### 3. Persistent Idempotency
- `idempotency_keys` table prevents duplicate inserts caused by rapid double-clicks or network retries (60-second TTL).

### 4. Hardened Row Level Security (RLS)
- Public execution of `is_admin()` is revoked: `REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;`.
- Admin profile query recursion eliminated by restricting `admin_profiles` SELECT to `USING (user_id = auth.uid())` without self-calling `is_admin()`.
- Public users have ZERO direct access (`SELECT`, `UPDATE`, `DELETE`) on `submissions`.
- Anonymous submissions enter exclusively via `POST /api/submissions` using the privileged server client after validation.

### 5. Cloudflare Turnstile Bot Defense
- Frontend widget (`TurnstileWidget`) mounts dynamically when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is present.
- Server-side verification strictly rejects dummy test keys in production (`NODE_ENV === 'production'`).
- In-memory replay cache blocks reuse of spent tokens within 5 minutes.
