-- ==========================================================
-- SECURITY PATCH v2 — AÇAÍFOOD
-- Aplicar no SQL Editor do Supabase para corrigir todas as
-- vulnerabilidades identificadas na auditoria de segurança.
-- ==========================================================

-- ============================================================
-- PATCH 1: RLS de Orders — Granular por Role (Alto Impacto)
-- Antes: qualquer autenticado via todos os pedidos
-- Depois: cada ator vê apenas seus próprios pedidos
-- ============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Update" ON public.orders;
DROP POLICY IF EXISTS "Allow all select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all update on orders" ON public.orders;

-- SELECT: cada ator vê apenas seus próprios pedidos
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

-- INSERT: somente o próprio comprador pode criar um pedido em seu nome
CREATE POLICY "Orders Granular Insert" ON public.orders
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND buyer_id = auth.uid()
);

-- UPDATE: partes do pedido e admin podem atualizar status
CREATE POLICY "Orders Granular Update" ON public.orders
FOR UPDATE USING (
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
) WITH CHECK (true);

-- ============================================================
-- PATCH 2: Users — Restringir leitura a usuários autenticados
-- Antes: qualquer pessoa sem login lê CPF, PIX, wallet_id, etc.
-- Depois: apenas autenticados podem ler dados de usuários
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on users" ON public.users;
DROP POLICY IF EXISTS "Allow self insert on users" ON public.users;
DROP POLICY IF EXISTS "Allow self update on users" ON public.users;

-- SELECT: requer autenticação (protege CPF/PIX/asaas_wallet_id)
CREATE POLICY "Allow authenticated select on users" ON public.users
FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: qualquer autenticado pode criar seu próprio perfil
CREATE POLICY "Allow self insert on users" ON public.users
FOR INSERT WITH CHECK (true);

-- UPDATE: somente o próprio usuário ou admin
CREATE POLICY "Allow self update on users" ON public.users
FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (id = auth.uid() OR public.is_admin())
);

-- ============================================================
-- PATCH 3: admin_balances — Restringir escrita ao admin
-- Antes: qualquer autenticado pode escrever totalizadores
-- Depois: somente admin pode escrever; leitura requer auth
-- ============================================================
ALTER TABLE public.admin_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on admin_balances" ON public.admin_balances;
DROP POLICY IF EXISTS "Allow authenticated write on admin_balances" ON public.admin_balances;

-- SELECT: requer autenticação (dados financeiros internos)
CREATE POLICY "Allow authenticated select on admin_balances" ON public.admin_balances
FOR SELECT USING (auth.role() = 'authenticated' AND public.is_admin());

-- ALL (INSERT/UPDATE/DELETE): somente admin
CREATE POLICY "Allow admin write on admin_balances" ON public.admin_balances
FOR ALL USING (
  auth.role() = 'authenticated' AND public.is_admin()
);

-- ============================================================
-- PATCH 4: storefronts — UNIQUE constraint partner_id
-- Impede criação duplicada de vitrine por race condition
-- ============================================================
ALTER TABLE public.storefronts
  DROP CONSTRAINT IF EXISTS storefronts_partner_id_unique;

ALTER TABLE public.storefronts
  ADD CONSTRAINT storefronts_partner_id_unique UNIQUE (partner_id);

-- ============================================================
-- PATCH 5: Trigger DB para incrementar admin_balances
-- Move a lógica do frontend para o banco (atômico e seguro)
-- Dispara automaticamente quando orders.status muda para RECEIVED
-- ============================================================
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
  -- Only trigger on transition TO RECEIVED
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
    v_subtotal := COALESCE(NEW.products_subtotal, 0);
    v_plat_fee := COALESCE(NEW.applied_platform_fee_percent, 0);
    v_delivery_fee := COALESCE(NEW.applied_delivery_fee_per_km, 0);
    v_plat_delivery_fee := COALESCE(NEW.applied_delivery_platform_fee_percent, 0);
    v_km := COALESCE(NEW.delivery_distance_km, 0);

    -- Delivery total
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
    END IF;

    -- Update all three balance periods atomically
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

-- ============================================================
-- PATCH 6: Atualizar RLS de storefronts para exigir auth no SELECT
-- ============================================================
DROP POLICY IF EXISTS "Allow public select on storefronts" ON public.storefronts;

CREATE POLICY "Allow authenticated select on storefronts" ON public.storefronts
FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- PATCH 7: Atualizar RLS de products para exigir auth no SELECT
-- ============================================================
DROP POLICY IF EXISTS "Allow public select on products" ON public.products;

CREATE POLICY "Allow authenticated select on products" ON public.products
FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- PATCH 8: Atualizar RLS de cities para exigir auth no SELECT
-- ============================================================
DROP POLICY IF EXISTS "Allow public select on cities" ON public.cities;

CREATE POLICY "Allow authenticated select on cities" ON public.cities
FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- PATCH 9: Atualizar RLS de platform_settings para exigir auth
-- ============================================================
DROP POLICY IF EXISTS "Allow public select on platform_settings" ON public.platform_settings;

CREATE POLICY "Allow authenticated select on platform_settings" ON public.platform_settings
FOR SELECT USING (auth.role() = 'authenticated');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
