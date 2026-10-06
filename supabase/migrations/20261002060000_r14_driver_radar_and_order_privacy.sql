-- ==============================================================================
-- AÇAÍFOOD — R14: Radar Seguro, Privacidade de Pedidos e RLS Granular (Item 1.1)
-- Timestamp: 20261002060000
-- Base: docs/01_OPERACAO_DO_APP.md, docs/15_REAUDITORIA_POS_R12_2026-10-02.md (P4, Anexo I 6)
--
-- O que faz:
--  1. Garante coluna delivery_bairro na tabela public.orders.
--  2. Atualiza a RPC get_driver_radar() para retornar apenas dados seguros do radar:
--     - id, order_type, status, delivery_distance_km, driver_payout_amount,
--       origin_name, origin_bairro, delivery_bairro, approx_lat, approx_lng, created_at.
--     - Oculta delivery_address, delivery_reference, nome e telefone do cliente.
--  3. Atualiza a policy de SELECT em public.orders:
--     - Remove a brecha que liberava SELECT de pedidos sem motorista para qualquer usuário.
--     - Permite SELECT apenas para: Comprador (buyer_id), Motorista Atribuído (driver_id),
--       Parceiro da Loja (storefronts.partner_id) e Administradores.
--  4. Revoga SELECT irrestrito em public.orders e concede SELECT apenas para a lista
--     explícita de colunas autorizadas (sem delivery_pin, pickup_pin, pin_hash).
-- ==============================================================================

-- 1. Garantir coluna delivery_bairro em orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_bairro TEXT;

-- 2. Atualizar a RPC pública get_driver_radar()
DROP FUNCTION IF EXISTS public.get_driver_radar();
CREATE OR REPLACE FUNCTION public.get_driver_radar()
RETURNS TABLE (
  id UUID,
  order_type TEXT,
  status TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
  origin_name TEXT,
  origin_bairro TEXT,
  delivery_bairro TEXT,
  approx_lat NUMERIC,
  approx_lng NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    COALESCE(o.order_type, 'B2C')::text AS order_type,
    o.status::text,
    COALESCE(o.delivery_distance_km, 0)::numeric AS delivery_distance_km,
    COALESCE(o.driver_payout_amount, 0)::numeric AS driver_payout_amount,
    COALESCE(sf.name, u_seller.name, 'Loja / Batedeira')::text AS origin_name,
    COALESCE(sf.bairro, u_seller.bairro, 'Centro')::text AS origin_bairro,
    COALESCE(o.delivery_bairro, u_buyer.bairro, 'Destino')::text AS delivery_bairro,
    ROUND(COALESCE(o.delivery_lat, 0)::numeric, 3) AS approx_lat,
    ROUND(COALESCE(o.delivery_lng, 0)::numeric, 3) AS approx_lng,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  LEFT JOIN public.users u_seller ON u_seller.id = sf.partner_id
  LEFT JOIN public.users u_buyer ON u_buyer.id = o.buyer_id
  WHERE o.driver_id IS NULL
    AND o.status IN ('READY', 'SEARCHING_OPERATOR', 'PREPARING', 'PAID')
    AND COALESCE(o.is_hidden, false) = false
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO service_role;

-- 3. Atualizar Policy de SELECT em public.orders (Remove liberação de pedidos sem motorista)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
CREATE POLICY "Orders Granular Select" ON public.orders
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid()
    OR driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf
      WHERE sf.id = orders.seller_storefront_id
        AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
);

-- 4. Revogar SELECT irrestrito e conceder apenas colunas autorizadas a authenticated
REVOKE SELECT ON public.orders FROM anon, authenticated;

GRANT SELECT (
  id,
  buyer_id,
  seller_storefront_id,
  driver_id,
  status,
  order_type,
  products_subtotal,
  delivery_distance_km,
  applied_platform_fee_percent,
  applied_delivery_fee_per_km,
  applied_delivery_platform_fee_percent,
  payment_attempt_count,
  asaas_payment_id,
  asaas_charge_status,
  asaas_transfer_status,
  asaas_refund_id,
  asaas_refund_status,
  cancellation_reason,
  cancelled_at,
  cancelled_by,
  created_at,
  paid_at,
  accepted_at,
  ready_at,
  picked_up_at,
  delivered_at,
  received_at,
  delivery_address,
  delivery_lat,
  delivery_lng,
  delivery_reference,
  delivery_bairro,
  payout_seller_done,
  payout_driver_done,
  is_hidden,
  seller_payout_amount,
  driver_payout_amount,
  platform_fee_amount,
  delivery_fee_amount,
  asaas_fee_amount,
  pricing_snapshot,
  pickup_pin_attempts,
  last_pickup_pin_attempt_at,
  pin_attempts,
  last_pin_attempt_at
) ON public.orders TO authenticated;

NOTIFY pgrst, 'reload schema';
