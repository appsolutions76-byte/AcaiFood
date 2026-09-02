-- ==========================================================
-- AÇAÍFOOD — FINANCIAL PATCH, INCIDENT LOGS & SYSTEM RESET
-- Copie e cole este script no SQL Editor do seu Supabase Dashboard
-- Versão: 20260902010000
-- ==========================================================

-- 1. TABELA DE OCORRÊNCIAS / PROBLEMAS COM USUÁRIOS (QUEM, QUANDO, O QUÊ)
CREATE TABLE IF NOT EXISTS public.incident_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_role TEXT,
  user_phone TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- 'CANCELAMENTO', 'ESTORNO_PIX', 'ERRO_PIN', 'PIN_BLOQUEADO', 'DISPUTA', 'BLOQUEIO_CONTA', 'RECLAMACAO', 'OUTRO'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIA', -- 'BAIXA', 'MEDIA', 'ALTA', 'CRITICA'
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'EM_ANALISE', 'RESOLVIDO'
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS em incident_logs
ALTER TABLE public.incident_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incident_logs_select_all" ON public.incident_logs;
CREATE POLICY "incident_logs_select_all" ON public.incident_logs
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "incident_logs_insert_admin" ON public.incident_logs;
CREATE POLICY "incident_logs_insert_admin" ON public.incident_logs
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "incident_logs_update_admin" ON public.incident_logs;
CREATE POLICY "incident_logs_update_admin" ON public.incident_logs
  FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS "incident_logs_delete_admin" ON public.incident_logs;
CREATE POLICY "incident_logs_delete_admin" ON public.incident_logs
  FOR DELETE TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_incident_logs_created_at ON public.incident_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_logs_category ON public.incident_logs (category);
CREATE INDEX IF NOT EXISTS idx_incident_logs_user_id ON public.incident_logs (user_id);

-- 2. FUNÇÃO E TRIGGER AJUSTADOS: SUPORTE A MODO FIXED E COLETA
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
  v_delivery_total NUMERIC := 0;
  
  -- Modos de frete da plataforma
  v_courier_mode TEXT := 'KM';
  v_courier_fixed NUMERIC := 8.00;
  v_transporter_mode TEXT := 'KM';
  v_transporter_fixed NUMERIC := 150.00;
  v_ecopoint_mode TEXT := 'KM';
  v_ecopoint_fixed NUMERIC := 50.00;
BEGIN
  -- Dispara apenas na transição para RECEIVED
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
    v_subtotal := COALESCE(NEW.products_subtotal, 0);
    v_plat_fee := COALESCE(NEW.applied_platform_fee_percent, 0);
    v_delivery_fee := COALESCE(NEW.applied_delivery_fee_per_km, 0);
    v_plat_delivery_fee := COALESCE(NEW.applied_delivery_platform_fee_percent, 0);
    v_km := COALESCE(NEW.delivery_distance_km, 0);

    -- Ler configurações de modo de frete (Fixo vs KM)
    SELECT 
      COALESCE(courier_payment_mode, 'KM'),
      COALESCE(courier_fixed_fee, 8.00),
      COALESCE(transporter_payment_mode, 'KM'),
      COALESCE(transporter_fixed_fee, 150.00),
      COALESCE(ecopoint_payment_mode, 'KM'),
      COALESCE(ecopoint_fixed_fee, 50.00)
    INTO
      v_courier_mode,
      v_courier_fixed,
      v_transporter_mode,
      v_transporter_fixed,
      v_ecopoint_mode,
      v_ecopoint_fixed
    FROM public.platform_settings
    LIMIT 1;

    IF NEW.order_type = 'B2C' THEN
      IF v_courier_mode = 'FIXED' THEN
        v_delivery_total := v_courier_fixed;
      ELSE
        v_delivery_total := v_delivery_fee * v_km;
      END IF;

      v_mot_bruto := v_delivery_total;
      v_mot_liq := v_delivery_total * (1 - v_plat_delivery_fee / 100);
      v_app_rev := v_subtotal * (v_plat_fee / 100) + v_delivery_total * (v_plat_delivery_fee / 100);
      v_volume := v_subtotal + v_delivery_total;
      v_bat_bruto := v_subtotal;
      v_bat_liq := v_subtotal * (1 - v_plat_fee / 100);

    ELSIF NEW.order_type = 'B2B' THEN
      IF v_transporter_mode = 'FIXED' THEN
        v_delivery_total := v_transporter_fixed;
      ELSE
        v_delivery_total := v_delivery_fee * v_km;
      END IF;

      v_cam_bruto := v_delivery_total;
      v_cam_liq := v_delivery_total * (1 - v_plat_delivery_fee / 100);
      v_app_rev := v_subtotal * (v_plat_fee / 100) + v_delivery_total * (v_plat_delivery_fee / 100);
      v_volume := v_subtotal + v_delivery_total;
      v_forn_bruto := v_subtotal;
      v_forn_liq := v_subtotal * (1 - v_plat_fee / 100);

    ELSIF NEW.order_type = 'COLETA' THEN
      -- Em COLETA, subtotal já representa o valor do frete da caçamba
      v_delivery_total := v_subtotal;
      v_cam_bruto := v_delivery_total;
      v_cam_liq := v_delivery_total * (1 - v_plat_delivery_fee / 100);
      v_app_rev := v_delivery_total * (v_plat_delivery_fee / 100);
      v_volume := v_delivery_total;
      v_mot_bruto := 0;
      v_mot_liq := 0;
      v_bat_bruto := 0;
      v_bat_liq := 0;
      v_forn_bruto := 0;
      v_forn_liq := 0;
    ELSE
      v_delivery_total := v_delivery_fee * v_km;
      v_mot_bruto := v_delivery_total;
      v_mot_liq := v_delivery_total * (1 - v_plat_delivery_fee / 100);
      v_app_rev := v_subtotal * (v_plat_fee / 100) + v_delivery_total * (v_plat_delivery_fee / 100);
      v_volume := v_subtotal + v_delivery_total;
    END IF;

    -- Atualiza os três períodos de balanço atômica e simultaneamente
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
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.increment_admin_balances_on_received();

-- 3. FUNÇÃO RPC DE RESET TOTAL DO SISTEMA (PODER TOTAL DO BOTÃO LIMPAR)
CREATE OR REPLACE FUNCTION public.reset_admin_system_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders_deleted INTEGER := 0;
BEGIN
  -- 3.1 Excluir tabelas filhas ordenadamente
  DELETE FROM public.incident_logs;
  DELETE FROM public.disputes;
  DELETE FROM public.order_messages;
  DELETE FROM public.print_log;
  DELETE FROM public.order_status_history;
  DELETE FROM public.order_tracking;
  DELETE FROM public.order_items;
  DELETE FROM public.splits;

  -- 3.2 Excluir todos os pedidos
  WITH deleted AS (
    DELETE FROM public.orders RETURNING 1
  )
  SELECT count(*) INTO v_orders_deleted FROM deleted;

  -- 3.3 Zerar atômica e completamente a tabela admin_balances
  UPDATE public.admin_balances SET
    total_orders = 0,
    total_volume = 0,
    app_revenue = 0,
    fornecedores_bruto = 0,
    fornecedores_liquido = 0,
    batedeiras_bruto = 0,
    batedeiras_liquido = 0,
    motoristas_bruto = 0,
    motoristas_liquido = 0,
    caminhoes_bruto = 0,
    caminhoes_liquido = 0,
    updated_at = NOW()
  WHERE id IN ('historical', 'monthly', 'daily');

  RETURN jsonb_build_object(
    'success', true,
    'orders_deleted', v_orders_deleted,
    'balances_reset', true,
    'message', 'Sistema resetado com sucesso: todos os pedidos e balanços foram zerados para recomeço.'
  );
END;
$$;

-- 4. Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
