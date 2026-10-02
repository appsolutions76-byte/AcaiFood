-- ==========================================================
-- AÇAÍFOOD — FASE 2: RPCS DE TRANSIÇÃO DE PEDIDOS & SEGURANÇA DE PIN
-- Timestamp: 20261002000000
-- Prompt R11 - Fase 2A & 2B
-- ==========================================================

-- 1. RPC para transição controlada e auditada de status de pedidos
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
  -- Se for chamado por service_role (backend/cron), autoriza como admin
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
    v_caller_role := 'admin';
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT role, COALESCE(is_admin, false) INTO v_caller_role, v_is_admin
    FROM public.users WHERE id = v_caller_id;
    v_caller_role := lower(COALESCE(v_caller_role, 'cliente'));
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou não autenticada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- Buscar dados da loja
  IF v_order.seller_storefront_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.storefronts WHERE id = v_order.seller_storefront_id;
  END IF;

  CASE lower(trim(p_action))
    -- Ação 1: Loja aceita pedido pago e inicia preparo
    WHEN 'accept', 'iniciar_preparo' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode aceitar o pedido');
      END IF;
      IF v_order.status NOT IN ('PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível iniciar o preparo de um pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'PREPARING';

      UPDATE public.orders
      SET status = v_new_status, accepted_at = v_now
      WHERE id = p_order_id;

    -- Ação 2: Loja conclui preparo e coloca como pronto
    WHEN 'ready', 'pronto' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode marcar o pedido como pronto');
      END IF;
      IF v_order.status NOT IN ('PREPARING', 'preparing', 'PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível marcar como pronto um pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'READY';

      UPDATE public.orders
      SET status = v_new_status, ready_at = v_now
      WHERE id = p_order_id;

    -- Ação 3: Motorista marca entrega (aguarda PIN do cliente para recebimento)
    WHEN 'delivered_by_driver', 'entregue_motorista' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o motorista atribuído a esta entrega pode atualizar este status');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'IN_TRANSIT', 'in_transit') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Status inválido para entrega: %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERED';

      UPDATE public.orders
      SET status = v_new_status, delivered_at = v_now
      WHERE id = p_order_id;

    -- Ação 4: Administrador arquiva ou finaliza repasse do motorista
    WHEN 'archive_driver', 'pagar_motorista' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ação restrita a administradores');
      END IF;
      IF v_order.status NOT IN ('RECEIVED', 'received', 'DELIVERED', 'COMPLETED') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser arquivado', v_order.status));
      END IF;
      v_new_status := 'COMPLETED';

      UPDATE public.orders
      SET status = v_new_status, payout_driver_done = true
      WHERE id = p_order_id;

    -- Ação 5: Baixa forçada pelo Administrador (em caso de suporte com PIN bloqueado)
    WHEN 'force_receive', 'forcar_baixa' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ação restrita a administradores');
      END IF;
      IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Motivo detalhado é obrigatório para baixa forçada pelo Administrador');
      END IF;
      v_new_status := 'RECEIVED';

      UPDATE public.orders
      SET status = v_new_status,
          received_at = v_now,
          cancellation_reason = 'Baixa manual/administrativa: ' || p_reason
      WHERE id = p_order_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', format('Ação desconhecida: %s', p_action));
  END CASE;

  -- Inserir no histórico de auditoria
  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, v_new_status, v_caller_id, v_caller_role, p_reason, v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'from_status', v_order.status,
    'status', v_new_status,
    'message', 'Status atualizado com sucesso'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order_status TO service_role;

-- 2. RPC Atômica para Motorista Aceitar Corrida no Radar
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

GRANT EXECUTE ON FUNCTION public.accept_order_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order_atomic TO service_role;

-- 3. RPC para Consulta Segura de PINs de Pedidos (Apenas Comprador / Loja / Admin)
CREATE OR REPLACE FUNCTION public.get_my_order_pins(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_is_buyer BOOLEAN := FALSE;
  v_is_store_owner BOOLEAN := FALSE;
  v_del_pin TEXT := NULL;
  v_pick_pin TEXT := NULL;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT COALESCE(is_admin, false) OR role = 'admin' INTO v_is_admin
    FROM public.users WHERE id = v_caller_id;
  END IF;

  SELECT o.*, sf.partner_id as store_partner_id 
  INTO v_order 
  FROM public.orders o
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  v_is_buyer := (v_order.buyer_id = v_caller_id);
  v_is_store_owner := (v_order.store_partner_id = v_caller_id);

  -- O comprador tem acesso ao delivery_pin para fornecer ao motoboy na entrega
  IF v_is_buyer OR v_is_admin THEN
    v_del_pin := v_order.delivery_pin;
  END IF;

  -- A loja tem acesso ao pickup_pin para fornecer ao motoboy na retirada
  IF v_is_store_owner OR v_is_admin THEN
    v_pick_pin := v_order.pickup_pin;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'delivery_pin', v_del_pin,
    'pickup_pin', v_pick_pin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_order_pins TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_order_pins TO service_role;

NOTIFY pgrst, 'reload schema';
