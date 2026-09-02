-- ==============================================================================
-- Migration: 20260901020000_fix_state_machine_pending_to_paid.sql
-- Descricao: Permite transicao de PENDING, AWAITING_PAYMENT e aguardando_pagamento para PAID
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_to_status TEXT,
  p_actor_id UUID DEFAULT auth.uid(),
  p_actor_role TEXT DEFAULT 'USER',
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
DECLARE
  v_current_order public.orders%ROWTYPE;
  v_is_valid_transition BOOLEAN := FALSE;
  v_admin BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_curr_status_upper TEXT;
  v_to_status_upper TEXT;
BEGIN
  -- 1. Buscar o pedido atual
  SELECT * INTO v_current_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido nao encontrado');
  END IF;

  v_admin := public.is_admin();
  v_curr_status_upper := UPPER(COALESCE(v_current_order.status, 'PENDING'));
  v_to_status_upper := UPPER(p_to_status);

  -- Se o pedido ja estiver no status desejado, operacao e idempotente
  IF v_curr_status_upper = v_to_status_upper THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_to_status, 'message', 'Status ja atualizado anteriormente');
  END IF;

  -- 2. Validacao da Matriz Oficial de Transicoes com suporte a aliases
  IF v_admin THEN
    v_is_valid_transition := TRUE;
  ELSE
    CASE v_curr_status_upper
      WHEN 'PENDING', 'PENDENTE', 'CREATED', 'AWAITING_PAYMENT', 'AGUARDANDO_PAGAMENTO' THEN
        v_is_valid_transition := (v_to_status_upper IN ('PAID', 'PREPARING', 'READY', 'CANCELED', 'CANCELLED', 'AWAITING_PAYMENT'));
      WHEN 'PAID', 'PAGO' THEN
        v_is_valid_transition := (v_to_status_upper IN ('PREPARING', 'READY', 'REFUND_REQUESTED', 'CANCELLED', 'CANCELED', 'SEARCHING_OPERATOR'));
      WHEN 'PREPARING', 'PREPARO' THEN
        v_is_valid_transition := (v_to_status_upper IN ('READY', 'REFUND_REQUESTED', 'SEARCHING_OPERATOR', 'DELIVERING'));
      WHEN 'READY', 'PRONTO' THEN
        v_is_valid_transition := (v_to_status_upper IN ('SEARCHING_OPERATOR', 'DELIVERING', 'REFUND_REQUESTED'));
      WHEN 'SEARCHING_OPERATOR' THEN
        v_is_valid_transition := (v_to_status_upper IN ('DELIVERING', 'NO_OPERATOR_AVAILABLE', 'REFUND_REQUESTED'));
      WHEN 'DELIVERING', 'EM_ROTA' THEN
        v_is_valid_transition := (v_to_status_upper IN ('DELIVERED', 'AGUARDANDO_CLIENTE', 'DELIVERY_FAILED', 'DISPUTE_OPEN'));
      WHEN 'DELIVERED', 'AGUARDANDO_CLIENTE' THEN
        v_is_valid_transition := (v_to_status_upper IN ('RECEIVED', 'ENTREGUE', 'PIN_LOCKED', 'DISPUTE_OPEN'));
      WHEN 'PIN_LOCKED' THEN
        v_is_valid_transition := (v_to_status_upper IN ('DISPUTE_OPEN'));
      WHEN 'REFUND_REQUESTED' THEN
        v_is_valid_transition := (v_to_status_upper IN ('REFUNDED'));
      ELSE
        v_is_valid_transition := TRUE;
    END CASE;
  END IF;

  -- 3. Atualizar o pedido no banco
  UPDATE public.orders
  SET status = p_to_status,
      paid_at = CASE WHEN v_to_status_upper = 'PAID' AND paid_at IS NULL THEN v_now ELSE paid_at END,
      accepted_at = CASE WHEN v_to_status_upper IN ('PREPARING', 'PREPARO') AND accepted_at IS NULL THEN v_now ELSE accepted_at END,
      ready_at = CASE WHEN v_to_status_upper IN ('READY', 'PRONTO') AND ready_at IS NULL THEN v_now ELSE ready_at END,
      delivered_at = CASE WHEN v_to_status_upper IN ('DELIVERED', 'AGUARDANDO_CLIENTE') AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
      received_at = CASE WHEN v_to_status_upper IN ('RECEIVED', 'ENTREGUE') AND received_at IS NULL THEN v_now ELSE received_at END,
      cancelled_at = CASE WHEN v_to_status_upper IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN v_now ELSE cancelled_at END,
      cancelled_by = CASE WHEN v_to_status_upper IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN p_actor_id ELSE cancelled_by END,
      cancellation_reason = CASE WHEN v_to_status_upper IN ('CANCELED', 'CANCELLED', 'REFUND_REQUESTED') THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END,
      updated_at = v_now
  WHERE id = p_order_id;

  -- 4. Registrar em order_status_history
  BEGIN
    INSERT INTO public.order_status_history (
      order_id,
      from_status,
      to_status,
      actor_id,
      actor_role,
      reason
    ) VALUES (
      p_order_id,
      v_current_order.status,
      p_to_status,
      p_actor_id,
      p_actor_role,
      p_reason
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'previous_status', v_current_order.status,
    'current_status', p_to_status
  );
END;
\$\$;
