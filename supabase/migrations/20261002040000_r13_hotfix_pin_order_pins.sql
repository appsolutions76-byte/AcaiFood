-- ==============================================================================
-- AÇAÍFOOD — R13 HOTFIX 1/2: PIN seguro e único em order_pins
-- Timestamp: 20261002040000
-- Base: docs/15_REAUDITORIA_POS_R12_2026-10-02.md (P1, P2, P3) + 12 (R2, R4, R5)
--
-- PODE SER APLICADA ANTES DO DEPLOY DO APP: a versão publicada continua funcionando
-- (as chamadas antigas com p_operator_id passam a usar a validação segura).
-- Depois do deploy do app, aplicar a 20261002050000 (revoga SELECT direto em order_pins).
--
-- O que faz:
--  1. Apaga TODAS as versões antigas de check_delivery_pin / check_pickup_pin
--     (as de 4 parâmetros, sem checagem de quem chama).
--  2. Trigger que copia qualquer PIN gravado em orders para order_pins e limpa
--     orders.delivery_pin / pickup_pin / pin_hash (checkout, webhook, conciliação).
--  3. generate_delivery_pin / generate_pickup_pin gravam só em order_pins.
--  4. Copia para order_pins os PINs atuais dos pedidos (corrige pedidos pagos
--     depois da migration R12) e limpa as colunas de PIN em orders.
--  5. check_delivery_pin / check_pickup_pin seguras (só o motorista atribuído,
--     comparando com order_pins) + trigger de validação que aceita a função segura.
--  6. get_my_order_pins_bulk para o app ler os PINs filtrados por papel.
--  7. Repasse (settlements): flag settlements_enabled, colunas que a rota usa,
--     status REVIEW, sem valor bruto, sem repasse ao próprio comprador e sem
--     pagamento em dobro com o saque antigo (só cria quando a flag está ligada).
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- 1. Apagar todas as sobrecargas antigas das funções de PIN
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('check_delivery_pin', 'check_pickup_pin')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Garantir order_pins e a sincronização automática a partir de orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_pins (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_pin TEXT,
  pickup_pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_pins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.order_pins ENABLE ROW LEVEL SECURITY;

-- Copia o PIN escrito em orders (por qualquer caminho) para order_pins e limpa orders.
CREATE OR REPLACE FUNCTION public.sync_order_pins_from_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_pin IS NULL AND NEW.pickup_pin IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.order_pins (order_id, delivery_pin, pickup_pin, updated_at)
  VALUES (NEW.id, NULLIF(trim(NEW.delivery_pin), ''), NULLIF(trim(NEW.pickup_pin), ''), NOW())
  ON CONFLICT (order_id) DO UPDATE
  SET delivery_pin = COALESCE(EXCLUDED.delivery_pin, public.order_pins.delivery_pin),
      pickup_pin   = COALESCE(EXCLUDED.pickup_pin,   public.order_pins.pickup_pin),
      updated_at   = NOW();

  -- Remove o PIN em texto (e o hash, que um PIN de 4 dígitos não protege) de orders.
  UPDATE public.orders
  SET delivery_pin = NULL,
      pickup_pin   = NULL,
      pin_hash     = NULL
  WHERE id = NEW.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_pins ON public.orders;
CREATE TRIGGER trg_sync_order_pins
AFTER INSERT OR UPDATE OF delivery_pin, pickup_pin ON public.orders
FOR EACH ROW
WHEN (NEW.delivery_pin IS NOT NULL OR NEW.pickup_pin IS NOT NULL)
EXECUTE FUNCTION public.sync_order_pins_from_orders();

-- ---------------------------------------------------------------------------
-- 3. Geradores de PIN gravam só em order_pins (service_role apenas)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generate_delivery_pin(uuid);
CREATE FUNCTION public.generate_delivery_pin(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin TEXT := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
BEGIN
  INSERT INTO public.order_pins (order_id, delivery_pin, updated_at)
  VALUES (p_order_id, v_pin, NOW())
  ON CONFLICT (order_id) DO UPDATE
  SET delivery_pin = EXCLUDED.delivery_pin, updated_at = NOW();

  UPDATE public.orders
  SET pin_attempts = 0, last_pin_attempt_at = NULL
  WHERE id = p_order_id;

  RETURN v_pin;
END;
$$;

DROP FUNCTION IF EXISTS public.generate_pickup_pin(uuid);
CREATE FUNCTION public.generate_pickup_pin(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin TEXT := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
BEGIN
  INSERT INTO public.order_pins (order_id, pickup_pin, updated_at)
  VALUES (p_order_id, v_pin, NOW())
  ON CONFLICT (order_id) DO UPDATE
  SET pickup_pin = EXCLUDED.pickup_pin, updated_at = NOW();

  UPDATE public.orders
  SET pickup_pin_attempts = 0, last_pickup_pin_attempt_at = NULL
  WHERE id = p_order_id;

  RETURN v_pin;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_pickup_pin(uuid)   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_delivery_pin(uuid) TO service_role;
GRANT  EXECUTE ON FUNCTION public.generate_pickup_pin(uuid)   TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Backfill: os PINs atuais de orders são os válidos (o webhook os trocou
--    depois da R12). Copiar para order_pins e limpar orders.
-- ---------------------------------------------------------------------------
INSERT INTO public.order_pins (order_id, delivery_pin, pickup_pin, updated_at)
SELECT id, NULLIF(trim(delivery_pin), ''), NULLIF(trim(pickup_pin), ''), NOW()
FROM public.orders
WHERE delivery_pin IS NOT NULL OR pickup_pin IS NOT NULL
ON CONFLICT (order_id) DO UPDATE
SET delivery_pin = COALESCE(EXCLUDED.delivery_pin, public.order_pins.delivery_pin),
    pickup_pin   = COALESCE(EXCLUDED.pickup_pin,   public.order_pins.pickup_pin),
    updated_at   = NOW();

UPDATE public.orders
SET delivery_pin = NULL, pickup_pin = NULL, pin_hash = NULL, provided_pin = NULL
WHERE delivery_pin IS NOT NULL OR pickup_pin IS NOT NULL OR pin_hash IS NOT NULL OR provided_pin IS NOT NULL;

-- Pedidos pagos e ainda não entregues sem PIN de entrega: gerar um.
INSERT INTO public.order_pins (order_id, delivery_pin, updated_at)
SELECT o.id, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'), NOW()
FROM public.orders o
LEFT JOIN public.order_pins p ON p.order_id = o.id
WHERE o.status IN ('PAID', 'PREPARING', 'READY', 'SEARCHING_OPERATOR', 'DELIVERING', 'DELIVERED')
  AND (p.order_id IS NULL OR p.delivery_pin IS NULL)
ON CONFLICT (order_id) DO UPDATE
SET delivery_pin = COALESCE(public.order_pins.delivery_pin, EXCLUDED.delivery_pin), updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 5. Trigger de validação: RECEIVED só pela função segura, admin ou service_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
    IF auth.role() = 'authenticated'
       AND NOT public.is_admin()
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

-- check_delivery_pin seguro: só o motorista atribuído (ou admin/service_role),
-- recusa ANTES de contar tentativa, compara com order_pins.
CREATE FUNCTION public.check_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_service BOOLEAN := (auth.role() = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_pin TEXT := trim(COALESCE(p_pin, ''));
  v_real TEXT;
  v_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de entrega de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_is_admin
    FROM public.users WHERE id = v_caller_id;
  END IF;

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false) THEN
    IF v_order.driver_id IS NULL OR v_order.driver_id <> v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de entrega.');
    END IF;
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

  SELECT delivery_pin INTO v_real FROM public.order_pins WHERE order_id = p_order_id;
  v_valid := (v_real IS NOT NULL AND trim(v_real) = v_pin);

  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, COALESCE(v_caller_id, v_order.driver_id), v_valid, left(COALESCE(p_device_info, ''), 200), v_now);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_valid THEN
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
      VALUES (p_order_id, v_order.status, 'RECEIVED', COALESCE(v_caller_id, v_order.driver_id), 'MOTORISTA', 'PIN validado na entrega', v_now);
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

CREATE FUNCTION public.check_pickup_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_service BOOLEAN := (auth.role() = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_pin TEXT := trim(COALESCE(p_pin, ''));
  v_real TEXT;
  v_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de retirada de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_is_admin
    FROM public.users WHERE id = v_caller_id;
  END IF;

  IF NOT v_is_service AND NOT COALESCE(v_is_admin, false) THEN
    IF v_order.driver_id IS NULL OR v_order.driver_id <> v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável por este pedido pode validar o PIN de retirada.');
    END IF;
  END IF;

  IF v_order.picked_up_at IS NOT NULL OR v_order.status IN ('DELIVERED', 'RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Retirada já confirmada anteriormente');
  END IF;

  IF COALESCE(v_order.pickup_pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada bloqueado por excesso de tentativas. Contate o estabelecimento.');
  END IF;

  IF v_order.last_pickup_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pickup_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde alguns segundos.');
  END IF;

  SELECT pickup_pin INTO v_real FROM public.order_pins WHERE order_id = p_order_id;
  v_valid := (v_real IS NOT NULL AND trim(v_real) = v_pin);

  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, COALESCE(v_caller_id, v_order.driver_id), v_valid, 'PICKUP: ' || left(COALESCE(p_device_info, ''), 190), v_now);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_valid THEN
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

  RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada inválido. Confirme o código com o estabelecimento.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, text)   TO authenticated, service_role;

-- Compatibilidade com a versão do app ainda publicada (chama com p_operator_id):
-- o parâmetro é IGNORADO e a validação segura acima é usada. Removidas na 20261002050000.
CREATE FUNCTION public.check_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_operator_id UUID,
  p_device_info TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT public.check_delivery_pin(p_order_id, p_pin, p_device_info); $$;

CREATE FUNCTION public.check_pickup_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_operator_id UUID,
  p_device_info TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT public.check_pickup_pin(p_order_id, p_pin, p_device_info); $$;

REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, uuid, text)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, uuid, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, uuid, text)   TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Leitura de PINs filtrada por papel (o app passa a usar esta função)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_order_pins_bulk(p_order_ids UUID[])
RETURNS TABLE (order_id UUID, delivery_pin TEXT, pickup_pin TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL AND auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin') INTO v_is_admin
    FROM public.users u WHERE u.id = v_caller;
  END IF;

  RETURN QUERY
  SELECT o.id,
         CASE WHEN COALESCE(v_is_admin, false) OR o.buyer_id = v_caller THEN p.delivery_pin ELSE NULL END,
         CASE WHEN COALESCE(v_is_admin, false) OR sf.partner_id = v_caller THEN p.pickup_pin ELSE NULL END
  FROM public.orders o
  JOIN public.order_pins p ON p.order_id = o.id
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  WHERE o.id = ANY(p_order_ids)
    AND (COALESCE(v_is_admin, false) OR o.buyer_id = v_caller OR sf.partner_id = v_caller)
  LIMIT 500;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_order_pins_bulk(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_order_pins_bulk(uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Repasse (settlements): alinhar com a rota e com o saque antigo
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS settlements_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_fee_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

ALTER TABLE public.settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'WAITING_ACCOUNT', 'REVIEW', 'CANCELLED'));

-- As flags novas só são lidas pelo servidor
REVOKE SELECT (settlements_enabled, activation_fee_enabled) ON public.platform_settings FROM anon, authenticated;

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

  -- Enquanto a flag estiver desligada, o saque antigo continua sendo o único caminho
  -- (evita pagar o mesmo pedido pelos dois fluxos).
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

  -- Motorista
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

DROP TRIGGER IF EXISTS trg_create_order_settlements ON public.orders;
CREATE TRIGGER trg_create_order_settlements
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_order_settlements_on_receive();

NOTIFY pgrst, 'reload schema';
