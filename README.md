# menfess.

> Anonymous Instagram Menfess web application. **"No names. Just words."**

Designed with Swiss minimalism and editorial typography. Phase 02 implements the complete Supabase database schema, server-side anonymous submission endpoint, anti-abuse defenses, and administrative moderation workflows.

---

## Design System & Tokens

Inspired by classic Swiss typography and functional minimalism:

- **Background**: `#FFFFFF`
- **Secondary Surface**: `#FAFAFA`
- **Primary Accent**: `#2563EB` (Used strictly for primary actions, active states, and focal interactions)
- **Primary Text**: `#171717`
- **Secondary Text**: `#737373`
- **Border**: `#E5E7EB`
- **Border Radius**: 8–12px (`rounded-[10px]`, `rounded-xl`)
- **Typography**: Geist Sans & Geist Mono

---

## Phase 02 Completed Features

### 1. Anonymous Public Submission (`/` & `POST /api/submissions`)
- **Zero Registration**: Visitors can submit without creating an account or providing email/phone details.
- **Server-Side Validation**:
  - Enforced 500-character ceiling.
  - Whitespace and newline normalization.
  - Automatic PII rejection (phone numbers, email addresses, doxxing keywords).
- **Anti-Abuse Protections**:
  - Sliding-window rate limiting (5 requests per 10 minutes per client hash).
  - 60-second idempotency mechanism preventing accidental duplicate clicks.
  - Cloudflare Turnstile bot verification support (fails closed in production).
- **Unique Reference Code**: Every valid submission receives a cryptographically generated reference (e.g. `MF-K7W92QPA`).
- **Media Notice**: Media upload is temporarily locked with a concise *"Media coming soon"* notice pending Phase 03.

### 2. Database & Row Level Security (RLS)
- Production-grade schema in `supabase/migrations/20261127000001_phase02_schema_and_rls.sql`:
  - `submissions`: Core anonymous entries with audit timestamps and status enum.
  - `media_assets`: Storage metadata schema prepared for Phase 03.
  - `admin_profiles`: Administrator role mapping linked to Supabase Auth.
  - `app_settings`: Typed application settings with submission emergency pause switch.
  - `publication_batches` & `publication_items`: Batch scheduling structure for 12:00 & 19:00 WIB.
  - `moderation_logs`: Full audit history for moderation actions.
  - `system_logs`: Sanitized operational events without credentials or raw IPs.
- Least-Privilege RLS:
  - Anonymous users have zero direct `SELECT`, `UPDATE`, or `DELETE` access to `submissions`.
  - All public submissions are created exclusively via the secured server endpoint.
  - Only administrators verified by `public.is_admin()` can view or update administrative records.

### 3. Protected Admin Interface
- **Supabase Auth**: Real email/password authentication gate at `/admin/login`.
- **Role Verification**: Middleware and server actions strictly enforce admin privileges.
- **Inbox Moderation** (`/admin/inbox`): Real database-connected list with search, status filters (`pending`, `needs_review`, `approved`, `queued`, `published`, `rejected`), modal viewer, and action buttons.
- **Overview Dashboard** (`/admin`): Live database counts for total, pending, approved, queued, and rejected entries.
- **Settings** (`/admin/settings`): Live toggles for submission intake and publishing rules.

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

Populate `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2. Apply Database Migrations

Run the SQL migration in the Supabase Dashboard SQL Editor:
- Copy contents of `supabase/migrations/20261127000001_phase02_schema_and_rls.sql`
- Execute in Supabase SQL Editor.

### 3. Provision the First Administrator

In the Supabase SQL Editor:
```sql
-- 1. Create user in auth.users (via Supabase Auth Dashboard or SQL)
-- 2. Link user to admin_profiles:
INSERT INTO public.admin_profiles (user_id, role)
VALUES ('<USER-UUID-FROM-AUTH-USERS>', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```

*(For local testing without live Supabase credentials, the application operates in safe fallback mode using `admin@menfess.id` / `admin12345`).*

### 4. Run Locally

```bash
# Start development server
npm run dev

# Run type check and lint
npx tsc --noEmit && npm run lint

# Production build
npm run build
```

---

## Upcoming Phases

- **Phase 03**: Supabase Storage buckets, media upload pipeline (images ≤ 5MB, videos ≤ 20MB), and reserve quota checks.
- **Phase 04**: Google Gemini 2.5 Flash automated toxicity screening, Sharp 1080×1350 feed carousel rendering, and Instagram Graph API publishing.
