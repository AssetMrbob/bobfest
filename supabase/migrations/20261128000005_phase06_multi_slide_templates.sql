-- ==============================================================================
-- BOBFESS Phase 06: Multi-Slide Submissions, Custom Templates & 1:1 Publications
-- ==============================================================================

-- 1. Submission Slides Table
-- Supports 1 to 2 ordered slides per submission.
-- Backward compatibility: Historical submissions store slide 1 in this table or fall back to submissions.message.
CREATE TABLE IF NOT EXISTS public.submission_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  slide_order INT NOT NULL CHECK (slide_order IN (1, 2)),
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_submission_slide_order UNIQUE (submission_id, slide_order)
);

CREATE INDEX IF NOT EXISTS idx_submission_slides_submission_id
  ON public.submission_slides (submission_id, slide_order);

-- 2. Media Assets Slide Association
-- Adds slide_id to media_assets (1 optional media per slide)
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS slide_id UUID NULL REFERENCES public.submission_slides(id) ON DELETE SET NULL;

-- 3. Templates & Template Versions Table
-- Supports custom administrator-uploaded backgrounds and coordinates.
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('text_feed', 'photo_feed', 'video_feed', 'story')),
  dimensions JSONB NOT NULL DEFAULT '{"width": 1080, "height": 1350}'::jsonb,
  background_storage_path TEXT NULL,
  font_family VARCHAR(100) NOT NULL DEFAULT 'Geist',
  font_file_path TEXT NULL,
  font_size_min INT NOT NULL DEFAULT 24,
  font_size_max INT NOT NULL DEFAULT 44,
  text_color VARCHAR(30) NOT NULL DEFAULT '#171717',
  line_height NUMERIC(3,2) NOT NULL DEFAULT 1.35,
  letter_spacing NUMERIC(4,2) NOT NULL DEFAULT 0.0,
  vertical_align VARCHAR(20) NOT NULL DEFAULT 'top' CHECK (vertical_align IN ('top', 'middle', 'bottom')),
  layout_config JSONB NOT NULL DEFAULT '{
    "message_box": {"x": 100, "y": 250, "width": 880, "height": 850},
    "media_box": {"x": 100, "y": 250, "width": 880, "height": 550},
    "recipient_box": {"x": 100, "y": 180, "width": 880, "height": 50},
    "code_box": {"x": 100, "y": 1180, "width": 880, "height": 40}
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Template immutable versions table
CREATE TABLE IF NOT EXISTS public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_version UNIQUE (template_id, version)
);

-- 4. Publication Batches Update
-- Enforces: 1 publication = 1 submission.
-- Adds submission_id and template_version_id to publication_batches.
ALTER TABLE public.publication_batches
  ADD COLUMN IF NOT EXISTS submission_id UUID NULL REFERENCES public.submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version_id UUID NULL REFERENCES public.template_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feed_asset_paths TEXT[] NULL,
  ADD COLUMN IF NOT EXISTS story_asset_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS caption TEXT NULL,
  ADD COLUMN IF NOT EXISTS rendered_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS approved_for_publishing BOOLEAN NOT NULL DEFAULT false;

-- 5. Enable RLS
ALTER TABLE public.submission_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

-- Deny anon access
DROP POLICY IF EXISTS "Public no access submission_slides" ON public.submission_slides;
CREATE POLICY "Public no access submission_slides" ON public.submission_slides FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access templates" ON public.templates;
CREATE POLICY "Public no access templates" ON public.templates FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access template_versions" ON public.template_versions;
CREATE POLICY "Public no access template_versions" ON public.template_versions FOR ALL TO anon USING (false);

-- Admins read-only / management
DROP POLICY IF EXISTS "Admins read submission_slides" ON public.submission_slides;
CREATE POLICY "Admins read submission_slides" ON public.submission_slides FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage templates" ON public.templates;
CREATE POLICY "Admins manage templates" ON public.templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read template_versions" ON public.template_versions;
CREATE POLICY "Admins read template_versions" ON public.template_versions FOR SELECT TO authenticated USING (public.is_admin());

-- Service role full access
DROP POLICY IF EXISTS "Service role full submission_slides" ON public.submission_slides;
CREATE POLICY "Service role full submission_slides" ON public.submission_slides FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full templates" ON public.templates;
CREATE POLICY "Service role full templates" ON public.templates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full template_versions" ON public.template_versions;
CREATE POLICY "Service role full template_versions" ON public.template_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Grants
GRANT ALL ON TABLE public.submission_slides TO service_role;
GRANT ALL ON TABLE public.templates TO service_role;
GRANT ALL ON TABLE public.template_versions TO service_role;

GRANT SELECT ON TABLE public.submission_slides TO authenticated;
GRANT ALL ON TABLE public.templates TO authenticated;
GRANT SELECT ON TABLE public.template_versions TO authenticated;
