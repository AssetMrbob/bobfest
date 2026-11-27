-- ==============================================================================
-- BOBFESS Phase 02: Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. Create custom enum types
DO $$ BEGIN
  CREATE TYPE submission_status_enum AS ENUM (
    'pending',
    'needs_review',
    'approved',
    'queued',
    'publishing',
    'published',
    'rejected',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code VARCHAR(32) UNIQUE NOT NULL,
  recipient VARCHAR(100) NULL,
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 500),
  status submission_status_enum NOT NULL DEFAULT 'pending',
  moderation_status VARCHAR(50) NOT NULL DEFAULT 'unreviewed',
  moderation_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL
);

-- 3. Media assets table (Schema prepared for Phase 03)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 4. Admin profiles table (References Supabase Auth)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Application settings table (Single-row configuration)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  accept_submissions BOOLEAN NOT NULL DEFAULT true,
  auto_publish_enabled BOOLEAN NOT NULL DEFAULT false,
  max_daily_feed_posts INT NOT NULL DEFAULT 2,
  publish_times TEXT[] NOT NULL DEFAULT ARRAY['12:00', '19:00'],
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  auto_story_enabled BOOLEAN NOT NULL DEFAULT true,
  max_carousel_slides INT NOT NULL DEFAULT 5,
  max_message_length INT NOT NULL DEFAULT 500,
  max_image_size_mb INT NOT NULL DEFAULT 5,
  max_video_size_mb INT NOT NULL DEFAULT 20,
  storage_capacity_limit_percent INT NOT NULL DEFAULT 95,
  storage_warning_percent INT NOT NULL DEFAULT 90,
  storage_cleanup_target_percent INT NOT NULL DEFAULT 85,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default app settings if not exists
INSERT INTO public.app_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- 6. Publication batches table
CREATE TABLE IF NOT EXISTS public.publication_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  carousel_container_id TEXT NULL,
  story_container_id TEXT NULL,
  permalink TEXT NULL,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Publication items table (Links submission to batch; unique constraint prevents duplicate assignment)
CREATE TABLE IF NOT EXISTS public.publication_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.publication_batches(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  slide_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_publication_submission UNIQUE (submission_id)
);

-- 8. Moderation logs table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  previous_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  moderation_reason TEXT NULL,
  decision_source VARCHAR(50) NOT NULL DEFAULT 'admin',
  admin_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. System operational logs table (Zero sensitive contents or credentials logged)
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  metadata JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Performance & Lookup Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_public_code ON public.submissions(public_code);
CREATE INDEX IF NOT EXISTS idx_media_assets_submission ON public.media_assets(submission_id);
CREATE INDEX IF NOT EXISTS idx_publication_items_batch ON public.publication_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_submission ON public.moderation_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type, created_at DESC);

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON public.submissions;
CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user has admin role
-- Safe SECURITY DEFINER with fixed search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Submissions policies:
-- Anonymous clients have ZERO direct SELECT, UPDATE, or DELETE access.
-- Public submissions are created exclusively via the secured server-side API.
-- Only verified administrators can view and moderate submissions.
DROP POLICY IF EXISTS "Admin full access to submissions" ON public.submissions;
CREATE POLICY "Admin full access to submissions"
  ON public.submissions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Media assets policies:
DROP POLICY IF EXISTS "Admin full access to media_assets" ON public.media_assets;
CREATE POLICY "Admin full access to media_assets"
  ON public.media_assets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin profiles policies:
DROP POLICY IF EXISTS "Users can read own profile" ON public.admin_profiles;
CREATE POLICY "Users can read own profile"
  ON public.admin_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage admin profiles" ON public.admin_profiles;
CREATE POLICY "Admin manage admin profiles"
  ON public.admin_profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- App settings policies:
DROP POLICY IF EXISTS "Admin full access to app_settings" ON public.app_settings;
CREATE POLICY "Admin full access to app_settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Publication batches & items policies:
DROP POLICY IF EXISTS "Admin full access to batches" ON public.publication_batches;
CREATE POLICY "Admin full access to batches"
  ON public.publication_batches
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access to publication_items" ON public.publication_items;
CREATE POLICY "Admin full access to publication_items"
  ON public.publication_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Moderation & System logs policies:
DROP POLICY IF EXISTS "Admin full access to moderation_logs" ON public.moderation_logs;
CREATE POLICY "Admin full access to moderation_logs"
  ON public.moderation_logs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access to system_logs" ON public.system_logs;
CREATE POLICY "Admin full access to system_logs"
  ON public.system_logs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
