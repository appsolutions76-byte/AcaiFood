-- ==============================================================================
-- ROLLBACK R39 (FASE 4): PEDIDO PARADO, ABRIR PARA O APP E ENTREGA PRÓPRIA
-- ==============================================================================

DROP FUNCTION IF EXISTS public.dispatch_mark_stuck_alert_sent(uuid);
DROP FUNCTION IF EXISTS public.dispatch_open_order_to_app(uuid);
DROP FUNCTION IF EXISTS public.dispatch_set_self_delivery(uuid);
DROP FUNCTION IF EXISTS public.r39_city_stuck_seconds(text, text);

-- Restaura check_delivery_pin (R15)
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
    SELECT (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_is_admin
    FROM public.users WHERE id = v_caller;
  END IF;

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false)
     AND v_order.driver_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de entrega.');
  END IF;

  IF v_order.status IN ('RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Entrega já confirmada anteriormente');
  END IF;

  IF v_order.status = 'PIN_LOCKED' OR COALESCE(v_order.pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas. Contate o suporte.');
  END IF;

  IF v_order.status NOT IN ('DELIVERING', 'DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode receber baixa de entrega', v_order.status));
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
      VALUES (p_order_id, v_order.status, 'RECEIVED', v_caller, 'MOTORISTA', 'PIN validado na entrega', v_now);
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

REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO authenticated, service_role;

-- Restaura create_order_settlements_on_receive (R13)
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

  IF NEW.driver_id IS NOT NULL AND COALESCE(NEW.payout_driver_done, false) = false THEN
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

NOTIFY pgrst, 'reload schema';
