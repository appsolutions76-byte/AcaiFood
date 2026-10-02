-- ==========================================================
-- AÇAÍFOOD — ROLLBACK FASE 2: RPCS DE TRANSIÇÃO E PIN
-- Timestamp: 20261002000000
-- ==========================================================

DROP FUNCTION IF EXISTS public.advance_order_status(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_order_pins(UUID);

NOTIFY pgrst, 'reload schema';
