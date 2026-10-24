-- ==============================================================================
-- AÇAÍFOOD R21 — accept_order_atomic exige conta Asaas aprovada do entregador
-- Timestamp: 20261025010000
-- Base: 20261003193000 (mesmo corpo + checagem de asaas_account_status/asaas_wallet_id).
-- Compatível com o app no ar. Reversão: supabase/rollback/20261025010000_r21_accept_requires_asaas_approved_rollback.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_order_atomic(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT := '';
  v_caller_veiculo TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_order_type TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT 
      lower(COALESCE(role, '')), 
      lower(COALESCE(vehicle_type, '')), 
      (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin')
    INTO v_caller_role, v_caller_veiculo, v_is_admin
    FROM public.users WHERE id = v_caller_id;

    IF NOT v_is_admin AND v_caller_role NOT IN ('motorista', 'motoboy', 'caminhao', 'courier', 'driver') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas motoristas cadastrados e autorizados podem aceitar corridas');
    END IF;

    -- R21: a corrida é paga na conta Asaas do entregador; sem conta aprovada não aceita
    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v_caller_id
        AND upper(COALESCE(u.asaas_account_status, '')) = 'APPROVED'
        AND COALESCE(trim(u.asaas_wallet_id), '') <> ''
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sua conta Asaas ainda não está aprovada. Envie os documentos em "Minha conta Asaas" para aceitar corridas.');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou não autenticada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    IF v_order.driver_id = v_caller_id THEN
      RETURN jsonb_build_object('success', true, 'message', 'Você já aceitou este pedido', 'driver_id', v_caller_id);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi aceito por outro motorista');
    END IF;
  END IF;

  -- Validação de status: aceitar somente READY, ready ou SEARCHING_OPERATOR (quando a loja/fornecedor já chamou a moto/caminhão)
  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido não está pronto para despacho de entrega (Status atual: %s)', v_order.status));
  END IF;

  -- Validação de compatibilidade de veículo
  v_order_type := upper(COALESCE(v_order.order_type, 'B2C'));

  IF NOT v_is_admin THEN
    IF v_order_type = 'B2C' THEN
      -- B2C é exclusivo para moto / motoboy
      IF v_caller_role IN ('caminhao', 'caminhoneiro') OR (v_caller_veiculo LIKE '%caminh%' OR v_caller_veiculo LIKE '%truck%') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Corridas B2C são exclusivas para entregadores com motocicleta');
      END IF;
    ELSIF v_order_type IN ('B2B', 'COLETA') THEN
      -- B2B e Coleta são exclusivos para caminhão / caçamba
      IF v_caller_role = 'motoboy' OR (v_caller_veiculo LIKE '%moto%' AND v_caller_veiculo NOT LIKE '%truck%') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cargas B2B e Coletas de Caroço exigem caminhão ou caçamba');
      END IF;
    END IF;
  END IF;

  UPDATE public.orders
  SET driver_id = v_caller_id,
      status = 'DELIVERING'
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, 'DELIVERING', v_caller_id, 'MOTORISTA', 'Corrida aceita no radar pelo motorista', v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'driver_id', v_caller_id,
    'status', 'DELIVERING',
    'message', 'Corrida aceita com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order_atomic(UUID) TO service_role;
