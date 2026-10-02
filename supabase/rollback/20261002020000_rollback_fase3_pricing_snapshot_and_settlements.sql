-- ==========================================================
-- AÇAÍFOOD — ROLLBACK FASE 3: SNAPSHOT E SETTLEMENTS
-- Timestamp: 20261002020000
-- ==========================================================

DROP TRIGGER IF EXISTS trg_create_order_settlements ON public.orders;
DROP FUNCTION IF EXISTS public.create_order_settlements_on_receive();
DROP TABLE IF EXISTS public.settlements;
DROP INDEX IF EXISTS public.unq_orders_pix_end_to_end_id;

NOTIFY pgrst, 'reload schema';
