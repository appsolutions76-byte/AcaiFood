-- ==============================================================================
-- AÇAÍFOOD — ROLLBACK: MIGRAÇÃO R12
-- Timestamp: 20261002030000
-- ==============================================================================

-- 1. Restaurar permissão de transition_order_status
GRANT EXECUTE ON FUNCTION public.transition_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO PUBLIC;

-- 2. Restaurar permissão de generate_delivery_pin / generate_pickup_pin
GRANT EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_pickup_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pickup_pin(uuid) TO PUBLIC;

-- 3. Restaurar permissão de UPDATE em users (cpf_cnpj, pix_key)
GRANT UPDATE (cpf_cnpj, pix_key) ON public.users TO authenticated;

-- 4. Remover funções e tabelas novas
DROP FUNCTION IF EXISTS public.get_driver_radar();
DROP TABLE IF EXISTS public.order_pins CASCADE;
DROP TABLE IF EXISTS public.terms_acceptances CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;

NOTIFY pgrst, 'reload schema';
