-- ==============================================================================
-- AÇAÍFOOD — MIGRAÇÃO R12: SEGURANÇA DE PIN, BANCO, KYC, AUDITORIA & CONTRATO ASAAS
-- Timestamp: 20261002030000
-- ==============================================================================

-- 1. TABELA DE AUDITORIA ADMINISTRATIVA (Anexo I, Item 7)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para admins, escrita apenas por service_role
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;


-- 2. TABELA DE REGISTRO DE ACEITE DE TERMOS (Cláusula 8.2.4)
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document TEXT NOT NULL CHECK (document IN (
    'acaifood_terms', 'acaifood_privacy', 'asaas_terms', 
    'asaas_privacy', 'subaccount_mandate', 'pix_random_key_consent'
  )),
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT
);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own acceptances" ON public.terms_acceptances;
CREATE POLICY "Users can view own acceptances" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  ));

REVOKE UPDATE, DELETE, TRUNCATE ON public.terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;


-- 3. TABELA SEGURA DE PINS ISOLADOS FORA DO SELECT DA TABELA ORDERS (R3, A9/H7)
CREATE TABLE IF NOT EXISTS public.order_pins (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_pin TEXT,
  pickup_pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_pins ENABLE ROW LEVEL SECURITY;

-- Migrar PINs existentes da tabela orders para order_pins
INSERT INTO public.order_pins (order_id, delivery_pin, pickup_pin)
SELECT id, delivery_pin, pickup_pin
FROM public.orders
WHERE delivery_pin IS NOT NULL OR pickup_pin IS NOT NULL
ON CONFLICT (order_id) DO UPDATE
SET delivery_pin = EXCLUDED.delivery_pin,
    pickup_pin = EXCLUDED.pickup_pin;

-- RLS para isolamento de PINs:
-- Comprador vê delivery_pin; Loja vê pickup_pin; Admin vê ambos; Motorista NUNCA vê PINs
DROP POLICY IF EXISTS "Buyer can view delivery pin" ON public.order_pins;
CREATE POLICY "Buyer can view delivery pin" ON public.order_pins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_pins.order_id AND o.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store partner can view pickup pin" ON public.order_pins;
CREATE POLICY "Store partner can view pickup pin" ON public.order_pins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
      WHERE o.id = order_pins.order_id AND sf.partner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can view all pins" ON public.order_pins;
CREATE POLICY "Admin can view all pins" ON public.order_pins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_pins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_pins TO authenticated;
GRANT ALL ON public.order_pins TO service_role;


-- 4. CAMPOS DE KYC REAL EM USERS (K1, Cláusula 8.2.3) E TRAVA DE CPF/CNPJ (K2)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS company_type TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

-- Trava de alteração de CPF/CNPJ e Pix Key diretamente pelo cliente autenticado
REVOKE UPDATE (cpf_cnpj, pix_key) ON public.users FROM authenticated;


-- 5. RESTRINGIR GERAÇÃO DE PINS EXCLUSIVAMENTE A SERVICE_ROLE (R3)
REVOKE EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_pickup_pin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_pickup_pin(uuid) TO service_role;


-- 6. RPC SEGURA check_delivery_pin (Validação estrita de driver_id antes de tentativas)
CREATE OR REPLACE FUNCTION public.check_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_service_role BOOLEAN := (auth.role() = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_clean_pin TEXT;
  v_real_pin TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_clean_pin := trim(COALESCE(p_pin, ''));
  IF length(v_clean_pin) != 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de entrega de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT COALESCE(is_admin, false) OR role = 'admin' INTO v_is_admin
    FROM public.users WHERE id = v_caller_id;
  END IF;

  -- 1. VALIDAÇÃO DE IDENTIDADE: Apenas o motorista atribuído (ou service_role/admin) pode testar o PIN
  IF NOT v_is_service_role AND NOT v_is_admin THEN
    IF v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de entrega.');
    END IF;
  END IF;

  -- Se já foi recebido
  IF v_order.status IN ('RECEIVED', 'received', 'COMPLETED', 'completed') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Entrega já concluída anteriormente');
  END IF;

  -- Status deve ser DELIVERING ou DELIVERED
  IF v_order.status NOT IN ('DELIVERING', 'delivering', 'DELIVERED', 'delivered', 'IN_TRANSIT', 'in_transit') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode receber baixa de entrega', v_order.status));
  END IF;

  -- Bloqueio por tentativas
  IF v_order.status = 'PIN_LOCKED' OR COALESCE(v_order.pin_attempts, 0) >= 5 THEN
    UPDATE public.orders SET status = 'PIN_LOCKED' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas incorretas. Contate o suporte.');
  END IF;

  -- Rate limit de 3 segundos
  IF v_order.last_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde alguns segundos.');
  END IF;

  -- Buscar PIN real na tabela order_pins ou hash
  SELECT delivery_pin INTO v_real_pin FROM public.order_pins WHERE order_id = p_order_id;
  IF v_real_pin IS NULL THEN
    v_real_pin := v_order.delivery_pin;
  END IF;

  IF v_real_pin IS NOT NULL AND trim(v_real_pin) = v_clean_pin THEN
    v_is_valid := TRUE;
  ELSIF v_order.pin_hash IS NOT NULL THEN
    BEGIN
      IF crypt(v_clean_pin, v_order.pin_hash) = v_order.pin_hash THEN
        v_is_valid := TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Registrar log de tentativa
  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, COALESCE(v_caller_id, v_order.driver_id), v_is_valid, p_device_info, v_now);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_is_valid THEN
    UPDATE public.orders
    SET status = 'RECEIVED',
        received_at = v_now,
        delivered_at = COALESCE(delivered_at, v_now),
        last_pin_attempt_at = v_now,
        pin_attempts = 0,
        asaas_transfer_status = 'READY_TO_RELEASE'
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Entrega confirmada com sucesso! Repasse liberado.');
  ELSE
    UPDATE public.orders
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1,
        last_pin_attempt_at = v_now,
        status = CASE WHEN COALESCE(pin_attempts, 0) + 1 >= 5 THEN 'PIN_LOCKED' ELSE status END
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', false, 'error', 'PIN de entrega incorreto. Solicite o código de 4 dígitos ao cliente.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO service_role;


-- 7. RPC SEGURA check_pickup_pin (Validação estrita de driver_id)
CREATE OR REPLACE FUNCTION public.check_pickup_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_service_role BOOLEAN := (auth.role() = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_clean_pin TEXT;
  v_real_pin TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_clean_pin := trim(COALESCE(p_pin, ''));
  IF length(v_clean_pin) != 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de retirada de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT COALESCE(is_admin, false) OR role = 'admin' INTO v_is_admin
    FROM public.users WHERE id = v_caller_id;
  END IF;

  -- 1. VALIDAÇÃO DE IDENTIDADE: Apenas o motorista atribuído (ou service_role/admin) pode validar a retirada
  IF NOT v_is_service_role AND NOT v_is_admin THEN
    IF v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de retirada.');
    END IF;
  END IF;

  IF v_order.picked_up_at IS NOT NULL OR v_order.status IN ('DELIVERING', 'delivering', 'DELIVERED', 'delivered', 'RECEIVED', 'received', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Retirada já confirmada anteriormente');
  END IF;

  IF COALESCE(v_order.pickup_pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada bloqueado por excesso de tentativas. Contate o estabelecimento.');
  END IF;

  IF v_order.last_pickup_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pickup_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde alguns segundos.');
  END IF;

  -- Buscar PIN de retirada
  SELECT pickup_pin INTO v_real_pin FROM public.order_pins WHERE order_id = p_order_id;
  IF v_real_pin IS NULL THEN
    v_real_pin := v_order.pickup_pin;
  END IF;

  IF v_real_pin IS NOT NULL AND trim(v_real_pin) = v_clean_pin THEN
    v_is_valid := TRUE;
  END IF;

  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, COALESCE(v_caller_id, v_order.driver_id), v_is_valid, 'PICKUP: ' || p_device_info, v_now);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_is_valid THEN
    UPDATE public.orders
    SET status = 'DELIVERING',
        picked_up_at = v_now,
        last_pickup_pin_attempt_at = v_now,
        pickup_pin_attempts = 0
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Retirada confirmada! Pedido agora em trânsito para o destino.');
  ELSE
    UPDATE public.orders
    SET pickup_pin_attempts = COALESCE(pickup_pin_attempts, 0) + 1,
        last_pickup_pin_attempt_at = v_now
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada inválido. Verifique o código com o estabelecimento.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text) TO service_role;


-- 8. EXPANDIR advance_order_status (A7, R6) COM CONTROLES ESTRITOS
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

  IF v_order.seller_storefront_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.storefronts WHERE id = v_order.seller_storefront_id;
  END IF;

  CASE lower(trim(p_action))
    -- Ação 1: Loja aceita pedido e inicia preparo
    WHEN 'accept', 'iniciar_preparo' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode aceitar o pedido');
      END IF;
      IF v_order.status NOT IN ('PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível iniciar o preparo de pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'PREPARING';

      UPDATE public.orders SET status = v_new_status, accepted_at = v_now WHERE id = p_order_id;

    -- Ação 2: Loja conclui preparo e coloca como pronto
    WHEN 'ready', 'pronto' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode marcar o pedido como pronto');
      END IF;
      IF v_order.status NOT IN ('PREPARING', 'preparing', 'PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível marcar como pronto pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'READY';

      UPDATE public.orders SET status = v_new_status, ready_at = v_now WHERE id = p_order_id;

    -- Ação 3: Retirada pelo entregador atribuído
    WHEN 'pickup', 'retirada' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode marcar a retirada do pedido');
      END IF;
      IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível retirar pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERING';

      UPDATE public.orders SET status = v_new_status, picked_up_at = v_now WHERE id = p_order_id;

    -- Ação 4: Entregador chega ao destino
    WHEN 'delivered_by_driver', 'entregue_motorista' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode atualizar a chegada no destino');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'IN_TRANSIT', 'in_transit') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Status inválido para entrega: %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERED';

      UPDATE public.orders SET status = v_new_status, delivered_at = v_now WHERE id = p_order_id;

    -- Ação 5: Cancelamento de pedido não pago (comprador ou loja)
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

    -- Ação 6: Arquivamento de entrega pelo operador/admin
    WHEN 'archive_driver', 'pagar_motorista' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ação restrita ao motorista ou administradores');
      END IF;
      IF v_order.status NOT IN ('RECEIVED', 'received', 'DELIVERED', 'COMPLETED') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser arquivado', v_order.status));
      END IF;
      v_new_status := 'COMPLETED';

      UPDATE public.orders SET status = v_new_status, payout_driver_done = true WHERE id = p_order_id;

    -- Ação 7: Baixa forçada administrativa estrita (R6)
    WHEN 'force_receive', 'forcar_baixa' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Baixa forçada é restrita a administradores');
      END IF;
      -- Aceita APENAS a partir de DELIVERING, DELIVERED ou PIN_LOCKED. NUNCA CANCELLED/REFUNDED/PENDING/PAID
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

      -- Registrar em admin_audit_log
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

  -- Auditoria de status do pedido
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

GRANT EXECUTE ON FUNCTION public.advance_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order_status TO service_role;


-- 9. REVOGAR transition_order_status DE USUÁRIOS PÚBLICOS E AUTENTICADOS (A7)
REVOKE EXECUTE ON FUNCTION public.transition_order_status FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO service_role;


-- 10. RPC SEGURA get_my_order_pins (Lê exclusivamente de order_pins)
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

  -- Comprador acessa delivery_pin
  IF v_is_buyer OR v_is_admin THEN
    SELECT delivery_pin INTO v_del_pin FROM public.order_pins WHERE order_id = p_order_id;
    IF v_del_pin IS NULL THEN v_del_pin := v_order.delivery_pin; END IF;
  END IF;

  -- Estabelecimento acessa pickup_pin
  IF v_is_store_owner OR v_is_admin THEN
    SELECT pickup_pin INTO v_pick_pin FROM public.order_pins WHERE order_id = p_order_id;
    IF v_pick_pin IS NULL THEN v_pick_pin := v_order.pickup_pin; END IF;
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


-- 11. RPC SEGURA get_driver_radar (Sem dados pessoais, coordenadas aproximadas) (A9/H7)
CREATE OR REPLACE FUNCTION public.get_driver_radar()
RETURNS TABLE (
  id UUID,
  order_type TEXT,
  status TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
  delivery_bairro TEXT,
  approx_lat NUMERIC,
  approx_lng NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_type,
    o.status,
    o.delivery_distance_km,
    COALESCE(o.driver_payout_amount, o.driver_amount, 0::numeric) as driver_payout_amount,
    COALESCE(o.delivery_reference, 'Centro') as delivery_bairro,
    ROUND(COALESCE(o.delivery_lat, 0)::numeric, 3) as approx_lat,
    ROUND(COALESCE(o.delivery_lng, 0)::numeric, 3) as approx_lng,
    o.created_at
  FROM public.orders o
  WHERE o.driver_id IS NULL
    AND o.status IN ('READY', 'PREPARING', 'PAID', 'SEARCHING_OPERATOR')
    AND o.is_hidden = false
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_radar TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_radar TO service_role;

NOTIFY pgrst, 'reload schema';
