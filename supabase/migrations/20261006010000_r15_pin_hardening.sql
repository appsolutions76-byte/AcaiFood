-- ==============================================================================
-- AÇAÍFOOD — R15 HOTFIX: PIN de retirada e entrega (substitui 20261003200500)
-- Timestamp: 20261006010000
-- Base: docs/17_AUDITORIA_POS_R13_R14_2026-10-06.md, seção 1
--
-- Compatível com o app no ar: mesmas assinaturas (uuid, text, text) e mesmo
-- formato de retorno. Pode ser aplicada ANTES do deploy do app.
--
--  1. Gera PIN real para todo pedido aberto que não tem (entrega e retirada).
--  2. check_pickup_pin / check_delivery_pin:
--     - exigem login (auth.uid) e ser o motorista atribuído (ou admin/service_role);
--     - sem PIN mestre; sem "aceita qualquer PIN"; leem só order_pins;
--     - PIN ausente = erro (admin regenera).
--  3. Trigger: RECEIVED só pela função segura, admin ou service_role.
--  4. get_my_order_pins_bulk sem PIN padrão.
--  5. Sem EXECUTE para anon.
-- ==============================================================================

-- 1. Backfill de PINs dos pedidos abertos -------------------------------------
INSERT INTO public.order_pins (order_id, delivery_pin, updated_at)
SELECT o.id, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'), NOW()
FROM public.orders o
LEFT JOIN public.order_pins p ON p.order_id = o.id
WHERE o.status IN ('PAID','PREPARING','READY','SEARCHING_OPERATOR','DELIVERING','DELIVERED')
  AND (p.order_id IS NULL OR NULLIF(trim(p.delivery_pin), '') IS NULL)
ON CONFLICT (order_id) DO UPDATE
SET delivery_pin = COALESCE(NULLIF(trim(public.order_pins.delivery_pin), ''), EXCLUDED.delivery_pin),
    updated_at = NOW();

INSERT INTO public.order_pins (order_id, pickup_pin, updated_at)
SELECT o.id, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'), NOW()
FROM public.orders o
LEFT JOIN public.order_pins p ON p.order_id = o.id
WHERE o.status IN ('PAID','PREPARING','READY','SEARCHING_OPERATOR','DELIVERING')
  AND o.picked_up_at IS NULL
  AND o.seller_storefront_id IS NOT NULL
  AND (p.order_id IS NULL OR NULLIF(trim(p.pickup_pin), '') IS NULL)
ON CONFLICT (order_id) DO UPDATE
SET pickup_pin = COALESCE(NULLIF(trim(public.order_pins.pickup_pin), ''), EXCLUDED.pickup_pin),
    updated_at = NOW();

-- 2. Trigger de validação (volta a regra do R13) --------------------------------
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
    IF COALESCE(auth.role(), 'anon') <> 'service_role'
       AND NOT COALESCE(public.is_admin(), false)
       AND COALESCE(current_setting('acaifood.pin_verified_order', true), '') <> NEW.id::text THEN
      RAISE EXCEPTION 'Acesso negado: a entrega só pode ser confirmada com o PIN do cliente.';
    END IF;
  END IF;
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders;
CREATE TRIGGER check_delivery_pin
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_pin_trigger();

-- 3. PIN de retirada ------------------------------------------------------------
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
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de retirada de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller IS NOT NULL THEN
    SELECT (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_is_admin
    FROM public.users WHERE id = v_caller;
  END IF;

  -- Recusa ANTES de contar tentativa
  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false)
     AND v_order.driver_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de retirada.');
  END IF;

  IF v_order.picked_up_at IS NOT NULL OR v_order.status IN ('DELIVERED', 'RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Retirada já confirmada anteriormente');
  END IF;

  IF v_order.status NOT IN ('READY', 'SEARCHING_OPERATOR', 'DELIVERING') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser retirado', v_order.status));
  END IF;

  IF COALESCE(v_order.pickup_pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada bloqueado por excesso de tentativas. Contate o suporte.');
  END IF;

  IF v_order.last_pickup_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pickup_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde alguns segundos.');
  END IF;

  SELECT NULLIF(trim(pickup_pin), '') INTO v_real FROM public.order_pins WHERE order_id = p_order_id;
  IF v_real IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido está sem PIN de retirada. Peça ao suporte para gerar um novo.');
  END IF;

  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, v_caller, v_real = v_pin, 'PICKUP: ' || left(COALESCE(p_device_info, ''), 190), v_now);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_real = v_pin THEN
    UPDATE public.orders
    SET status = 'DELIVERING',
        picked_up_at = v_now,
        last_pickup_pin_attempt_at = v_now,
        pickup_pin_attempts = 0
    WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'status', 'DELIVERING', 'message', 'Retirada confirmada! Pedido em rota de entrega.');
  END IF;

  UPDATE public.orders
  SET pickup_pin_attempts = COALESCE(pickup_pin_attempts, 0) + 1,
      last_pickup_pin_attempt_at = v_now
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', false, 'error',
    format('PIN de retirada incorreto. Tentativa %s de 5.', COALESCE(v_order.pickup_pin_attempts, 0) + 1));
END;
$$;

-- 4. PIN de entrega -------------------------------------------------------------
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

-- 5. Leitura de PIN por papel, sem PIN padrão ----------------------------------
CREATE OR REPLACE FUNCTION public.get_my_order_pins_bulk(p_order_ids UUID[])
RETURNS TABLE (order_id UUID, delivery_pin TEXT, pickup_pin TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF COALESCE(auth.role(), 'anon') = 'service_role' THEN
    v_is_admin := TRUE;
  ELSIF v_caller IS NULL THEN
    RETURN;
  ELSE
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin') INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;
  END IF;

  RETURN QUERY
  SELECT o.id,
         CASE WHEN COALESCE(v_is_admin, false) OR o.buyer_id = v_caller THEN p.delivery_pin END,
         CASE WHEN COALESCE(v_is_admin, false) OR sf.partner_id = v_caller THEN p.pickup_pin END
  FROM public.orders o
  LEFT JOIN public.order_pins p ON p.order_id = o.id
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  WHERE o.id = ANY(p_order_ids)
    AND (COALESCE(v_is_admin, false) OR o.buyer_id = v_caller OR sf.partner_id = v_caller)
  LIMIT 500;
END;
$$;

-- 6. Permissões -----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_order_pins_bulk(uuid[])       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text)   TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_my_order_pins_bulk(uuid[])       TO authenticated, service_role;

REVOKE SELECT ON public.order_pins FROM anon, authenticated;
GRANT ALL ON public.order_pins TO service_role;

NOTIFY pgrst, 'reload schema';
