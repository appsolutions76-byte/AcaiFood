-- ==============================================================================
-- AÇAÍFOOD — R13 HOTFIX 2/2: fechar a leitura direta de order_pins
-- Timestamp: 20261002050000
--
-- APLICAR SÓ DEPOIS do deploy do app que lê os PINs por get_my_order_pins_bulk
-- e chama check_*_pin sem p_operator_id. Antes disso, a tela perde o PIN.
--
-- Motivo (docs/15, P3): as policies de order_pins são por linha; a loja lia também
-- o delivery_pin e o comprador o pickup_pin. A leitura passa a ser só pelas funções
-- get_my_order_pins / get_my_order_pins_bulk, que filtram por papel.
-- ==============================================================================

REVOKE SELECT ON public.order_pins FROM anon, authenticated;
GRANT ALL ON public.order_pins TO service_role;

-- Remover as funções de compatibilidade (assinatura antiga com p_operator_id)
DROP FUNCTION IF EXISTS public.check_delivery_pin(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.check_pickup_pin(uuid, text, uuid, text);

NOTIFY pgrst, 'reload schema';
