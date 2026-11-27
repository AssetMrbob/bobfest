# menfess.

> Anonymous Instagram Menfess web application. **"No names. Just words."**

Designed with Swiss minimalism and editorial typography. Phase 01 provides the core public submission interface with complete form state handling and a comprehensive mock administration suite.

---

## Design System & Tokens

Inspired by classic Swiss typography and functional minimalism:

- **Background**: `#FFFFFF`
- **Secondary Surface**: `#FAFAFA`
- **Primary Accent**: `#2563EB` (Used strictly for primary actions, active states, and focal interactions)
- **Primary Text**: `#171717`
- **Secondary Text**: `#737373`
- **Border**: `#E5E7EB`
- **Border Radius**: 8–12px (`rounded-lg` / `rounded-xl`)
- **Typography**: Geist Sans & Geist Mono

---

## Phase 01 Features

### 1. Public Homepage (`/`)
- Mobile-first, centered single-column layout (max form width 500px).
- Wordmark header: **`menfess.`** with royal blue period accent.
- Optional recipient field (`To: "Someone, maybe?"`).
- Live character counter (`x / 500`).
- Media attachment support:
  - Images up to 5MB (`.jpg`, `.png`, `.webp`)
  - Videos up to 20MB (`.mp4`, `.mov`, `.webm`)
  - Instant client preview with remove button and automated URL revocation (`URL.revokeObjectURL`).
- Form states implemented:
  - **Empty**
  - **Typing**
  - **Attachment Preview**
  - **Validation Error** (empty text, limit exceeded, oversized files)
  - **Submitting** (loading spinner & disabled inputs)
  - **Success** ("Message sent. Your message is awaiting moderation.")
  - **Failure** (with test toggle checkbox to simulate network/server failure)
- Accessibility: Semantic HTML5, full keyboard navigation, ARIA live counters and alerts.

### 2. Admin Interface
Clean desktop sidebar + responsive mobile drawer navigation:
- **Overview** (`/admin`): Live operational metrics, queue countdown, storage gauge, and integration status.
- **Login** (`/admin/login`): Clean authentication gate.
- **Inbox** (`/admin/inbox`): Compact submission table with search, status filters, detail dialog, and quick status actions (Approve, Reject, Queue).
- **Publishing Queue** (`/admin/queue`): 12:00 & 19:00 WIB daily batch slots with slide count indicators (up to 5 per carousel).
- **Published** (`/admin/published`): Archive of published batches with companion Story verification tags.
- **Templates** (`/admin/templates`): Swiss editorial slide generator layout and live 4:5 aspect ratio canvas preview.
- **Settings** (`/admin/settings`): Business rules, publication cadences, upload limits, and storage quotas.

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm or pnpm

### Installation

```bash
# Clone or navigate to directory
cd BOBFESS

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public submission page, or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard.

### Verification & Build

```bash
# Lint checks
npm run lint

# Production build
npm run build

# Start production server
npm run start
```

---

## Future Architecture (Phase 02 Prepared)

Type definitions and architecture contracts are defined in `src/lib/types/future-integrations.ts` for:
- **Supabase Database & Storage**: Media storage and audit tables with FIFO cleanup targeting 85% capacity.
- **Supabase Auth & Cron**: Role-based access control and scheduled publishing at 12:00 & 19:00 WIB.
- **Google Gemini API**: Server-side AI content moderation.
- **Instagram Graph API**: Carousel containers and companion Story publishing.
- **Cloudflare Turnstile**: Zero-friction bot protection.
- **Sharp**: Headless 1080×1350 feed and 1080×1920 story image rendering.
