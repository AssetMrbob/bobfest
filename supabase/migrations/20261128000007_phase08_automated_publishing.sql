-- ==============================================================================
-- BOBFESS Phase 08: Automated Publishing, Scheduler & Background Workers
-- Migration: 20261128000007_phase08_automated_publishing.sql
-- ==============================================================================

-- 1. Create Background Queue Jobs Table (Atomic Claims, Durable Leases & Fencing)
CREATE TABLE IF NOT EXISTS public.queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN (
    'publish_slot',
    'platform_delivery_step',
    'gemini_moderation',
    'token_refresh',
    'storage_maintenance'
  )),
  batch_id UUID NULL REFERENCES public.publication_batches(id) ON DELETE CASCADE,
  submission_id UUID NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'claimed',
    'processing',
    'completed',
    'retry_pending',
    'failed',
    'cancelled',
    'unknown_outcome'
  )),
  priority INT NOT NULL DEFAULT 100, -- lower number = higher priority
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 4,
  lease_owner VARCHAR(100) NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  claim_version INT NOT NULL DEFAULT 1,
  heartbeat_at TIMESTAMPTZ NULL,
  last_error_code VARCHAR(100) NULL,
  sanitized_error_message TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_poll 
  ON public.queue_jobs (status, next_attempt_at, priority, scheduled_at)
  WHERE status IN ('pending', 'retry_pending');

CREATE INDEX IF NOT EXISTS idx_queue_jobs_lease 
  ON public.queue_jobs (status, lease_expires_at)
  WHERE status = 'claimed';

CREATE INDEX IF NOT EXISTS idx_queue_jobs_batch_id 
  ON public.queue_jobs (batch_id);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_submission_id 
  ON public.queue_jobs (submission_id);

-- 2. Publication Slots Table (Atomic Daily Publication Slot Reservation)
-- Enforces strictly max 1 publication batch per WIB slot, max 2 batches per WIB date
CREATE TABLE IF NOT EXISTS public.publication_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wib_date DATE NOT NULL,
  slot_time VARCHAR(10) NOT NULL CHECK (slot_time IN ('12:00', '19:00')),
  batch_id UUID NOT NULL REFERENCES public.publication_batches(id) ON DELETE RESTRICT,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE RESTRICT,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(30) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'publishing', 'published', 'failed', 'cancelled')),
  CONSTRAINT uq_publication_slot_time UNIQUE (wib_date, slot_time),
  CONSTRAINT uq_publication_slot_batch UNIQUE (batch_id),
  CONSTRAINT uq_publication_slot_submission UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_publication_slots_wib_date ON public.publication_slots(wib_date);

-- 3. Distributed Distributed Locks Table (Replacing In-Memory Mutexes)
-- Guarantees mutual exclusion across separate serverless instances for token refresh, storage cleanup, etc.
CREATE TABLE IF NOT EXISTS public.distributed_locks (
  lock_key VARCHAR(100) PRIMARY KEY,
  owner_id VARCHAR(100) NOT NULL,
  fencing_token INT NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_distributed_locks_expiry ON public.distributed_locks(expires_at);

-- 4. Scheduler Worker Heartbeat & System Health Table
CREATE TABLE IF NOT EXISTS public.scheduler_health (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  last_worker_run_at TIMESTAMPTZ NULL,
  last_successful_run_at TIMESTAMPTZ NULL,
  last_worker_duration_ms INT NULL,
  last_worker_status VARCHAR(50) NOT NULL DEFAULT 'idle',
  last_worker_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_token_check_at TIMESTAMPTZ NULL,
  last_token_refresh_at TIMESTAMPTZ NULL,
  last_storage_cleanup_at TIMESTAMPTZ NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize default scheduler_health row
INSERT INTO public.scheduler_health (id, last_worker_status)
VALUES ('global', 'idle')
ON CONFLICT (id) DO NOTHING;

-- 5. Extend app_settings with Automation Master Controls & Moderation Mode
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS master_automation_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_mode VARCHAR(30) NOT NULL DEFAULT 'ai_assisted'
    CHECK (moderation_mode IN ('manual', 'ai_assisted', 'smart_auto')),
  ADD COLUMN IF NOT EXISTS catchup_window_minutes INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_retry_attempts INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS storage_cleanup_retention_days INT NOT NULL DEFAULT 14;

-- 6. Add Lease and Fencing Columns to platform_deliveries if not already present
ALTER TABLE public.platform_deliveries
  ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS claim_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NULL;

-- 7. Database Function: Atomic Slot Reservation
-- Reserves a slot transactionally. Fails if slot is already reserved or submission already booked.
CREATE OR REPLACE FUNCTION public.reserve_publication_slot_atomic(
  p_wib_date DATE,
  p_slot_time VARCHAR(10),
  p_batch_id UUID,
  p_submission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_existing_slot RECORD;
  v_existing_sub RECORD;
  v_daily_count INT;
BEGIN
  -- 1. Check if the exact slot is already taken
  SELECT * INTO v_existing_slot
  FROM public.publication_slots
  WHERE wib_date = p_wib_date AND slot_time = p_slot_time AND status != 'cancelled';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Publication slot %s on %s is already reserved (Batch: %s)', p_slot_time, p_wib_date, v_existing_slot.batch_id)
    );
  END IF;

  -- 2. Check if submission already has an active slot
  SELECT * INTO v_existing_sub
  FROM public.publication_slots
  WHERE submission_id = p_submission_id AND status != 'cancelled';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Submission %s already has a reserved slot on %s %s', p_submission_id, v_existing_sub.wib_date, v_existing_sub.slot_time)
    );
  END IF;

  -- 3. Check daily limit (max 2 active slots per day)
  SELECT count(*) INTO v_daily_count
  FROM public.publication_slots
  WHERE wib_date = p_wib_date AND status != 'cancelled';

  IF v_daily_count >= 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Daily publication limit of 2 slots already reached for %s', p_wib_date)
    );
  END IF;

  -- 4. Insert slot reservation
  INSERT INTO public.publication_slots (
    wib_date,
    slot_time,
    batch_id,
    submission_id,
    status
  ) VALUES (
    p_wib_date,
    p_slot_time,
    p_batch_id,
    p_submission_id,
    'reserved'
  );

  RETURN jsonb_build_object(
    'success', true,
    'wib_date', p_wib_date,
    'slot_time', p_slot_time,
    'batch_id', p_batch_id
  );
END;
$$;

-- 8. Database Function: Atomic Distributed Lock Acquire
CREATE OR REPLACE FUNCTION public.acquire_distributed_lock_atomic(
  p_lock_key VARCHAR(100),
  p_owner_id VARCHAR(100),
  p_ttl_seconds INT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_expires_at TIMESTAMPTZ;
  v_fencing INT;
  v_current_lock RECORD;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 1 OR p_lock_key IS NULL OR p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Invalid distributed lock parameters';
  END IF;
  v_expires_at := v_now + make_interval(secs => p_ttl_seconds);

  INSERT INTO public.distributed_locks AS current_lock (
    lock_key, owner_id, fencing_token, acquired_at, expires_at, metadata
  ) VALUES (
    p_lock_key, p_owner_id, 1, v_now, v_expires_at, p_metadata
  )
  ON CONFLICT (lock_key) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        fencing_token = current_lock.fencing_token + 1,
        acquired_at = v_now,
        expires_at = v_expires_at,
        metadata = EXCLUDED.metadata
    WHERE current_lock.expires_at <= v_now OR current_lock.owner_id = p_owner_id
  RETURNING fencing_token INTO v_fencing;

  IF v_fencing IS NOT NULL THEN
    RETURN jsonb_build_object('acquired', true, 'lock_key', p_lock_key,
      'fencing_token', v_fencing, 'expires_at', v_expires_at);
  END IF;

  SELECT owner_id, expires_at INTO v_current_lock
  FROM public.distributed_locks WHERE lock_key = p_lock_key;
  RETURN jsonb_build_object('acquired', false, 'lock_key', p_lock_key,
    'owner_id', v_current_lock.owner_id, 'expires_at', v_current_lock.expires_at);
END;
$$;

-- 9. Database Function: Release Distributed Lock Atomic
CREATE OR REPLACE FUNCTION public.release_distributed_lock_atomic(
  p_lock_key VARCHAR(100),
  p_owner_id VARCHAR(100),
  p_fencing_token INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_updated INT;
BEGIN
  -- Keep the row so fencing tokens never reset after release.
  UPDATE public.distributed_locks
  SET expires_at = clock_timestamp()
  WHERE lock_key = p_lock_key
    AND owner_id = p_owner_id
    AND fencing_token = p_fencing_token
    AND expires_at > clock_timestamp();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 10. Database Function: Atomic Queue Claim (SELECT FOR UPDATE SKIP LOCKED pattern)
CREATE OR REPLACE FUNCTION public.claim_next_queue_job_atomic(
  p_worker_id VARCHAR(100),
  p_lease_duration_seconds INT DEFAULT 300
)
RETURNS TABLE (
  job_id UUID,
  job_type VARCHAR(50),
  batch_id UUID,
  submission_id UUID,
  attempt_count INT,
  max_attempts INT,
  claim_version INT,
  payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_now TIMESTAMPTZ := now();
  v_lease_expiry TIMESTAMPTZ := v_now + (p_lease_duration_seconds || ' seconds')::interval;
  v_target_id UUID;
BEGIN
  -- Find the highest priority eligible job and lock it
  SELECT id INTO v_target_id
  FROM public.queue_jobs
  WHERE (
    (status IN ('pending', 'retry_pending') AND next_attempt_at <= v_now)
    OR (status = 'claimed' AND lease_expires_at < v_now)
  )
  ORDER BY priority ASC, scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_target_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.queue_jobs AS q
    SET status = 'claimed',
        lease_owner = p_worker_id,
        lease_expires_at = v_lease_expiry,
        claim_version = q.claim_version + 1,
        heartbeat_at = v_now,
        attempt_count = q.attempt_count + 1,
        updated_at = v_now
    WHERE q.id = v_target_id
    RETURNING
      q.id AS job_id,
      q.job_type,
      q.batch_id,
      q.submission_id,
      q.attempt_count,
      q.max_attempts,
      q.claim_version,
      q.payload;
  END IF;
END;
$$;

-- 11. Row Level Security & Permissions
ALTER TABLE public.queue_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributed_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_health ENABLE ROW LEVEL SECURITY;

-- Block anonymous public access completely
DROP POLICY IF EXISTS "Public no access queue_jobs" ON public.queue_jobs;
CREATE POLICY "Public no access queue_jobs" ON public.queue_jobs FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access publication_slots" ON public.publication_slots;
CREATE POLICY "Public no access publication_slots" ON public.publication_slots FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access distributed_locks" ON public.distributed_locks;
CREATE POLICY "Public no access distributed_locks" ON public.distributed_locks FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Public no access scheduler_health" ON public.scheduler_health;
CREATE POLICY "Public no access scheduler_health" ON public.scheduler_health FOR ALL TO anon USING (false);

-- Authenticated admins can view tables
DROP POLICY IF EXISTS "Admin view queue_jobs" ON public.queue_jobs;
CREATE POLICY "Admin view queue_jobs" ON public.queue_jobs FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin view publication_slots" ON public.publication_slots;
CREATE POLICY "Admin view publication_slots" ON public.publication_slots FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin view distributed_locks" ON public.distributed_locks;
CREATE POLICY "Admin view distributed_locks" ON public.distributed_locks FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin view scheduler_health" ON public.scheduler_health;
CREATE POLICY "Admin view scheduler_health" ON public.scheduler_health FOR SELECT TO authenticated USING (public.is_admin());

-- Least privilege grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributed_locks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduler_health TO service_role;

GRANT SELECT ON public.queue_jobs TO authenticated;
GRANT SELECT ON public.publication_slots TO authenticated;
GRANT SELECT ON public.distributed_locks TO authenticated;
GRANT SELECT ON public.scheduler_health TO authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_publication_slot_atomic TO service_role;

GRANT EXECUTE ON FUNCTION public.acquire_distributed_lock_atomic TO service_role;

GRANT EXECUTE ON FUNCTION public.release_distributed_lock_atomic TO service_role;

GRANT EXECUTE ON FUNCTION public.claim_next_queue_job_atomic TO service_role;

-- Restrict privileged RPCs to server-side credentials only.
REVOKE ALL ON FUNCTION public.reserve_publication_slot_atomic(DATE, VARCHAR, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_distributed_lock_atomic(VARCHAR, VARCHAR, INT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_distributed_lock_atomic(VARCHAR, VARCHAR, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_next_queue_job_atomic(VARCHAR, INT) FROM PUBLIC, anon, authenticated;

-- 12. Enforce Clean Natural Threads Publishing Defaults
-- Default to clean, natural text without branding prefixes or tracking codes
ALTER TABLE public.app_settings 
  ALTER COLUMN threads_show_ref_code SET DEFAULT false;

-- Preserve existing administrator Threads formatting settings.
