-- ==========================================================
-- AÇAÍFOOD — GRANT STATUS AND IS_ONLINE UPDATE TO AUTHENTICATED
-- Timestamp: 20260913000000
-- ==========================================================

GRANT UPDATE (
  status,
  is_online
) ON public.users TO authenticated;

GRANT UPDATE (
  is_active
) ON public.storefronts TO authenticated;

NOTIFY pgrst, 'reload schema';
