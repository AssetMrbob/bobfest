-- ==============================================================================
-- BOBFESS Phase 05: Gemini AI Moderation, Durable Jobs & Quota Ledger
-- ==============================================================================

-- 1. Extend app_settings with moderation mode and daily request budget
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS moderation_mode VARCHAR(50) NOT NULL DEFAULT 'AI_ASSISTED'
    CHECK (moderation_mode IN ('SMART_AUTOMATIC', 'AI_ASSISTED', 'MANUAL')),
  ADD COLUMN IF NOT EXISTS daily_ai_request_budget INT NOT NULL DEFAULT 50 CHECK (daily_ai_request_budget > 0);

-- 2. Durable Moderation Jobs Table
-- Ensures submissions are queued for background/serverless moderation reliably.
-- Features concurrency lock (locked_at, locked_by), attempts count, and error tracking.
CREATE TABLE IF NOT EXISTS public.moderation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT NULL,
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_moderation_job_submission UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_jobs_status_scheduled
  ON public.moderation_jobs (status, scheduled_at)
  WHERE status IN ('pending', 'failed');

-- 3. AI Usage Quota Ledger
-- Tracks daily request counts, token usage, successes, failures, and retries per date (Asia/Jakarta).
CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  usage_date DATE PRIMARY KEY,
  requests_count INT NOT NULL DEFAULT 0,
  successful_requests INT NOT NULL DEFAULT 0,
  failed_requests INT NOT NULL DEFAULT 0,
  retry_attempts INT NOT NULL DEFAULT 0,
  total_prompt_tokens BIGINT NOT NULL DEFAULT 0,
  total_candidate_tokens BIGINT NOT NULL DEFAULT 0,
  last_model_used VARCHAR(100) NULL,
  last_error TEXT NULL,
  last_request_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS on new tables
ALTER TABLE public.moderation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Deny all public/anon access
DROP POLICY IF EXISTS "Public no access moderation_jobs" ON public.moderation_jobs;
CREATE POLICY "Public no access moderation_jobs"
  ON public.moderation_jobs FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access ai_usage_ledger" ON public.ai_usage_ledger;
CREATE POLICY "Public no access ai_usage_ledger"
  ON public.ai_usage_ledger FOR ALL TO anon USING (false);

-- Admins read-only access
DROP POLICY IF EXISTS "Admins read moderation_jobs" ON public.moderation_jobs;
CREATE POLICY "Admins read moderation_jobs"
  ON public.moderation_jobs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read ai_usage_ledger" ON public.ai_usage_ledger;
CREATE POLICY "Admins read ai_usage_ledger"
  ON public.ai_usage_ledger FOR SELECT TO authenticated
  USING (public.is_admin());

-- Service role full access
DROP POLICY IF EXISTS "Service role full moderation_jobs" ON public.moderation_jobs;
CREATE POLICY "Service role full moderation_jobs"
  ON public.moderation_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full ai_usage_ledger" ON public.ai_usage_ledger;
CREATE POLICY "Service role full ai_usage_ledger"
  ON public.ai_usage_ledger FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. Atomic Claim Function for Moderation Jobs (Concurrency Safe)
-- Grabs the next pending/eligible job and locks it using SELECT FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_next_moderation_job(
  p_worker_id TEXT,
  p_lock_timeout_seconds INT DEFAULT 60
)
RETURNS TABLE (
  job_id UUID,
  p_submission_id UUID,
  p_message TEXT,
  p_recipient VARCHAR(100),
  p_attempts INT,
  p_has_media BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id UUID;
  v_submission_id UUID;
  v_message TEXT;
  v_recipient VARCHAR(100);
  v_attempts INT;
  v_has_media BOOLEAN;
BEGIN
  -- Reclaim timed-out locks (orphaned workers)
  UPDATE public.moderation_jobs
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at < now() - (p_lock_timeout_seconds || ' seconds')::interval;

  -- Select next eligible job using SKIP LOCKED to prevent concurrency contention
  SELECT mj.id, mj.submission_id, s.message, s.recipient, mj.attempts
  INTO v_job_id, v_submission_id, v_message, v_recipient, v_attempts
  FROM public.moderation_jobs mj
  JOIN public.submissions s ON s.id = mj.submission_id
  WHERE mj.status IN ('pending', 'failed')
    AND mj.attempts < mj.max_attempts
    AND mj.scheduled_at <= now()
    -- Ensure submission is still in a state that allows AI moderation
    AND s.status = 'pending'
    AND s.moderation_status = 'unreviewed'
  ORDER BY mj.created_at ASC
  LIMIT 1
  FOR UPDATE OF mj SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock the job
  UPDATE public.moderation_jobs
  SET status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = v_job_id;

  -- Check if submission has media
  SELECT EXISTS (
    SELECT 1 FROM public.media_assets
    WHERE submission_id = v_submission_id AND deleted_at IS NULL
  ) INTO v_has_media;

  job_id := v_job_id;
  p_submission_id := v_submission_id;
  p_message := v_message;
  p_recipient := v_recipient;
  p_attempts := v_attempts + 1;
  RETURN NEXT;
END;
$$;

-- 6. Atomic AI Quota Check and Increment Function
-- Ensures daily request budget is not exceeded.
CREATE OR REPLACE FUNCTION public.record_ai_usage_request(
  p_today DATE,
  p_daily_budget INT,
  p_is_retry BOOLEAN DEFAULT false
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INT,
  budget INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current INT;
BEGIN
  -- Insert ledger row for today if not exists
  INSERT INTO public.ai_usage_ledger (usage_date, requests_count, retry_attempts)
  VALUES (p_today, 0, 0)
  ON CONFLICT (usage_date) DO NOTHING;

  -- Lock row for update
  SELECT requests_count INTO v_current
  FROM public.ai_usage_ledger
  WHERE usage_date = p_today
  FOR UPDATE;

  IF v_current >= p_daily_budget THEN
    allowed := false;
    current_count := v_current;
    budget := p_daily_budget;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Increment counter
  UPDATE public.ai_usage_ledger
  SET requests_count = requests_count + 1,
      retry_attempts = CASE WHEN p_is_retry THEN retry_attempts + 1 ELSE retry_attempts END,
      last_request_at = now(),
      updated_at = now()
  WHERE usage_date = p_today;

  allowed := true;
  current_count := v_current + 1;
  budget := p_daily_budget;
  RETURN NEXT;
END;
$$;

-- 7. Record AI Usage Outcome
CREATE OR REPLACE FUNCTION public.record_ai_usage_outcome(
  p_today DATE,
  p_success BOOLEAN,
  p_model VARCHAR(100),
  p_prompt_tokens INT DEFAULT 0,
  p_candidate_tokens INT DEFAULT 0,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.ai_usage_ledger
  SET successful_requests = CASE WHEN p_success THEN successful_requests + 1 ELSE successful_requests END,
      failed_requests = CASE WHEN NOT p_success THEN failed_requests + 1 ELSE failed_requests END,
      total_prompt_tokens = total_prompt_tokens + COALESCE(p_prompt_tokens, 0),
      total_candidate_tokens = total_candidate_tokens + COALESCE(p_candidate_tokens, 0),
      last_model_used = COALESCE(p_model, last_model_used),
      last_error = p_error,
      updated_at = now()
  WHERE usage_date = p_today;
END;
$$;

-- 8. Grants
REVOKE ALL ON TABLE public.moderation_jobs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_usage_ledger FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_next_moderation_job(TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ai_usage_request(DATE, INT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ai_usage_outcome(DATE, BOOLEAN, VARCHAR, INT, INT, TEXT) FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.moderation_jobs TO authenticated;
GRANT SELECT ON TABLE public.ai_usage_ledger TO authenticated;

GRANT ALL ON TABLE public.moderation_jobs TO service_role;
GRANT ALL ON TABLE public.ai_usage_ledger TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_moderation_job(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_usage_request(DATE, INT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_usage_outcome(DATE, BOOLEAN, VARCHAR, INT, INT, TEXT) TO service_role;
