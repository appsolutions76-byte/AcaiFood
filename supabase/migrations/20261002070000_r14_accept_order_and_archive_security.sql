-- ==============================================================================
-- AÇAÍFOOD — R14: Aceite Atômico de Corrida e Arquivamento Seguro (Item 1.2)
-- Timestamp: 20261002070000
--
-- O que faz:
--  1. accept_order_atomic(p_order_id UUID):
--     - Remove p_operator_id (identidade estrita do JWT auth.uid()).
--     - Aceita APENAS status 'READY' ou 'SEARCHING_OPERATOR'.
--     - Exige veículo compatível:
--         * B2C -> Motoboy / Moto
--         * B2B e COLETA -> Caminhão / Caçamba
--  2. advance_order_status('archive_driver' / 'pagar_motorista'):
--     - Restrito EXCLUSIVAMENTE a Administradores (is_admin ou service_role).
--     - Permitido apenas a partir de 'RECEIVED' (bloqueia arquivamento em DELIVERED sem PIN).
-- ==============================================================================

-- 1. Dropar todas as assinaturas antigas de accept_order_atomic
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_order_atomic'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END $$;

-- 2. Nova RPC accept_order_atomic estrita e segura
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
      lower(COALESCE(veiculo, '')), 
      (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin')
    INTO v_caller_role, v_caller_veiculo, v_is_admin
    FROM public.users WHERE id = v_caller_id;

    IF NOT v_is_admin AND v_caller_role NOT IN ('motorista', 'motoboy', 'caminhao', 'courier', 'driver') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas motoristas cadastrados e autorizados podem aceitar corridas');
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

  -- Validação de status: aceitar somente READY ou SEARCHING_OPERATOR
  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido não está pronto para despacho de entrega (Status atual: %s)', v_order.status));
  END IF;

  -- Validação de compatibilidade de veículo
  v_order_type := upper(COALESCE(v_order.order_type, 'B2C'));

  IF NOT v_is_admin THEN
    IF v_order_type = 'B2C' THEN
      -- B2C é exclusivo para moto / motoboy
      IF v_caller_role = 'caminhao' OR (v_caller_veiculo LIKE '%caminh%' AND v_caller_veiculo NOT LIKE '%moto%') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Corridas B2C são exclusivas para entregadores com motocicleta');
      END IF;
    ELSIF v_order_type IN ('B2B', 'COLETA') THEN
      -- B2B e Coleta são exclusivos para caminhão / caçamba
      IF v_caller_role = 'motoboy' OR (v_caller_veiculo LIKE '%moto%' AND v_caller_veiculo NOT LIKE '%caminh%' AND v_caller_veiculo NOT LIKE '%caçamb%') THEN
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


-- 3. Atualizar advance_order_status para blindar 'archive_driver'
CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
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
  v_order RECORD;
  v_store RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_status TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
    v_caller_role := 'admin';
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT role, (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_caller_role, v_is_admin
    FROM public.users WHERE id = v_caller_id;
    v_caller_role := lower(COALESCE(v_caller_role, 'cliente'));
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou não autenticada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.seller_storefront_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.storefronts WHERE id = v_order.seller_storefront_id;
  END IF;

  CASE lower(trim(p_action))
    WHEN 'accept', 'iniciar_preparo' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode aceitar o pedido');
      END IF;
      IF v_order.status NOT IN ('PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível iniciar o preparo de pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'PREPARING';
      UPDATE public.orders SET status = v_new_status, accepted_at = v_now WHERE id = p_order_id;

    WHEN 'ready', 'pronto' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode marcar o pedido como pronto');
      END IF;
      IF v_order.status NOT IN ('PREPARING', 'preparing', 'PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível marcar como pronto pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'READY';
      UPDATE public.orders SET status = v_new_status, ready_at = v_now WHERE id = p_order_id;

    WHEN 'pickup', 'retirada' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode marcar a retirada do pedido');
      END IF;
      IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível retirar pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERING';
      UPDATE public.orders SET status = v_new_status, picked_up_at = v_now WHERE id = p_order_id;

    WHEN 'delivered_by_driver', 'entregue_motorista' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode atualizar a chegada no destino');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'IN_TRANSIT', 'in_transit') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Status inválido para entrega: %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERED';
      UPDATE public.orders SET status = v_new_status, delivered_at = v_now WHERE id = p_order_id;

    WHEN 'cancel_unpaid', 'cancelar_pendente' THEN
      IF NOT v_is_admin AND v_order.buyer_id != v_caller_id AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para cancelar este pedido');
      END IF;
      IF v_order.status NOT IN ('PENDING', 'pending', 'AWAITING_PAYMENT') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cancelamento direto permitido apenas para pedidos pendentes de pagamento');
      END IF;
      v_new_status := 'CANCELLED';
      UPDATE public.orders
      SET status = v_new_status,
          cancelled_at = v_now,
          cancelled_by = v_caller_id,
          cancellation_reason = COALESCE(p_reason, 'Cancelado pelo usuário antes do pagamento')
      WHERE id = p_order_id;

    WHEN 'archive_driver', 'pagar_motorista' THEN
      -- Restrito estritamente ao Administrador
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Arquivamento de corrida restrito exclusivamente a administradores');
      END IF;
      -- Exige que o pedido já esteja RECEIVED (entregue com PIN validado)
      IF v_order.status NOT IN ('RECEIVED', 'received', 'COMPLETED') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser arquivado (deve estar RECEIVED)', v_order.status));
      END IF;
      v_new_status := 'COMPLETED';
      UPDATE public.orders SET status = v_new_status, payout_driver_done = true WHERE id = p_order_id;

    WHEN 'force_receive', 'forcar_baixa' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Baixa forçada é restrita a administradores');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'DELIVERED', 'delivered', 'PIN_LOCKED', 'pin_locked') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Baixa forçada não permitida a partir do status %s', v_order.status));
      END IF;
      IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Justificativa de no mínimo 10 caracteres é obrigatória para baixa forçada');
      END IF;
      v_new_status := 'RECEIVED';

      UPDATE public.orders
      SET status = v_new_status,
          received_at = v_now,
          cancellation_reason = 'Baixa forçada admin: ' || p_reason
      WHERE id = p_order_id;

      INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before_state, after_state)
      VALUES (
        v_caller_id,
        'ORDER_FORCE_RECEIVE',
        'ORDER',
        p_order_id::text,
        jsonb_build_object('status', v_order.status, 'reason', p_reason),
        jsonb_build_object('status', 'RECEIVED')
      );

    ELSE
      RETURN jsonb_build_object('success', false, 'error', format('Ação desconhecida: %s', p_action));
  END CASE;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, v_new_status, v_caller_id, v_caller_role, p_reason, v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'from_status', v_order.status,
    'status', v_new_status,
    'message', 'Status do pedido atualizado com sucesso'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
