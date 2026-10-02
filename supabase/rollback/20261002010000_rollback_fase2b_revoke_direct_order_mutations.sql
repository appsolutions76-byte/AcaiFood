-- ==========================================================
-- AÇAÍFOOD — ROLLBACK FASE 2B: RESTAURAÇÃO DE PERMISSÕES ORDERS
-- Timestamp: 20261002010000
-- ==========================================================

GRANT UPDATE ON public.orders TO authenticated;
GRANT SELECT (pin_hash, provided_pin) ON public.orders TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
