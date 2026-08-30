-- ==========================================================
-- COMPLETE AUDIT & SECURITY CORE MIGRATION — AÇAÍFOOD
-- Regras de Negócio (Parte A) e Regras Técnicas (Parte B)
-- ==========================================================

-- 0. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Criação / Atualização das Tabelas Core

-- 1.1. Tabela Users
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

-- 1.2. Tabela Storefronts & Products
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

-- 1.3. Tabela Orders
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

-- 1.4. Tabela order_status_history (Append-Only para Auditoria Completa)
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

-- 1.5. Tabela order_items (Snapshot Imutável dos Itens no Momento do Pedido)
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

-- 1.6. Tabela splits (Split Financeiro em Centavos Inteiros)
CREATE TABLE IF NOT EXISTS public.splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL, -- 'STORE', 'SUPPLIER', 'DRIVER', 'PLATFORM'
  recipient_id UUID REFERENCES public.users(id),
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RELEASED', 'REVERSED'
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7. Tabela pin_attempt_log (Auditoria de Tentativas de PIN)
CREATE TABLE IF NOT EXISTS public.pin_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id),
  success BOOLEAN NOT NULL,
  ip_device TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.8. Tabela print_log (Auditoria de Impressões Térmicas e Manuais)
CREATE TABLE IF NOT EXISTS public.print_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  print_type TEXT NOT NULL, -- 'PREPARO', 'ENTREGA', 'ENTREGA_ATUALIZADO'
  triggered_by TEXT NOT NULL, -- 'SYSTEM', 'MANUAL'
  success BOOLEAN NOT NULL DEFAULT TRUE,
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9. Tabela disputes (Mediação e Resolução de Disputas pelo Admin)
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES public.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'
  resolution TEXT,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.10. Tabela notification_queue (Fila Assíncrona de Notificações Push)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.11. Constraint de Status dos Pedidos (Máquina de Estados Oficial)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'CREATED', 
    'AWAITING_PAYMENT', 
    'PAID', 
    'PREPARING', 
    'READY', 
    'SEARCHING_OPERATOR', 
    'DELIVERING', 
    'DELIVERED', 
    'RECEIVED', 
    'DISPUTE_OPEN', 
    'PIN_LOCKED', 
    'CANCELED', 
    'CANCELLED', -- Compatibilidade legada
    'REFUND_REQUESTED', 
    'REFUNDED',
    'DELIVERY_FAILED',
    'COMPLETED',
    'PENDING'
  ));

-- ============================================================
-- 2. Índices de Alta Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_storefront_id ON public.orders(seller_storefront_id);
CREATE INDEX IF NOT EXISTS idx_orders_radar ON public.orders(order_type, status) WHERE driver_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_splits_order ON public.splits(order_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempt_log_order ON public.pin_attempt_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_log_order ON public.print_log(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);

-- ============================================================
-- 3. Funções Seguras (SECURITY DEFINER)
-- ============================================================

-- 3.1. Helper Admin
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

-- 3.2. Gerador Seguro de PIN (Executado quando o pedido atinge PAID)
CREATE OR REPLACE FUNCTION public.generate_delivery_pin(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_pin TEXT;
  v_salt TEXT;
  v_hash TEXT;
BEGIN
  -- Gera PIN numérico de 4 dígitos (1000 a 9999)
  v_raw_pin := (floor(random() * 9000 + 1000))::TEXT;
  v_salt := gen_salt('bf', 8);
  v_hash := crypt(v_raw_pin, v_salt);

  UPDATE public.orders
  SET pin_hash = v_hash,
      delivery_pin = v_raw_pin, -- Mantido para exibição exclusiva ao comprador
      pin_attempts = 0,
      last_pin_attempt_at = NULL
  WHERE id = p_order_id;

  RETURN v_raw_pin;
END;
$$;

-- 3.3. Validação Rigorosa de PIN com Rate-Limit, Bloqueio e Liberação de Repasse
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
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Buscar o pedido
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- 2. Verificar se o pedido já está finalizado
  IF v_order.status = 'RECEIVED' OR v_order.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Pedido já confirmado anteriormente');
  END IF;

  -- 3. Verificar se está bloqueado por tentativas
  IF v_order.status = 'PIN_LOCKED' OR v_order.pin_attempts >= 5 THEN
    UPDATE public.orders SET status = 'PIN_LOCKED' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas. Contate o Administrador.');
  END IF;

  -- 4. Rate limit: 1 tentativa a cada 5 segundos
  IF v_order.last_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pin_attempt_at) < interval '5 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde 5 segundos.');
  END IF;

  -- 5. Comparar PIN (via hash criptográfico ou fallback direto)
  IF v_order.pin_hash IS NOT NULL THEN
    v_is_valid := (crypt(p_pin, v_order.pin_hash) = v_order.pin_hash);
  ELSIF v_order.delivery_pin IS NOT NULL THEN
    v_is_valid := (v_order.delivery_pin = p_pin);
  END IF;

  -- 6. Gravar auditoria em pin_attempt_log
  INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
  VALUES (p_order_id, COALESCE(p_operator_id, auth.uid()), v_is_valid, p_device_info, v_now);

  -- 7. Tratamento do resultado
  IF v_is_valid THEN
    -- Sucesso: transição atômica para RECEIVED
    UPDATE public.orders
    SET status = 'RECEIVED',
        received_at = v_now,
        last_pin_attempt_at = v_now,
        asaas_transfer_status = 'READY_TO_RELEASE'
    WHERE id = p_order_id;

    -- Registrar no histórico
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
    VALUES (p_order_id, v_order.status, 'RECEIVED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'PIN validado com sucesso na entrega');

    -- Liberar splits
    UPDATE public.splits
    SET status = 'RELEASED', released_at = v_now
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'status', 'RECEIVED');
  ELSE
    -- Falha: incrementa tentativas
    IF (v_order.pin_attempts + 1) >= 5 THEN
      UPDATE public.orders
      SET pin_attempts = v_order.pin_attempts + 1,
          last_pin_attempt_at = v_now,
          status = 'PIN_LOCKED'
      WHERE id = p_order_id;

      INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
      VALUES (p_order_id, v_order.status, 'PIN_LOCKED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'Bloqueio automático após 5 tentativas inválidas de PIN');

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

-- 3.4. Aceitação Atômica Condicional de Corridas / Fretes / Serviços
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
  -- Escrita atômica condicional: só atualiza se estiver disponível e sem operador
  UPDATE public.orders
  SET status = 'DELIVERING',
      driver_id = p_operator_id,
      accepted_at = NOW()
  WHERE id = p_order_id
    AND status IN ('READY', 'SEARCHING_OPERATOR', 'PAID', 'PREPARING')
    AND driver_id IS NULL
  RETURNING * INTO v_updated_order;

  IF v_updated_order.id IS NOT NULL THEN
    -- Registrar histórico
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
    VALUES (p_order_id, 'READY', 'DELIVERING', p_operator_id, 'OPERATOR', 'Corrida aceita com sucesso via escrita atômica');

    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_updated_order.id,
      'status', v_updated_order.status,
      'driver_id', v_updated_order.driver_id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este pedido já foi aceito por outro operador ou não está mais disponível no radar.'
    );
  END IF;
END;
$$;

-- 3.5. Transição Segura de Status com Auditoria
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

  -- Segurança: Bloquear alteração direta para RECEIVED ou REFUNDED por usuários comuns
  IF p_to_status IN ('RECEIVED', 'REFUNDED') AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transição para este status é restrita ao sistema após validação por PIN.');
  END IF;

  -- Atualizar status
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

  -- Gravar histórico
  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_current_order.status, p_to_status, p_actor_id, p_actor_role, p_reason, v_now);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'from_status', v_current_order.status, 'to_status', p_to_status);
END;
$$;

-- 3.6. Registro de Impressão Térmica
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

-- ============================================================
-- 4. Habilitação de Realtime para Novas Tabelas
-- ============================================================
DO $$
BEGIN
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

ALTER TABLE public.order_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.print_log REPLICA IDENTITY FULL;
ALTER TABLE public.disputes REPLICA IDENTITY FULL;

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
