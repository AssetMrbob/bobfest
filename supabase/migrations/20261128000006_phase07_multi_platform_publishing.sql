-- Migration: 20261128000006_phase07_multi_platform_publishing.sql
-- Purpose: Support multi-platform delivery (Instagram Feed, Instagram Story, Threads Main, Threads Continuation),
--          secure encrypted token storage, and multi-channel publication settings for Kampung Inggris Fess.

-- 1. Create platform deliveries table
CREATE TABLE IF NOT EXISTS public.platform_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.publication_batches(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'threads')),
  publication_type VARCHAR(30) NOT NULL CHECK (publication_type IN ('feed', 'story', 'threads_main', 'threads_reply')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'ready',
    'processing',
    'container_created',
    'publishing',
    'published',
    'retry_pending',
    'needs_review',
    'failed',
    'cancelled',
    'skipped',
    'unknown_outcome'
  )),
  scheduled_time TIMESTAMPTZ NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  container_id TEXT NULL,
  published_media_id TEXT NULL,
  permalink TEXT NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  next_retry_at TIMESTAMPTZ NULL,
  sanitized_error_code TEXT NULL,
  sanitized_error_message TEXT NULL,
  payload_snapshot JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_platform_delivery_item UNIQUE (batch_id, platform, publication_type)
);

CREATE INDEX IF NOT EXISTS idx_platform_deliveries_batch_id ON public.platform_deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_platform_deliveries_submission_id ON public.platform_deliveries(submission_id);
CREATE INDEX IF NOT EXISTS idx_platform_deliveries_status ON public.platform_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_platform_deliveries_next_retry ON public.platform_deliveries(next_retry_at) WHERE status = 'retry_pending';

-- 2. Create app credentials store (encrypted via server AES-256-GCM)
CREATE TABLE IF NOT EXISTS public.app_credentials (
  id VARCHAR(50) PRIMARY KEY, -- e.g. 'instagram_unified', 'threads_official'
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'threads')),
  account_id VARCHAR(100) NOT NULL,
  account_username VARCHAR(100) NOT NULL,
  encrypted_token TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  token_type VARCHAR(50) NOT NULL DEFAULT 'bearer',
  expires_at TIMESTAMPTZ NULL,
  last_refreshed_at TIMESTAMPTZ NULL,
  last_health_check_at TIMESTAMPTZ NULL,
  last_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
  sanitized_last_error TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Update app_settings with multi-platform settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS instagram_feed_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instagram_story_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS threads_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS threads_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS threads_prefix TEXT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS threads_suffix TEXT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS threads_show_ref_code BOOLEAN NOT NULL DEFAULT true;

-- 4. Row Level Security (RLS)
ALTER TABLE public.platform_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_credentials ENABLE ROW LEVEL SECURITY;

-- Block anonymous access completely
DROP POLICY IF EXISTS "Public no access platform_deliveries" ON public.platform_deliveries;
CREATE POLICY "Public no access platform_deliveries" ON public.platform_deliveries FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access app_credentials" ON public.app_credentials;
CREATE POLICY "Public no access app_credentials" ON public.app_credentials FOR ALL TO anon USING (false);

-- Authenticated admins can view/manage platform_deliveries
DROP POLICY IF EXISTS "Admin manage platform_deliveries" ON public.platform_deliveries;
CREATE POLICY "Admin manage platform_deliveries" ON public.platform_deliveries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated admins can view app_credentials metadata (no raw token exposed in UI)
DROP POLICY IF EXISTS "Admin view app_credentials" ON public.app_credentials;
CREATE POLICY "Admin view app_credentials" ON public.app_credentials
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 5. Least-Privilege Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_deliveries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_deliveries TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_credentials TO service_role;
GRANT SELECT ON public.app_credentials TO authenticated;
