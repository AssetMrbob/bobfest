-- ==============================================================================
-- Least-Privilege Role Grants for BOBFESS Phase 02B
-- ==============================================================================
-- Granular grants targeting only specific required operations per role:
-- - anon: USAGE on schema public (No direct table access; submissions go via API)
-- - authenticated: SELECT on admin_profiles, submissions, media_assets, app_settings,
--                  publication_batches, publication_items, moderation_logs, system_logs,
--                  UPDATE on submissions, app_settings, INSERT on moderation_logs,
--                  all subject to Row Level Security (is_admin()).
-- - service_role: Targeted operational access for server-side operations.
-- ==============================================================================

-- 1. Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Authenticated role permissions (Controlled by RLS policies)
GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT, UPDATE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_items TO authenticated;
GRANT SELECT, INSERT ON public.moderation_logs TO authenticated;
GRANT SELECT, INSERT ON public.system_logs TO authenticated;

-- 3. Service role permissions (Server-side API handlers, rate limiting, and background workers)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_keys TO service_role;

-- 4. Routine execution grants
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit(VARCHAR, INT, INTERVAL) TO service_role;
