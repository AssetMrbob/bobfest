# Kampung Inggris Fess

> An anonymous community platform for Kampung Inggris students, alumni, visitors, and locals. **"Tell ur untold story!"**
> Managed and maintained by Mr.BOB Kampung Inggris.
> Official Channels: Instagram [@kampunginggrisfess](https://www.instagram.com/kampunginggrisfess/) · Threads [@kampunginggrisfess](https://www.threads.com/@kampunginggrisfess)

Designed with Swiss minimalism, editorial typography, and high-performance serverless architecture.

---

## Completed Phases

- **Phase 01**: Foundation, Swiss Minimalism UI/UX & Mobile-First Layout
- **Phase 02 & 02B**: Supabase Submission Engine, Rate Limiting, Turnstile Bot Defense & Security Hardening
- **Phase 03**: Private Media Upload, Sharp Processing, Duration Checking & Storage Accounting
- **Phase 04**: Admin Operational Control Center & Mobile Navigation
- **Phase 05**: Google Gemini AI Moderation (Free Tier Flash-Lite)
- **Phase 06**: Custom Visual Template Studio, Multi-Slide Rendering (1080×1350 Feed & 1080×1920 Story)
- **Phase 07**: Instagram Graph API (Unified Login v21.0), Threads Official API (v1.0), Rebranding, Dynamic Brand Settings, Atomic Daily Limits, & Secure Token Store (Verified & Complete)
- **Phase 08**: Automated Publishing, Background Workers, Distributed Lock Coordination, Stale Lease Recovery, Supabase Cron Scheduling & Admin Automation Controls (Verified & Complete)

---

## Design System & Tokens

Inspired by functional minimalism and editorial clarity:

- **Background**: `#FFFFFF`
- **Secondary Surface**: `#FAFAFA`
- **Primary Accent**: `#2563EB` (Used strictly for primary actions, active states, and focal interactions)
- **Primary Text**: `#171717`
- **Secondary Text**: `#737373`
- **Border**: `#E5E7EB`
- **Border Radius**: 8–12px (`rounded-[10px]`, `rounded-xl`)
- **Typography**: Geist Sans & Geist Mono


---

## Phase 02B Hardening & Completed Features

### 1. Zero Insecure Fallbacks
- **No Hardcoded Credentials**: Default accounts and hardcoded passwords removed completely.
- **Fail-Closed Architecture**: If database credentials are not configured, public submissions and administrative operations fail safely with HTTP 503 (`Service Unavailable`). No simulated or fake success responses are returned.
- **Honest Administrative States**: Admin Inbox and Overview display zero counts and clear service-unavailable notices when live database connections are unconfigured.

### 2. Hardened Database & Row Level Security (RLS)
Migration located at `supabase/migrations/20261127000001_phase02_schema_and_rls.sql`:
- **10 Core Tables**: `submissions`, `media_assets` (Phase 03 prepared), `admin_profiles`, `app_settings`, `publication_batches`, `publication_items`, `moderation_logs`, `system_logs`, `rate_limits`, `idempotency_keys`.
- **Privileged Helper Restriction**: Execution permissions on `public.is_admin()` and `public.check_and_record_rate_limit` are revoked from `PUBLIC` and `anon`.
- **Recursion-Proof RLS**: `admin_profiles` policies check `user_id = auth.uid()` directly without triggering recursive queries.
- **Zero Public Access**: Anonymous users cannot directly read, modify, or delete `submissions` records.

### 3. Persistent Database Rate Limiting & Idempotency
- **Persistent Rate Limiting**: Enforces 5 submissions per 10 minutes per client using PostgreSQL atomic transactions.
- **HMAC-SHA256 Identifiers**: Client hashes are generated using a server-side secret (`APP_SECRET`). Zero raw IP addresses are stored.
- **Idempotency Guard**: Rejects duplicate inserts within 60 seconds of identical submissions.
- **Vercel Serverless Ready**: Fully stateless application code backed by persistent PostgreSQL state.

### 4. Cloudflare Turnstile Bot Defense
- **Interactive Widget**: Frontend `TurnstileWidget` mounts automatically when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured.
- **Replay Protection**: Verified tokens are cached to prevent token reuse.
- **Production Guard**: Cloudflare dummy test keys are strictly blocked in production mode (`NODE_ENV === 'production'`).

### 5. Mandatory Mobile-First Ergonomics
- Minimum 44×44px touch targets across all buttons, navigation items, modal close triggers, and moderation controls.
- Minimum 16px font size (`text-base sm:text-sm`) on form inputs to eliminate iOS Safari auto-zoom.
- Dynamic viewport height support (`min-h-dvh`) and safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
- Desktop tables automatically adapt into touch-friendly cards/lists on mobile screens (`< 768px`).

---

## Getting Started

### 1. Environment Setup

```bash
# Clone or navigate to the repository
cd BOBFESS

# Install dependencies
npm install

# Create your local environment file
cp .env.example .env.local
```

Populate `.env.local` with your dedicated BOBFESS Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-dedicated-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
APP_SECRET="your-strong-random-secret"
```

### 2. Apply Database Migration

In the Supabase SQL Editor for your dedicated project:
- Execute `supabase/migrations/20261127000001_phase02_schema_and_rls.sql`.

### 3. Provision the First Administrator

```sql
-- Link an existing auth.users record to admin_profiles:
INSERT INTO public.admin_profiles (user_id, role)
VALUES ('<USER-UUID-FROM-AUTH-USERS>', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```

### 4. Verification & Build Commands

```bash
# Strict TypeScript check
npx tsc --noEmit

# Linting
npm run lint

# Production build
npm run build

# Start production server
npm run start
```

---

## Preserved Roadmap

- **Phase 01**: Foundation & UI/UX (Complete)
- **Phase 02**: Supabase & Submission System (Complete)
- **Phase 02B**: Integration & Security Hardening (Complete)
- **Phase 03**: Media Upload & Storage Management (Upcoming)
- **Phase 04**: Admin Dashboard Enhancement (Upcoming)
- **Phase 05**: Gemini AI Moderation (Free Tier) (Upcoming)
- **Phase 06**: Feed & Story Generator (Sharp) (Upcoming)
- **Phase 07**: Instagram API Integration (Upcoming)
- **Phase 08**: Automated Publishing & Scheduler (Upcoming)
- **Phase 09**: Security, Testing & Production Deployment (Upcoming)
