-- ==============================================================================
-- BOBFESS Phase 03: Storage Capacity Accounting, Concurrency Locking & Reservations
-- Targeted Hardening & Concurrency Safety
-- ==============================================================================

-- 1. Storage Capacity Accounting Singleton Row
-- Provides pessimistic transaction-level locking (SELECT ... FOR UPDATE)
-- to serialize all capacity-modifying operations across all serverless instances.
CREATE TABLE IF NOT EXISTS public.storage_capacity_ledger (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global_storage',
  total_budget_bytes BIGINT NOT NULL DEFAULT 1000000000, -- 1GB default budget
  reconciled_stored_bytes BIGINT NOT NULL DEFAULT 0,    -- Actual bytes confirmed in storage
  active_reserved_bytes BIGINT NOT NULL DEFAULT 0,      -- In-flight upload reservations
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed ledger singleton row if not exists
INSERT INTO public.storage_capacity_ledger (id, total_budget_bytes, reconciled_stored_bytes, active_reserved_bytes)
VALUES ('global_storage', 1000000000, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Upload Reservations Table
-- Internal accounting table: strictly server-side, never exposed to authenticated or anon clients
CREATE TABLE IF NOT EXISTS public.storage_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_token VARCHAR(64) UNIQUE NOT NULL,
  storage_path TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  client_hash VARCHAR(64) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'reserved' 
    CHECK (status IN ('reserved', 'finalized', 'expired', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storage_reservations_status_expires 
  ON public.storage_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_token 
  ON public.storage_reservations(reservation_token);

-- 3. Storage Audit Log Table (Historical accounting tracking)
CREATE TABLE IF NOT EXISTS public.storage_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'reserve', 'finalize', 'release', 'cleanup', 'reconcile'
  bytes_change BIGINT NOT NULL DEFAULT 0,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Extend media_assets with deletion metadata (No personal identifying info or original filenames)
ALTER TABLE public.media_assets 
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- 5. Enable Row Level Security
ALTER TABLE public.storage_capacity_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Strictly service_role only for reservations.
-- Authenticated admins CANNOT read raw reservation tokens or client hashes directly.
-- They only read the aggregate storage ledger and audit logs via is_admin().
DROP POLICY IF EXISTS "Admin read storage_capacity_ledger" ON public.storage_capacity_ledger;
CREATE POLICY "Admin read storage_capacity_ledger"
  ON public.storage_capacity_ledger FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin read storage_audit_logs" ON public.storage_audit_logs;
CREATE POLICY "Admin read storage_audit_logs"
  ON public.storage_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- No SELECT policy on storage_reservations for authenticated or anon!

-- 7. Granular Least-Privilege Grants
-- Authenticated admins have read access only to aggregate ledger and audit logs
GRANT SELECT ON public.storage_capacity_ledger TO authenticated;
GRANT SELECT ON public.storage_audit_logs TO authenticated;

-- Service role has full management on all three tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_capacity_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_audit_logs TO service_role;

-- ==============================================================================
-- Atomic Storage Capacity Reservation Function
-- Uses SELECT ... FOR UPDATE on public.storage_capacity_ledger
-- Enforces category bucket limits (5MB for image, 20MB for video)
-- Reads thresholds directly from public.app_settings (never caller-controlled)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reserve_storage_capacity_atomic(
  p_token VARCHAR(64),
  p_path TEXT,
  p_media_type VARCHAR(20),
  p_mime VARCHAR(100),
  p_client_hash VARCHAR(64),
  p_ttl_seconds INT DEFAULT 7200 -- 2 hours (matches signed upload URL token exp)
)
RETURNS TABLE (
  allowed BOOLEAN,
  reserved_size BIGINT,
  current_stored BIGINT,
  active_reserved BIGINT,
  hard_capacity BIGINT,
  available_bytes BIGINT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ledger RECORD;
  v_settings RECORD;
  v_hard_cap BIGINT;
  v_bytes_to_reserve BIGINT;
  v_total_needed BIGINT;
BEGIN
  -- 1. Pessimistic Lock on Singleton Ledger Row
  SELECT * INTO v_ledger
  FROM public.storage_capacity_ledger
  WHERE id = 'global_storage'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.storage_capacity_ledger (id) VALUES ('global_storage');
    SELECT * INTO v_ledger FROM public.storage_capacity_ledger WHERE id = 'global_storage' FOR UPDATE;
  END IF;

  -- 2. Read Server-Controlled Settings (Never trusted from caller)
  SELECT 
    COALESCE(storage_capacity_limit_percent, 95) AS hard_limit_percent,
    COALESCE(storage_warning_percent, 90) AS warning_percent,
    COALESCE(storage_cleanup_target_percent, 85) AS cleanup_target_percent,
    COALESCE(max_image_size_mb, 5) AS max_image_mb,
    COALESCE(max_video_size_mb, 20) AS max_video_mb
  INTO v_settings
  FROM public.app_settings
  WHERE id = 'global'
  LIMIT 1;

  -- 3. Determine conservative maximum reservation based on media type
  IF p_media_type = 'image' THEN
    v_bytes_to_reserve := v_settings.max_image_mb * 1048576;
  ELSIF p_media_type = 'video' THEN
    v_bytes_to_reserve := v_settings.max_video_mb * 1048576;
  ELSE
    RETURN QUERY SELECT false, 0::BIGINT, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, 0::BIGINT, 0::BIGINT, 'Invalid media type.'::TEXT;
    RETURN;
  END IF;

  -- 4. Calculate Hard Capacity Threshold
  v_hard_cap := (v_ledger.total_budget_bytes * COALESCE(v_settings.hard_limit_percent, 95)) / 100;

  -- 5. Mark only genuinely expired reservations as expired
  UPDATE public.storage_reservations
  SET status = 'expired'
  WHERE status = 'reserved' AND expires_at < now();

  -- 6. Recompute active unexpired reservations from table
  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_ledger.active_reserved_bytes
  FROM public.storage_reservations
  WHERE status = 'reserved' AND expires_at >= now();

  -- 7. Evaluate Capacity
  v_total_needed := v_ledger.reconciled_stored_bytes + v_ledger.active_reserved_bytes + v_bytes_to_reserve;

  IF v_total_needed > v_hard_cap THEN
    UPDATE public.storage_capacity_ledger
    SET active_reserved_bytes = v_ledger.active_reserved_bytes,
        updated_at = now()
    WHERE id = 'global_storage';

    RETURN QUERY SELECT
      false,
      v_bytes_to_reserve,
      v_ledger.reconciled_stored_bytes,
      v_ledger.active_reserved_bytes,
      v_hard_cap,
      GREATEST(0, v_hard_cap - (v_ledger.reconciled_stored_bytes + v_ledger.active_reserved_bytes)),
      'Storage capacity limit exceeded (hard limit 95%). FIFO cleanup required.'::TEXT;
    RETURN;
  END IF;

  -- 8. Insert Confirmed Reservation with safe TTL matching authorization
  INSERT INTO public.storage_reservations (
    reservation_token,
    storage_path,
    media_type,
    mime_type,
    size_bytes,
    client_hash,
    status,
    expires_at
  ) VALUES (
    p_token,
    p_path,
    p_media_type,
    p_mime,
    v_bytes_to_reserve,
    p_client_hash,
    'reserved',
    now() + (p_ttl_seconds || ' seconds')::INTERVAL
  );

  -- 9. Increment active_reserved_bytes on locked ledger
  UPDATE public.storage_capacity_ledger
  SET active_reserved_bytes = v_ledger.active_reserved_bytes + v_bytes_to_reserve,
      updated_at = now()
  WHERE id = 'global_storage';

  RETURN QUERY SELECT
    true,
    v_bytes_to_reserve,
    v_ledger.reconciled_stored_bytes,
    v_ledger.active_reserved_bytes + v_bytes_to_reserve,
    v_hard_cap,
    GREATEST(0, v_hard_cap - v_total_needed),
    NULL::TEXT;
END;
$$;

-- Restrict execution strictly to service_role (revoked from PUBLIC, anon, and authenticated)
REVOKE ALL ON FUNCTION public.reserve_storage_capacity_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_storage_capacity_atomic FROM anon;
REVOKE ALL ON FUNCTION public.reserve_storage_capacity_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_storage_capacity_atomic TO service_role;

-- ==============================================================================
-- Idempotent Reservation Finalization Function
-- Validates: p_actual_bytes > 0 AND p_actual_bytes <= size_bytes
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.finalize_storage_reservation_atomic(
  p_token VARCHAR(64),
  p_actual_bytes BIGINT
)
RETURNS TABLE (
  success BOOLEAN,
  reconciled_stored BIGINT,
  active_reserved BIGINT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res RECORD;
  v_ledger RECORD;
BEGIN
  -- Validate actual byte count
  IF p_actual_bytes <= 0 THEN
    RETURN QUERY SELECT false, 0::BIGINT, 0::BIGINT, 'Actual byte count must be greater than 0.'::TEXT;
    RETURN;
  END IF;

  -- Lock ledger row
  SELECT * INTO v_ledger
  FROM public.storage_capacity_ledger
  WHERE id = 'global_storage'
  FOR UPDATE;

  -- Fetch reservation
  SELECT * INTO v_res
  FROM public.storage_reservations
  WHERE reservation_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, 'Reservation token not found.'::TEXT;
    RETURN;
  END IF;

  -- Idempotency check: if already finalized, return current state safely
  IF v_res.status = 'finalized' THEN
    RETURN QUERY SELECT true, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, NULL::TEXT;
    RETURN;
  END IF;

  IF v_res.status <> 'reserved' THEN
    RETURN QUERY SELECT false, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, 'Reservation is no longer active.'::TEXT;
    RETURN;
  END IF;

  -- Validate actual bytes does not exceed maximum reserved quota
  IF p_actual_bytes > v_res.size_bytes THEN
    RETURN QUERY SELECT false, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, 'Actual uploaded bytes exceeds reserved capacity.'::TEXT;
    RETURN;
  END IF;

  -- Mark finalized
  UPDATE public.storage_reservations
  SET status = 'finalized'
  WHERE id = v_res.id;

  -- Adjust ledger: add actual verified bytes to stored, deduct reserved quota
  UPDATE public.storage_capacity_ledger
  SET reconciled_stored_bytes = reconciled_stored_bytes + p_actual_bytes,
      active_reserved_bytes = GREATEST(0, active_reserved_bytes - v_res.size_bytes),
      updated_at = now()
  WHERE id = 'global_storage';

  SELECT reconciled_stored_bytes, active_reserved_bytes INTO v_ledger
  FROM public.storage_capacity_ledger WHERE id = 'global_storage';

  RETURN QUERY SELECT true, v_ledger.reconciled_stored_bytes, v_ledger.active_reserved_bytes, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_storage_reservation_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_storage_reservation_atomic FROM anon;
REVOKE ALL ON FUNCTION public.finalize_storage_reservation_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_storage_reservation_atomic TO service_role;

-- ==============================================================================
-- Idempotent Reservation Release Function
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.release_storage_reservation_atomic(
  p_token VARCHAR(64)
)
RETURNS TABLE (
  success BOOLEAN,
  active_reserved BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res RECORD;
  v_ledger RECORD;
BEGIN
  -- Lock ledger row
  SELECT * INTO v_ledger
  FROM public.storage_capacity_ledger
  WHERE id = 'global_storage'
  FOR UPDATE;

  -- Fetch reservation
  SELECT * INTO v_res
  FROM public.storage_reservations
  WHERE reservation_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, v_ledger.active_reserved_bytes;
    RETURN;
  END IF;

  -- Idempotency: if already released or expired, succeed without modifying counts twice
  IF v_res.status IN ('released', 'expired') THEN
    RETURN QUERY SELECT true, v_ledger.active_reserved_bytes;
    RETURN;
  END IF;

  -- If finalized, cannot release (it is now permanent stored bytes)
  IF v_res.status = 'finalized' THEN
    RETURN QUERY SELECT false, v_ledger.active_reserved_bytes;
    RETURN;
  END IF;

  -- Mark released
  UPDATE public.storage_reservations
  SET status = 'released'
  WHERE id = v_res.id;

  -- Deduct reserved bytes
  UPDATE public.storage_capacity_ledger
  SET active_reserved_bytes = GREATEST(0, active_reserved_bytes - v_res.size_bytes),
      updated_at = now()
  WHERE id = 'global_storage';

  SELECT active_reserved_bytes INTO v_ledger
  FROM public.storage_capacity_ledger WHERE id = 'global_storage';

  RETURN QUERY SELECT true, v_ledger.active_reserved_bytes;
END;
$$;

REVOKE ALL ON FUNCTION public.release_storage_reservation_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_storage_reservation_atomic FROM anon;
REVOKE ALL ON FUNCTION public.release_storage_reservation_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_storage_reservation_atomic TO service_role;

-- ==============================================================================
-- Atomic Ledger Storage Reconciliation Function
-- Sets reconciled_stored_bytes from actual verified storage objects total
-- Recounts active unexpired reservations to eliminate drift
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_storage_ledger_atomic(
  p_actual_stored_bytes BIGINT
)
RETURNS TABLE (
  success BOOLEAN,
  reconciled_stored BIGINT,
  active_reserved BIGINT,
  last_reconciled TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_reserved BIGINT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Lock ledger row
  PERFORM 1 FROM public.storage_capacity_ledger
  WHERE id = 'global_storage'
  FOR UPDATE;

  -- Clean expired reservations
  UPDATE public.storage_reservations
  SET status = 'expired'
  WHERE status = 'reserved' AND expires_at < v_now;

  -- Compute actual active unexpired reservations
  SELECT COALESCE(SUM(size_bytes), 0)
  INTO v_active_reserved
  FROM public.storage_reservations
  WHERE status = 'reserved' AND expires_at >= v_now;

  -- Update ledger with reconciled counts
  UPDATE public.storage_capacity_ledger
  SET reconciled_stored_bytes = GREATEST(0, p_actual_stored_bytes),
      active_reserved_bytes = v_active_reserved,
      last_reconciled_at = v_now,
      updated_at = v_now
  WHERE id = 'global_storage';

  -- Record audit log
  INSERT INTO public.storage_audit_logs (event_type, bytes_change, details)
  VALUES (
    'reconcile',
    p_actual_stored_bytes,
    jsonb_build_object(
      'stored_bytes', p_actual_stored_bytes,
      'active_reserved', v_active_reserved,
      'reconciled_at', v_now
    )
  );

  RETURN QUERY SELECT true, p_actual_stored_bytes, v_active_reserved, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_storage_ledger_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_storage_ledger_atomic FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_storage_ledger_atomic FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_storage_ledger_atomic TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
