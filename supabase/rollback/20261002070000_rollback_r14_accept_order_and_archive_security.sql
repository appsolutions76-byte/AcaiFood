-- ==============================================================================
-- AÇAÍFOOD — ROLLBACK R14: Reverter accept_order_atomic e advance_order_status
-- Timestamp: 20261002070000
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_order_atomic(
  p_order_id UUID,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_effective_driver UUID;
  v_order RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
    v_effective_driver := COALESCE(p_operator_id, v_caller_id);
  ELSE
    v_effective_driver := v_caller_id;
    SELECT role, COALESCE(is_admin, false) INTO v_caller_role, v_is_admin
    FROM public.users WHERE id = v_caller_id;
    
    IF NOT v_is_admin AND lower(COALESCE(v_caller_role, '')) NOT IN ('motorista', 'motoboy', 'caminhao', 'courier', 'driver') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas motoristas cadastrados podem aceitar corridas');
    END IF;
  END IF;

  IF v_effective_driver IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificação do motorista ausente');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    IF v_order.driver_id = v_effective_driver THEN
      RETURN jsonb_build_object('success', true, 'message', 'Você já aceitou este pedido', 'driver_id', v_effective_driver);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi aceito por outro motorista');
    END IF;
  END IF;

  IF v_order.status NOT IN ('READY', 'PAID', 'PREPARING', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido não está disponível para entrega (Status: %s)', v_order.status));
  END IF;

  UPDATE public.orders
  SET driver_id = v_effective_driver,
      status = 'DELIVERING'
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, 'DELIVERING', v_effective_driver, 'MOTORISTA', 'Corrida aceita pelo motorista', v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'driver_id', v_effective_driver,
    'status', 'DELIVERING',
    'message', 'Corrida aceita com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order_atomic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order_atomic(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
