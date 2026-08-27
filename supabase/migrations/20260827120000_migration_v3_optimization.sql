-- ==========================================================
-- MIGRATION V3 OPTIMIZATION & REFUND/RADAR FIX - AÇAÍFOOD
-- Execute este script no SQL Editor do Supabase para atualizar o banco.
-- ==========================================================

-- 1. Novas Colunas de Cancelamento, Estorno e Rastreabilidade em public.orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS asaas_refund_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_refund_status TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id);

-- 2. Índices de Alta Performance para Consultas Multidispositivo & Radar
CREATE INDEX IF NOT EXISTS idx_orders_radar_b2c ON public.orders(order_type, status, driver_id) WHERE driver_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_radar_b2b_col ON public.orders(order_type, status, driver_id) WHERE driver_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sf_status ON public.orders(seller_storefront_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON public.orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_products_storefront_id ON public.products(storefront_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);

-- 3. Atualização de Políticas RLS da Tabela Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Update" ON public.orders;
DROP POLICY IF EXISTS "Allow all select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all update on orders" ON public.orders;

-- SELECT Granular: Permite que Comprador, Vendedor, Motorista Atribuído, Admin E Motoristas buscando no Radar (driver_id IS NULL) leiam os pedidos
CREATE POLICY "Orders Granular Select" ON public.orders
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid()
    OR driver_id = auth.uid()
    OR (
      driver_id IS NULL 
      AND status IN ('PAID', 'PREPARING', 'READY', 'pendente', 'preparo', 'pronto')
    )
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf
      WHERE sf.id = orders.seller_storefront_id
        AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
);

-- INSERT: Somente o próprio comprador pode criar pedido
CREATE POLICY "Orders Granular Insert" ON public.orders
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND buyer_id = auth.uid()
);

-- UPDATE: Partes do pedido e entregadores aceitando corrida podem atualizar status
CREATE POLICY "Orders Granular Update" ON public.orders
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid()
    OR driver_id = auth.uid()
    OR (
      driver_id IS NULL 
      AND status IN ('PAID', 'PREPARING', 'READY', 'pendente', 'preparo', 'pronto')
    )
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf
      WHERE sf.id = orders.seller_storefront_id
        AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
) WITH CHECK (true);

-- 4. Trigger de Validação de PIN de 4 dígitos para liberação do status RECEIVED
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
      IF NEW.provided_pin IS NULL OR NEW.provided_pin IS DISTINCT FROM OLD.delivery_pin THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança incorreto ou ausente.';
      END IF;
    END IF;
  END IF;
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders;
CREATE TRIGGER check_delivery_pin
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_pin_trigger();

-- 5. Trigger para Atualizar Balanços de Plataforma Atomica quando um Pedido atinge RECEIVED
CREATE OR REPLACE FUNCTION public.increment_admin_balances_on_received()
RETURNS TRIGGER AS $$
DECLARE
  v_volume NUMERIC;
  v_app_rev NUMERIC;
  v_forn_bruto NUMERIC := 0;
  v_forn_liq NUMERIC := 0;
  v_bat_bruto NUMERIC := 0;
  v_bat_liq NUMERIC := 0;
  v_mot_bruto NUMERIC := 0;
  v_mot_liq NUMERIC := 0;
  v_cam_bruto NUMERIC := 0;
  v_cam_liq NUMERIC := 0;
  v_plat_fee NUMERIC;
  v_delivery_fee NUMERIC;
  v_plat_delivery_fee NUMERIC;
  v_subtotal NUMERIC;
  v_km NUMERIC;
BEGIN
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
    v_subtotal := COALESCE(NEW.products_subtotal, 0);
    v_plat_fee := COALESCE(NEW.applied_platform_fee_percent, 0);
    v_delivery_fee := COALESCE(NEW.applied_delivery_fee_per_km, 0);
    v_plat_delivery_fee := COALESCE(NEW.applied_delivery_platform_fee_percent, 0);
    v_km := COALESCE(NEW.delivery_distance_km, 0);

    v_mot_bruto := v_delivery_fee * v_km;
    v_mot_liq := v_mot_bruto * (1 - v_plat_delivery_fee / 100);
    v_app_rev := v_subtotal * (v_plat_fee / 100) + v_mot_bruto * (v_plat_delivery_fee / 100);
    v_volume := v_subtotal + v_mot_bruto;

    IF NEW.order_type = 'B2B' THEN
      v_cam_bruto := v_mot_bruto;
      v_cam_liq := v_mot_liq;
      v_mot_bruto := 0;
      v_mot_liq := 0;
      v_forn_bruto := v_subtotal;
      v_forn_liq := v_subtotal * (1 - v_plat_fee / 100);
    ELSIF NEW.order_type = 'B2C' THEN
      v_bat_bruto := v_subtotal;
      v_bat_liq := v_subtotal * (1 - v_plat_fee / 100);
    ELSIF NEW.order_type = 'COLETA' THEN
      v_mot_bruto := v_delivery_fee * v_km;
      v_mot_liq := v_mot_bruto * (1 - v_plat_delivery_fee / 100);
    END IF;

    UPDATE public.admin_balances SET
      total_orders = total_orders + 1,
      total_volume = total_volume + v_volume,
      app_revenue = app_revenue + v_app_rev,
      fornecedores_bruto = fornecedores_bruto + v_forn_bruto,
      fornecedores_liquido = fornecedores_liquido + v_forn_liq,
      batedeiras_bruto = batedeiras_bruto + v_bat_bruto,
      batedeiras_liquido = batedeiras_liquido + v_bat_liq,
      motoristas_bruto = motoristas_bruto + v_mot_bruto,
      motoristas_liquido = motoristas_liquido + v_mot_liq,
      caminhoes_bruto = caminhoes_bruto + v_cam_bruto,
      caminhoes_liquido = caminhoes_liquido + v_cam_liq,
      updated_at = NOW()
    WHERE id IN ('historical', 'monthly', 'daily');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_increment_admin_balances ON public.orders;
CREATE TRIGGER trigger_increment_admin_balances
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.increment_admin_balances_on_received();

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';
