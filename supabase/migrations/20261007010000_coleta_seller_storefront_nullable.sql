-- ==============================================================================
-- AÇAÍFOOD — Coleta de caroço sem loja vendedora
-- Timestamp: 20261007010000
--
-- A coleta (order_type = 'COLETA') é paga pela própria loja e não tem vendedor:
-- seller_storefront_id fica NULL para não gerar repasse de "venda" para quem pagou
-- (VULN-2026-005). A coluna era NOT NULL e o checkout da coleta falhava com
-- "null value in column seller_storefront_id".
-- Funções de pedido, PIN, repasse e radar já tratam seller_storefront_id NULL.
-- B2C e B2B continuam exigindo loja/fornecedor (CHECK abaixo).
-- ==============================================================================

ALTER TABLE public.orders ALTER COLUMN seller_storefront_id DROP NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_required_unless_coleta;
ALTER TABLE public.orders ADD CONSTRAINT orders_seller_required_unless_coleta
  CHECK (seller_storefront_id IS NOT NULL OR order_type = 'COLETA') NOT VALID;

NOTIFY pgrst, 'reload schema';
