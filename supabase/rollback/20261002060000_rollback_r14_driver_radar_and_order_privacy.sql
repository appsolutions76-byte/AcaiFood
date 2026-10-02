-- ==============================================================================
-- AÇAÍFOOD — ROLLBACK R14: Reverter Radar Seguro e Permissões de Coluna
-- Timestamp: 20261002060000
-- ==============================================================================

-- 1. Restaurar concessão padrão de SELECT em public.orders
GRANT SELECT ON public.orders TO authenticated;

-- 2. Restaurar policy antiga de SELECT
DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
CREATE POLICY "Orders Granular Select" ON public.orders
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid()
    OR driver_id = auth.uid()
    OR (
      driver_id IS NULL 
      AND status IN ('PAID', 'PREPARING', 'READY', 'pendente', 'preparo', 'pronto', 'SEARCHING_OPERATOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf
      WHERE sf.id = orders.seller_storefront_id
        AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
);

-- 3. Restaurar versão anterior da RPC get_driver_radar
CREATE OR REPLACE FUNCTION public.get_driver_radar()
RETURNS TABLE (
  id UUID,
  order_type TEXT,
  status TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
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
    COALESCE(o.order_type, 'delivery')::text as order_type,
    o.status::text,
    COALESCE(o.delivery_distance_km, 0)::numeric as delivery_distance_km,
    COALESCE(o.driver_payout_amount, 0)::numeric as driver_payout_amount,
    COALESCE(o.delivery_reference, 'Centro')::text as delivery_bairro,
    ROUND(COALESCE(o.delivery_lat, 0)::numeric, 3) as approx_lat,
    ROUND(COALESCE(o.delivery_lng, 0)::numeric, 3) as approx_lng,
    o.created_at
  FROM public.orders o
  WHERE o.driver_id IS NULL
    AND o.status IN ('READY', 'PREPARING', 'PAID', 'SEARCHING_OPERATOR')
    AND COALESCE(o.is_hidden, false) = false
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO service_role;

NOTIFY pgrst, 'reload schema';
