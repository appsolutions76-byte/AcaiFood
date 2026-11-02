-- ==============================================================================
-- MIGRATION R39 (FASE 4): PEDIDO PARADO, ABRIR PARA O APP E ENTREGA PRÓPRIA
-- ==============================================================================

-- 1. Helper: tempo de alerta de pedido parado por cidade e fluxo (padrão 300s) --
CREATE OR REPLACE FUNCTION public.r39_city_stuck_seconds(p_city TEXT, p_flow TEXT)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm TEXT := public.r39_norm_city(p_city);
  v_rec RECORD;
  v_secs INT := 300;
BEGIN
  IF v_norm = '' THEN
    RETURN 300;
  END IF;

  SELECT b2c_stuck_order_alert_seconds,
         b2b_stuck_order_alert_seconds,
         col_stuck_order_alert_seconds,
         rates
    INTO v_rec
    FROM public.cities
   WHERE public.r39_norm_city(name) = v_norm
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN 300;
  END IF;

  IF upper(COALESCE(p_flow, 'B2C')) = 'B2B' THEN
    v_secs := COALESCE(
      NULLIF((v_rec.rates->>'b2b_stuck_order_alert_seconds')::int, 0),
      v_rec.b2b_stuck_order_alert_seconds,
      300
    );
  ELSIF upper(COALESCE(p_flow, 'B2C')) = 'COLETA' THEN
    v_secs := COALESCE(
      NULLIF((v_rec.rates->>'col_stuck_order_alert_seconds')::int, 0),
      v_rec.col_stuck_order_alert_seconds,
      300
    );
  ELSE
    v_secs := COALESCE(
      NULLIF((v_rec.rates->>'b2c_stuck_order_alert_seconds')::int, 0),
      v_rec.b2c_stuck_order_alert_seconds,
      300
    );
  END IF;

  RETURN GREATEST(v_secs, 10);
EXCEPTION WHEN OTHERS THEN
  RETURN 300;
END;
$$;

-- 2. RPC: dispatch_mark_stuck_alert_sent (4.1) ---------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_mark_stuck_alert_sent(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_partner_id UUID;
  v_city TEXT;
  v_stuck_secs INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT v_is_service AND v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin')
      INTO v_is_admin
      FROM public.users u
     WHERE u.id = v_caller;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- (a) Checar chave da cidade
  v_city := public.r39_order_city(v_order.seller_storefront_id, v_order.buyer_id);
  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  -- (b) O pedido precisa estar em REFERRED_ONLY
  IF COALESCE(v_order.dispatch_mode, 'ALL') <> 'REFERRED_ONLY' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alerta de pedido parado só se aplica ao modo Só indicados.');
  END IF;

  v_partner_id := public.r39_order_partner_id(v_order.order_type, v_order.seller_storefront_id, v_order.buyer_id);

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false) AND v_partner_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para este pedido.');
  END IF;

  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não está aguardando entregador.', v_order.status));
  END IF;

  IF v_order.stuck_alert_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_sent', true, 'stuck_alert_sent_at', v_order.stuck_alert_sent_at);
  END IF;

  IF v_order.driver_id IS NOT NULL OR COALESCE(v_order.self_delivery, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido já atribuído ou em entrega própria.');
  END IF;

  v_stuck_secs := public.r39_city_stuck_seconds(v_city, v_order.order_type);

  IF v_order.dispatch_called_at IS NULL OR v_now < (v_order.dispatch_called_at + make_interval(secs => v_stuck_secs)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ainda dentro do tempo de espera dos indicados.');
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.orders
     SET stuck_alert_sent_at = v_now
   WHERE id = p_order_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  RETURN jsonb_build_object('success', true, 'already_sent', false, 'stuck_alert_sent_at', v_now);
END;
$$;

-- 3. RPC: dispatch_open_order_to_app (4.2) -------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_open_order_to_app(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_partner_id UUID;
  v_city TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT v_is_service AND v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin')
      INTO v_is_admin
      FROM public.users u
     WHERE u.id = v_caller;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- (a) Checar chave da cidade
  v_city := public.r39_order_city(v_order.seller_storefront_id, v_order.buyer_id);
  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  -- (b) O pedido precisa estar em REFERRED_ONLY
  IF COALESCE(v_order.dispatch_mode, 'ALL') <> 'REFERRED_ONLY' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas pedidos no modo Só indicados podem ser abertos manualmente para o app.');
  END IF;

  v_partner_id := public.r39_order_partner_id(v_order.order_type, v_order.seller_storefront_id, v_order.buyer_id);

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false) AND v_partner_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pelo pedido pode abri-lo para o app.');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi aceito por um motorista.');
  END IF;

  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser aberto para o radar.', v_order.status));
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.orders
     SET radar_open_at = v_now,
         self_delivery = false
   WHERE id = p_order_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'radar_open_at', v_now,
    'message', 'Pedido aberto para todos os motoristas do app!'
  );
END;
$$;

-- 4. RPC: dispatch_set_self_delivery (4.3) -------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_set_self_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_partner_id UUID;
  v_city TEXT;
BEGIN
  IF NOT v_is_service AND v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin')
      INTO v_is_admin
      FROM public.users u
     WHERE u.id = v_caller;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- (a) Checar chave da cidade (com a chave desligada, NENHUM pedido pode virar self_delivery)
  v_city := public.r39_order_city(v_order.seller_storefront_id, v_order.buyer_id);
  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  -- Em Coleta de Resíduos não existe "entregar por conta própria" (item 5.3)
  IF upper(COALESCE(v_order.order_type, 'B2C')) = 'COLETA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega por conta própria não está disponível para Coleta de Resíduos.');
  END IF;

  -- (b) O pedido precisa estar com dispatch_mode = 'REFERRED_ONLY'
  IF COALESCE(v_order.dispatch_mode, 'ALL') <> 'REFERRED_ONLY' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega por conta própria só está disponível para pedidos no modo Só indicados.');
  END IF;

  v_partner_id := public.r39_order_partner_id(v_order.order_type, v_order.seller_storefront_id, v_order.buyer_id);

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false) AND v_partner_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento vendedor pode assumir a entrega própria deste pedido.');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi aceito por um motorista.');
  END IF;

  -- (c) Status deve ser READY / SEARCHING_OPERATOR (não PREPARING) e somente após o alerta (stuck_alert_sent_at IS NOT NULL)
  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode entrar em entrega própria.', v_order.status));
  END IF;

  IF v_order.stuck_alert_sent_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega por conta própria só pode ser acionada após o alerta de pedido parado.');
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.orders
     SET self_delivery = true,
         radar_open_at = NULL
   WHERE id = p_order_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'self_delivery', true,
    'message', 'Entrega assumida pelo estabelecimento! Solicite o PIN de 4 dígitos do cliente ao entregar.'
  );
END;
$$;

-- 5. Atualizar check_delivery_pin (4.3: permitir loja em self_delivery = true) --
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
  v_caller UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_seller_partner_id UUID := NULL;
  v_is_self_delivery_seller BOOLEAN := FALSE;
  v_pin TEXT := trim(COALESCE(p_pin, ''));
  v_real TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT v_is_service AND v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  IF v_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de entrega de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin') INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;
  END IF;

  IF v_order.seller_storefront_id IS NOT NULL THEN
    SELECT sf.partner_id INTO v_seller_partner_id
      FROM public.storefronts sf
     WHERE sf.id = v_order.seller_storefront_id;
  END IF;

  v_is_self_delivery_seller := (
    COALESCE(v_order.self_delivery, false) = true
    AND v_order.driver_id IS NULL
    AND v_caller IS NOT NULL
    AND v_seller_partner_id = v_caller
  );

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false)
     AND v_order.driver_id IS DISTINCT FROM v_caller
     AND NOT v_is_self_delivery_seller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de entrega.');
  END IF;

  IF v_order.status IN ('RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Entrega já confirmada anteriormente');
  END IF;

  IF v_order.status = 'PIN_LOCKED' OR COALESCE(v_order.pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas. Contate o suporte.');
  END IF;

  IF v_is_self_delivery_seller THEN
    IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR', 'DELIVERING', 'DELIVERED') THEN
      RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode receber baixa de entrega própria', v_order.status));
    END IF;
  ELSE
    IF v_order.status NOT IN ('DELIVERING', 'DELIVERED') THEN
      RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode receber baixa de entrega', v_order.status));
    END IF;
  END IF;

  IF v_order.last_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde alguns segundos.');
  END IF;

  SELECT NULLIF(trim(delivery_pin), '') INTO v_real FROM public.order_pins WHERE order_id = p_order_id;
  IF v_real IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido está sem PIN de entrega. Peça ao suporte para gerar um novo.');
  END IF;

  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, v_caller, v_real = v_pin, left(COALESCE(p_device_info, ''), 200), v_now);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_real = v_pin THEN
    PERFORM set_config('acaifood.pin_verified_order', p_order_id::text, true);

    UPDATE public.orders
    SET status = 'RECEIVED',
        received_at = v_now,
        delivered_at = COALESCE(delivered_at, v_now),
        last_pin_attempt_at = v_now,
        pin_attempts = 0,
        asaas_transfer_status = 'READY_TO_RELEASE'
    WHERE id = p_order_id;

    PERFORM set_config('acaifood.pin_verified_order', '', true);

    BEGIN
      INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
      VALUES (
        p_order_id,
        v_order.status,
        'RECEIVED',
        v_caller,
        CASE WHEN v_is_self_delivery_seller THEN 'LOJA' ELSE 'MOTORISTA' END,
        CASE WHEN v_is_self_delivery_seller THEN 'PIN validado na entrega própria pelo estabelecimento' ELSE 'PIN validado na entrega' END,
        v_now
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'status', 'RECEIVED', 'message', 'Entrega confirmada com sucesso!');
  END IF;

  UPDATE public.orders
  SET pin_attempts = COALESCE(pin_attempts, 0) + 1,
      last_pin_attempt_at = v_now,
      status = CASE WHEN COALESCE(pin_attempts, 0) + 1 >= 5 THEN 'PIN_LOCKED' ELSE status END
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', false, 'error',
    format('PIN incorreto. Tentativa %s de 5. Confirme o código com o cliente.', COALESCE(v_order.pin_attempts, 0) + 1));
END;
$$;

-- 6. Atualizar create_order_settlements_on_receive (4.3: sem repasse de motorista em self_delivery)
CREATE OR REPLACE FUNCTION public.create_order_settlements_on_receive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN := FALSE;
  v_seller UUID;
  v_wallet TEXT;
  v_status TEXT;
BEGIN
  IF NOT (NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(settlements_enabled, false) INTO v_enabled FROM public.platform_settings LIMIT 1;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.seller_storefront_id IS NOT NULL THEN
    SELECT partner_id INTO v_seller FROM public.storefronts WHERE id = NEW.seller_storefront_id;
  END IF;

  -- Vendedor: nunca para o próprio comprador (coleta); nunca valor bruto
  IF v_seller IS NOT NULL AND v_seller IS DISTINCT FROM NEW.buyer_id
     AND COALESCE(NEW.payout_seller_done, false) = false THEN
    SELECT asaas_wallet_id, asaas_account_status INTO v_wallet, v_status FROM public.users WHERE id = v_seller;

    INSERT INTO public.settlements (order_id, partner_id, role, amount, wallet_id, status, attempt_ref, last_error)
    VALUES (
      NEW.id, v_seller, 'seller',
      COALESCE(NEW.seller_payout_amount, 0),
      v_wallet,
      CASE
        WHEN NEW.seller_payout_amount IS NULL THEN 'REVIEW'
        WHEN v_wallet IS NOT NULL AND v_status = 'APPROVED' THEN 'PENDING'
        ELSE 'WAITING_ACCOUNT'
      END,
      gen_random_uuid()::text,
      CASE WHEN NEW.seller_payout_amount IS NULL THEN 'Pedido sem snapshot de valores: revisar no admin' ELSE NULL END
    )
    ON CONFLICT (order_id, role) DO NOTHING;

    UPDATE public.orders SET payout_seller_done = true WHERE id = NEW.id;
  END IF;

  -- Motorista (nunca criado se self_delivery = true)
  IF NEW.driver_id IS NOT NULL
     AND COALESCE(NEW.self_delivery, false) = false
     AND COALESCE(NEW.payout_driver_done, false) = false THEN
    SELECT asaas_wallet_id, asaas_account_status INTO v_wallet, v_status FROM public.users WHERE id = NEW.driver_id;

    INSERT INTO public.settlements (order_id, partner_id, role, amount, wallet_id, status, attempt_ref, last_error)
    VALUES (
      NEW.id, NEW.driver_id, 'driver',
      COALESCE(NEW.driver_payout_amount, 0),
      v_wallet,
      CASE
        WHEN NEW.driver_payout_amount IS NULL THEN 'REVIEW'
        WHEN v_wallet IS NOT NULL AND v_status = 'APPROVED' THEN 'PENDING'
        ELSE 'WAITING_ACCOUNT'
      END,
      gen_random_uuid()::text,
      CASE WHEN NEW.driver_payout_amount IS NULL THEN 'Pedido sem snapshot de valores: revisar no admin' ELSE NULL END
    )
    ON CONFLICT (order_id, role) DO NOTHING;

    UPDATE public.orders SET payout_driver_done = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Permissões -----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.dispatch_mark_stuck_alert_sent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_open_order_to_app(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_set_self_delivery(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dispatch_mark_stuck_alert_sent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_open_order_to_app(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_set_self_delivery(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
