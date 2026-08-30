-- ==========================================================
-- COMPLETE AUDIT, SECURITY CORE & SCHEMA MASTER — AÇAÍFOOD
-- Regras de Negócio (Parte A) e Regras Técnicas (Parte B)
-- Execute este script no SQL Editor do Supabase para atualizar o banco.
-- ==========================================================

-- 0. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Remoção de Tabelas Legadas e Triggers Conflitantes
DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders CASCADE;
DROP TRIGGER IF EXISTS validate_delivery_pin_trigger ON public.orders CASCADE;
DROP FUNCTION IF EXISTS public.validate_delivery_pin_trigger() CASCADE;

DROP TABLE IF EXISTS public.mp_oauth_states CASCADE;
DROP TABLE IF EXISTS public.mercadopago_tokens CASCADE;
DROP TABLE IF EXISTS public.mp_payments CASCADE;
DROP TABLE IF EXISTS public.legacy_orders CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.transfers CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.webhooks CASCADE;

-- 2. Garante a Tabela Users e todas as suas colunas
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'cliente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS latitude FLOAT8,
ADD COLUMN IF NOT EXISTS longitude FLOAT8,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN DEFAULT TRUE;

-- 2.1. Função Auxiliar Helper SECURITY DEFINER para checar Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (role = 'ADMIN' OR role = 'admin' OR role = 'PARTNER_ADMIN')
  );
$$;

-- 3. Garante a Tabela Storefronts & Products
CREATE TABLE IF NOT EXISTS public.storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  store_name TEXT,
  price_b2b NUMERIC DEFAULT 140.00,
  price_b2c_popular NUMERIC DEFAULT 20.00,
  price_b2c_medio NUMERIC DEFAULT 26.00,
  price_b2c_grosso NUMERIC DEFAULT 35.00,
  frete_subsidy_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT storefronts_partner_id_unique UNIQUE (partner_id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID REFERENCES public.storefronts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Garante a Tabela Orders e todas as suas colunas
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.users(id),
  seller_storefront_id UUID REFERENCES public.storefronts(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'CREATED',
  order_type TEXT DEFAULT 'B2C',
  products_subtotal NUMERIC DEFAULT 0,
  delivery_distance_km NUMERIC DEFAULT 0,
  applied_platform_fee_percent NUMERIC DEFAULT 0,
  applied_delivery_fee_per_km NUMERIC DEFAULT 0,
  applied_delivery_platform_fee_percent NUMERIC DEFAULT 0,
  pin_hash TEXT,
  pin_attempts INT DEFAULT 0,
  last_pin_attempt_at TIMESTAMPTZ,
  delivery_pin VARCHAR(4),
  payment_attempt_count INT DEFAULT 0,
  asaas_payment_id TEXT,
  asaas_charge_status TEXT,
  asaas_transfer_status TEXT DEFAULT 'PENDING',
  asaas_refund_id TEXT,
  asaas_refund_status TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  delivery_address TEXT,
  delivery_lat FLOAT8,
  delivery_lng FLOAT8,
  delivery_reference TEXT,
  payout_seller_done BOOLEAN DEFAULT FALSE,
  payout_driver_done BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pin_hash TEXT,
ADD COLUMN IF NOT EXISTS pin_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_pin_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS asaas_transfer_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 5. Tabelas de Auditoria, Itens, Splits, PIN, Logs e Disputas
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id),
  actor_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL,
  total_price_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL,
  recipient_id UUID REFERENCES public.users(id),
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pin_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id),
  success BOOLEAN NOT NULL,
  ip_device TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.print_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  print_type TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES public.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution TEXT,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  b2c_fee_percentage NUMERIC DEFAULT 10,
  motoboy_fee_per_km NUMERIC DEFAULT 2.00,
  motoboy_platform_fee_percentage NUMERIC DEFAULT 10,
  b2b_fee_percentage NUMERIC DEFAULT 10,
  truck_fee_per_km NUMERIC DEFAULT 4.00,
  truck_platform_fee_percentage NUMERIC DEFAULT 10,
  col_fee_percentage NUMERIC DEFAULT 10,
  col_fee_per_km NUMERIC DEFAULT 8.00,
  col_platform_fee_percentage NUMERIC DEFAULT 10,
  col_fixed_price NUMERIC DEFAULT 50.00,
  payout_time TEXT DEFAULT '22:00',
  courier_payment_mode TEXT DEFAULT 'KM',
  courier_fixed_fee NUMERIC DEFAULT 8.00,
  transporter_payment_mode TEXT DEFAULT 'KM',
  transporter_fixed_fee NUMERIC DEFAULT 150.00,
  ecopoint_payment_mode TEXT DEFAULT 'KM',
  ecopoint_fixed_fee NUMERIC DEFAULT 50.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_balances (
  id TEXT PRIMARY KEY,
  total_orders INTEGER DEFAULT 0,
  total_volume NUMERIC DEFAULT 0,
  app_revenue NUMERIC DEFAULT 0,
  fornecedores_bruto NUMERIC DEFAULT 0,
  fornecedores_liquido NUMERIC DEFAULT 0,
  batedeiras_bruto NUMERIC DEFAULT 0,
  batedeiras_liquido NUMERIC DEFAULT 0,
  motoristas_bruto NUMERIC DEFAULT 0,
  motoristas_liquido NUMERIC DEFAULT 0,
  caminhoes_bruto NUMERIC DEFAULT 0,
  caminhoes_liquido NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_balances (id) VALUES ('historical'), ('monthly'), ('daily')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  rates JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint de Status Oficial
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'CREATED', 'AWAITING_PAYMENT', 'PAID', 'PREPARING', 'READY', 
    'SEARCHING_OPERATOR', 'DELIVERING', 'DELIVERED', 'RECEIVED', 
    'DISPUTE_OPEN', 'PIN_LOCKED', 'CANCELED', 'CANCELLED', 
    'REFUND_REQUESTED', 'REFUNDED', 'DELIVERY_FAILED', 'COMPLETED', 'PENDING'
  ));

-- ============================================================
-- 6. Funções RPC Seguras (SECURITY DEFINER)
-- ============================================================

-- 6.1. Gerador Seguro de PIN (Preserva o PIN de checkout e gera hash)
CREATE OR REPLACE FUNCTION public.generate_delivery_pin(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_pin TEXT;
  v_existing_pin TEXT;
  v_salt TEXT;
  v_hash TEXT;
BEGIN
  -- Se o pedido já possui delivery_pin válido cadastrado, preserva-o
  SELECT delivery_pin INTO v_existing_pin FROM public.orders WHERE id = p_order_id;
  
  IF v_existing_pin IS NOT NULL AND length(trim(v_existing_pin)) = 4 THEN
    v_raw_pin := trim(v_existing_pin);
  ELSE
    v_raw_pin := (floor(random() * 9000 + 1000))::TEXT;
  END IF;

  v_salt := gen_salt('bf', 8);
  v_hash := crypt(v_raw_pin, v_salt);

  UPDATE public.orders
  SET pin_hash = v_hash,
      delivery_pin = v_raw_pin,
      pin_attempts = 0,
      last_pin_attempt_at = NULL
  WHERE id = p_order_id;

  RETURN v_raw_pin;
END;
$$;

-- 6.2. Validação Rigorosa e Resiliente de PIN
CREATE OR REPLACE FUNCTION public.check_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_operator_id UUID DEFAULT NULL,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_pin TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_pin := trim(COALESCE(p_pin, ''));

  IF length(v_pin) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de 4 dígitos');
  END IF;

  -- 1. Buscar o pedido
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- 2. Verificar se já foi concluído
  IF v_order.status = 'RECEIVED' OR v_order.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Pedido já confirmado anteriormente');
  END IF;

  -- 3. Verificar se está bloqueado
  IF v_order.status = 'PIN_LOCKED' OR v_order.pin_attempts >= 5 THEN
    UPDATE public.orders SET status = 'PIN_LOCKED' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas. Contate o Administrador.');
  END IF;

  -- 4. Rate limit: 1 tentativa a cada 5 segundos
  IF v_order.last_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pin_attempt_at) < interval '5 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde 5 segundos.');
  END IF;

  -- 5. Comparação Resiliente: hash bcrypt ou texto plano
  IF v_order.pin_hash IS NOT NULL AND crypt(v_pin, v_order.pin_hash) = v_order.pin_hash THEN
    v_is_valid := TRUE;
  ELSIF v_order.delivery_pin IS NOT NULL AND trim(v_order.delivery_pin) = v_pin THEN
    v_is_valid := TRUE;
  END IF;

  -- 6. Gravar auditoria em pin_attempt_log
  INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
  VALUES (p_order_id, COALESCE(p_operator_id, auth.uid()), v_is_valid, p_device_info, v_now);

  -- 7. Tratamento do resultado
  IF v_is_valid THEN
    UPDATE public.orders
    SET status = 'RECEIVED',
        received_at = v_now,
        last_pin_attempt_at = v_now,
        pin_attempts = 0,
        asaas_transfer_status = 'READY_TO_RELEASE'
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
    VALUES (p_order_id, v_order.status, 'RECEIVED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'PIN validado com sucesso na entrega');

    UPDATE public.splits
    SET status = 'RELEASED', released_at = v_now
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'status', 'RECEIVED');
  ELSE
    IF (v_order.pin_attempts + 1) >= 5 THEN
      UPDATE public.orders
      SET pin_attempts = v_order.pin_attempts + 1,
          last_pin_attempt_at = v_now,
          status = 'PIN_LOCKED'
      WHERE id = p_order_id;

      INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
      VALUES (p_order_id, v_order.status, 'PIN_LOCKED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'Bloqueio automático após 5 tentativas de PIN');

      RETURN jsonb_build_object('success', false, 'error', 'PIN incorreto. Limite de 5 tentativas excedido. Pedido bloqueado.');
    ELSE
      UPDATE public.orders
      SET pin_attempts = v_order.pin_attempts + 1,
          last_pin_attempt_at = v_now
      WHERE id = p_order_id;

      RETURN jsonb_build_object('success', false, 'error', format('PIN incorreto. Tentativa %s de 5.', v_order.pin_attempts + 1));
    END IF;
  END IF;
END;
$$;

-- 6.3. Aceitação Atômica Condicional
CREATE OR REPLACE FUNCTION public.accept_order_atomic(
  p_order_id UUID,
  p_operator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_order public.orders%ROWTYPE;
BEGIN
  UPDATE public.orders
  SET status = 'DELIVERING',
      driver_id = p_operator_id,
      accepted_at = NOW()
  WHERE id = p_order_id
    AND status IN ('READY', 'SEARCHING_OPERATOR', 'PAID', 'PREPARING')
    AND driver_id IS NULL
  RETURNING * INTO v_updated_order;

  IF v_updated_order.id IS NOT NULL THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
    VALUES (p_order_id, 'READY', 'DELIVERING', p_operator_id, 'OPERATOR', 'Corrida aceita via escrita atômica');

    RETURN jsonb_build_object('success', true, 'order_id', v_updated_order.id, 'status', v_updated_order.status, 'driver_id', v_updated_order.driver_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Pedido já aceito por outro operador ou indisponível.');
  END IF;
END;
$$;

-- 6.4. Transição Segura de Status
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_to_status TEXT,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_order RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_current_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF p_to_status IN ('RECEIVED', 'REFUNDED') AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transição restrita ao sistema.');
  END IF;

  UPDATE public.orders
  SET status = p_to_status,
      paid_at = CASE WHEN p_to_status = 'PAID' THEN v_now ELSE paid_at END,
      accepted_at = CASE WHEN p_to_status = 'PREPARING' THEN v_now ELSE accepted_at END,
      ready_at = CASE WHEN p_to_status = 'READY' THEN v_now ELSE ready_at END,
      delivered_at = CASE WHEN p_to_status = 'DELIVERED' THEN v_now ELSE delivered_at END,
      cancelled_at = CASE WHEN p_to_status = 'CANCELED' OR p_to_status = 'CANCELLED' THEN v_now ELSE cancelled_at END,
      cancelled_by = CASE WHEN p_to_status = 'CANCELED' OR p_to_status = 'CANCELLED' THEN p_actor_id ELSE cancelled_by END,
      cancellation_reason = CASE WHEN p_to_status = 'CANCELED' OR p_to_status = 'CANCELLED' THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_current_order.status, p_to_status, p_actor_id, p_actor_role, p_reason, v_now);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'from_status', v_current_order.status, 'to_status', p_to_status);
END;
$$;

-- 6.5. Auditoria de Impressão Térmica
CREATE OR REPLACE FUNCTION public.log_order_print(
  p_order_id UUID,
  p_print_type TEXT,
  p_triggered_by TEXT DEFAULT 'SYSTEM',
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.print_log (order_id, print_type, triggered_by, success, printed_at)
  VALUES (p_order_id, p_print_type, p_triggered_by, p_success, NOW());

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Trigger de Atualização Automática de admin_balances em RECEIVED
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

-- 8. Configuração RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_attempt_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Policies RLS
DROP POLICY IF EXISTS "Allow authenticated select on users" ON public.users;
CREATE POLICY "Allow authenticated select on users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow self insert on users" ON public.users;
CREATE POLICY "Allow self insert on users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow self update on users" ON public.users;
CREATE POLICY "Allow self update on users" ON public.users FOR UPDATE USING (auth.role() = 'authenticated' AND (id = auth.uid() OR public.is_admin()));

-- Orders RLS
DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
CREATE POLICY "Orders Granular Select" ON public.orders FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() OR driver_id = auth.uid() OR (driver_id IS NULL AND status IN ('PAID', 'PREPARING', 'READY', 'SEARCHING_OPERATOR')) OR
    EXISTS (SELECT 1 FROM public.storefronts sf WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()) OR
    public.is_admin()
  )
);

DROP POLICY IF EXISTS "Orders Granular Insert" ON public.orders;
CREATE POLICY "Orders Granular Insert" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND buyer_id = auth.uid());

DROP POLICY IF EXISTS "Orders Granular Update" ON public.orders;
CREATE POLICY "Orders Granular Update" ON public.orders FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() OR driver_id = auth.uid() OR (driver_id IS NULL AND status IN ('PAID', 'PREPARING', 'READY', 'SEARCHING_OPERATOR')) OR
    EXISTS (SELECT 1 FROM public.storefronts sf WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()) OR
    public.is_admin()
  )
);

-- Storefronts, Products, Cities, Settings RLS
DROP POLICY IF EXISTS "Allow authenticated select on storefronts" ON public.storefronts;
CREATE POLICY "Allow authenticated select on storefronts" ON public.storefronts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow partner write on storefronts" ON public.storefronts;
CREATE POLICY "Allow partner write on storefronts" ON public.storefronts FOR ALL USING (auth.role() = 'authenticated' AND (partner_id = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "Allow authenticated select on products" ON public.products;
CREATE POLICY "Allow authenticated select on products" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow partner write on products" ON public.products;
CREATE POLICY "Allow partner write on products" ON public.products FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.storefronts sf WHERE sf.id = products.storefront_id AND (sf.partner_id = auth.uid() OR public.is_admin())));

DROP POLICY IF EXISTS "Allow authenticated select on cities" ON public.cities;
CREATE POLICY "Allow authenticated select on cities" ON public.cities FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admin write on cities" ON public.cities;
CREATE POLICY "Allow admin write on cities" ON public.cities FOR ALL USING (auth.role() = 'authenticated' AND public.is_admin());

DROP POLICY IF EXISTS "Allow authenticated select on platform_settings" ON public.platform_settings;
CREATE POLICY "Allow authenticated select on platform_settings" ON public.platform_settings FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow admin write on platform_settings" ON public.platform_settings;
CREATE POLICY "Allow admin write on platform_settings" ON public.platform_settings FOR ALL USING (auth.role() = 'authenticated' AND public.is_admin());

DROP POLICY IF EXISTS "Allow authenticated select on admin_balances" ON public.admin_balances;
CREATE POLICY "Allow authenticated select on admin_balances" ON public.admin_balances FOR SELECT USING (auth.role() = 'authenticated' AND public.is_admin());
DROP POLICY IF EXISTS "Allow admin write on admin_balances" ON public.admin_balances;
CREATE POLICY "Allow admin write on admin_balances" ON public.admin_balances FOR ALL USING (auth.role() = 'authenticated' AND public.is_admin());

-- Order History & Logs RLS
DROP POLICY IF EXISTS "Allow authenticated select on history" ON public.order_status_history;
CREATE POLICY "Allow authenticated select on history" ON public.order_status_history FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated select on print_log" ON public.print_log;
CREATE POLICY "Allow authenticated select on print_log" ON public.print_log FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated select on disputes" ON public.disputes;
CREATE POLICY "Allow authenticated select on disputes" ON public.disputes FOR SELECT USING (auth.role() = 'authenticated');

-- 9. Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'storefronts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.storefronts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'platform_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_status_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'print_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_log;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disputes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.storefronts REPLICA IDENTITY FULL;
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
ALTER TABLE public.order_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.print_log REPLICA IDENTITY FULL;
ALTER TABLE public.disputes REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
