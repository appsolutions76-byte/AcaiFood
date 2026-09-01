-- ==========================================================
-- AÇAÍFOOD — MIGRATION DE SEGURANÇA, ESTADOS & LGPD (P0 & P1)
-- Versão 20260901000000
-- ==========================================================

-- 1. Ativação de RLS e Políticas Granulares para Tabelas Core de Auditoria

-- 1.1. Tabela splits
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Splits Granular Select" ON public.splits;
DROP POLICY IF EXISTS "Splits Granular Insert" ON public.splits;
DROP POLICY IF EXISTS "Splits Granular Update" ON public.splits;
DROP POLICY IF EXISTS "Splits Admin All" ON public.splits;

CREATE POLICY "Splits Granular Select" ON public.splits
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = splits.order_id 
        AND (o.buyer_id = auth.uid() OR o.driver_id = auth.uid())
    )
    OR public.is_admin()
  )
);

CREATE POLICY "Splits Admin All" ON public.splits
FOR ALL USING (
  auth.role() = 'authenticated' AND public.is_admin()
);

-- 1.2. Tabela order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "History Granular Select" ON public.order_status_history;
DROP POLICY IF EXISTS "History Granular Insert" ON public.order_status_history;

CREATE POLICY "History Granular Select" ON public.order_status_history
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_status_history.order_id 
        AND (o.buyer_id = auth.uid() OR o.driver_id = auth.uid())
    )
    OR public.is_admin()
  )
);

CREATE POLICY "History Granular Insert" ON public.order_status_history
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 1.3. Tabela order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order Items Select" ON public.order_items;
DROP POLICY IF EXISTS "Order Items Insert" ON public.order_items;

CREATE POLICY "Order Items Select" ON public.order_items
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_items.order_id 
        AND (o.buyer_id = auth.uid() OR o.driver_id = auth.uid())
    )
    OR public.is_admin()
  )
);

CREATE POLICY "Order Items Insert" ON public.order_items
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 1.4. Tabela pin_attempt_log
ALTER TABLE public.pin_attempt_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pin Log Admin Select" ON public.pin_attempt_log;
DROP POLICY IF EXISTS "Pin Log Insert" ON public.pin_attempt_log;

CREATE POLICY "Pin Log Admin Select" ON public.pin_attempt_log
FOR SELECT USING (
  auth.role() = 'authenticated' AND (actor_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Pin Log Insert" ON public.pin_attempt_log
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 1.5. Tabela print_log
ALTER TABLE public.print_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Print Log Select" ON public.print_log;
DROP POLICY IF EXISTS "Print Log Insert" ON public.print_log;

CREATE POLICY "Print Log Select" ON public.print_log
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
      WHERE o.id = print_log.order_id AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
);

CREATE POLICY "Print Log Insert" ON public.print_log
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 1.6. Tabela disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Disputes Select" ON public.disputes;
DROP POLICY IF EXISTS "Disputes Insert" ON public.disputes;
DROP POLICY IF EXISTS "Disputes Update" ON public.disputes;

CREATE POLICY "Disputes Select" ON public.disputes
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    opened_by = auth.uid()
    OR resolved_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = disputes.order_id 
        AND (o.buyer_id = auth.uid() OR o.driver_id = auth.uid())
    )
    OR public.is_admin()
  )
);

CREATE POLICY "Disputes Insert" ON public.disputes
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND opened_by = auth.uid()
);

CREATE POLICY "Disputes Update" ON public.disputes
FOR UPDATE USING (
  auth.role() = 'authenticated' AND public.is_admin()
);

-- 1.7. Tabela notification_queue
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notification Select" ON public.notification_queue;
DROP POLICY IF EXISTS "Notification Insert" ON public.notification_queue;

CREATE POLICY "Notification Select" ON public.notification_queue
FOR SELECT USING (
  auth.role() = 'authenticated' AND (recipient_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Notification Insert" ON public.notification_queue
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- ============================================================
-- 2. Máquina de Estados Estrita (PL/pgSQL RPC)
-- ============================================================
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
SET search_path = public, extensions
AS 
DECLARE
  v_current_order RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_is_valid_transition BOOLEAN := FALSE;
  v_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Buscar o pedido atual
  SELECT * INTO v_current_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  v_admin := public.is_admin();

  -- Se o pedido já estiver no status desejado, operação é idempotente
  IF v_current_order.status = p_to_status THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_to_status, 'message', 'Status já atualizado anteriormente');
  END IF;

  -- 2. Validação da Matriz Oficial de Transições
  IF v_admin THEN
    v_is_valid_transition := TRUE;
  ELSE
    CASE v_current_order.status
      WHEN 'CREATED' THEN
        v_is_valid_transition := (p_to_status IN ('AWAITING_PAYMENT', 'CANCELED', 'CANCELLED', 'PAID'));
      WHEN 'AWAITING_PAYMENT' THEN
        v_is_valid_transition := (p_to_status IN ('PAID', 'CANCELED', 'CANCELLED'));
      WHEN 'PAID' THEN
        v_is_valid_transition := (p_to_status IN ('PREPARING', 'READY', 'REFUND_REQUESTED'));
      WHEN 'PREPARING' THEN
        v_is_valid_transition := (p_to_status IN ('READY', 'REFUND_REQUESTED', 'SEARCHING_OPERATOR'));
      WHEN 'READY' THEN
        v_is_valid_transition := (p_to_status IN ('SEARCHING_OPERATOR', 'DELIVERING', 'REFUND_REQUESTED'));
      WHEN 'SEARCHING_OPERATOR' THEN
        v_is_valid_transition := (p_to_status IN ('DELIVERING', 'NO_OPERATOR_AVAILABLE', 'REFUND_REQUESTED'));
      WHEN 'DELIVERING' THEN
        v_is_valid_transition := (p_to_status IN ('DELIVERED', 'DELIVERY_FAILED', 'DISPUTE_OPEN'));
      WHEN 'DELIVERED' THEN
        -- RECEIVED só pode ser atingido via check_delivery_pin (a menos que seja admin)
        v_is_valid_transition := (p_to_status IN ('PIN_LOCKED', 'DISPUTE_OPEN'));
      WHEN 'PIN_LOCKED' THEN
        v_is_valid_transition := (p_to_status IN ('DISPUTE_OPEN'));
      WHEN 'REFUND_REQUESTED' THEN
        v_is_valid_transition := (p_to_status IN ('REFUNDED'));
      ELSE
        v_is_valid_transition := FALSE;
    END CASE;
  END IF;

  -- Bloquear alteração direta para RECEIVED fora do fluxo de PIN
  IF p_to_status = 'RECEIVED' AND NOT v_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status RECEIVED exige validação de PIN de 4 dígitos via check_delivery_pin.');
  END IF;

  -- Bloquear alteração direta para REFUNDED fora do webhook Asaas ou Admin
  IF p_to_status = 'REFUNDED' AND NOT v_admin AND p_actor_role NOT LIKE '%WEBHOOK%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status REFUNDED é restrito à confirmação do gateway de pagamento.');
  END IF;

  IF NOT v_is_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transição inválida de %s para %s. Operação rejeitada pela máquina de estados.', v_current_order.status, p_to_status)
    );
  END IF;

  -- 3. Atualizar o pedido no banco
  UPDATE public.orders
  SET status = p_to_status,
      paid_at = CASE WHEN p_to_status = 'PAID' THEN v_now ELSE paid_at END,
      accepted_at = CASE WHEN p_to_status = 'PREPARING' THEN v_now ELSE accepted_at END,
      ready_at = CASE WHEN p_to_status = 'READY' THEN v_now ELSE ready_at END,
      delivered_at = CASE WHEN p_to_status = 'DELIVERED' THEN v_now ELSE delivered_at END,
      cancelled_at = CASE WHEN p_to_status IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN v_now ELSE cancelled_at END,
      cancelled_by = CASE WHEN p_to_status IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN p_actor_id ELSE cancelled_by END,
      cancellation_reason = CASE WHEN p_to_status IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END
  WHERE id = p_order_id;

  -- 4. Registrar histórico imutável
  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_current_order.status, p_to_status, p_actor_id, p_actor_role, p_reason, v_now);

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', p_order_id, 
    'from_status', v_current_order.status, 
    'to_status', p_to_status
  );
END;
;

-- ============================================================
-- 3. Função de Anonimização LGPD de Geolocalização em 24h
-- ============================================================
CREATE OR REPLACE FUNCTION public.anonymize_order_locations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  v_affected_count INT := 0;
BEGIN
  -- Anonimiza pedidos concluídos, cancelados ou estornados há mais de 24 horas
  WITH updated AS (
    UPDATE public.orders
    SET delivery_lat = NULL,
        delivery_lng = NULL,
        delivery_address = '[DADO ANONIMIZADO CONFORME LGPD]',
        delivery_reference = NULL
    WHERE status IN ('RECEIVED', 'COMPLETED', 'CANCELED', 'CANCELLED', 'REFUNDED')
      AND COALESCE(received_at, cancelled_at, created_at) < (NOW() - INTERVAL '24 hours')
      AND (delivery_lat IS NOT NULL OR delivery_lng IS NOT NULL OR delivery_address != '[DADO ANONIMIZADO CONFORME LGPD]')
    RETURNING id
  )
  SELECT count(*) INTO v_affected_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'anonymized_orders_count', v_affected_count,
    'timestamp', NOW()
  );
END;
;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
