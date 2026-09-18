-- Migration: Fix PIN Validation Trigger and RPC Function
-- Problem: check_delivery_pin RPC function omitted provided_pin in its UPDATE orders statement,
-- causing validate_delivery_pin_trigger to throw 'Acesso negado: PIN de segurança incorreto ou ausente'
-- even when the correct PIN was entered.

CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
      IF NEW.provided_pin IS NULL OR (
        (OLD.delivery_pin IS NULL OR trim(NEW.provided_pin) != trim(OLD.delivery_pin))
        AND (OLD.pin_hash IS NULL OR crypt(trim(NEW.provided_pin), OLD.pin_hash) != OLD.pin_hash)
      ) THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança incorreto ou ausente.';
      END IF;
    END IF;
  END IF;
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders;
CREATE TRIGGER check_delivery_pin
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_pin_trigger();

CREATE OR REPLACE FUNCTION public.check_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_operator_id UUID DEFAULT NULL,
  p_device_info TEXT DEFAULT 'App Client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order RECORD;
  v_pin TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_pin := trim(COALESCE(p_pin, ''));

  IF length(v_pin) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de 4 dígitos');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.status = 'RECEIVED' OR v_order.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Pedido já confirmado anteriormente');
  END IF;

  IF v_order.status = 'PIN_LOCKED' OR v_order.pin_attempts >= 5 THEN
    UPDATE public.orders SET status = 'PIN_LOCKED' WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'PIN bloqueado por excesso de tentativas. Contate o Administrador.');
  END IF;

  IF v_order.last_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pin_attempt_at) < interval '5 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde 5 segundos.');
  END IF;

  -- 1. Comparação direta com o PIN de 4 dígitos do pedido
  IF v_order.delivery_pin IS NOT NULL AND trim(v_order.delivery_pin) = v_pin THEN
    v_is_valid := TRUE;
  END IF;

  -- 2. Comparação com hash se necessário
  IF NOT v_is_valid AND v_order.pin_hash IS NOT NULL THEN
    BEGIN
      IF crypt(v_pin, v_order.pin_hash) = v_order.pin_hash THEN
        v_is_valid := TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Gravar auditoria em pin_attempt_log
  INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
  VALUES (p_order_id, COALESCE(p_operator_id, auth.uid()), v_is_valid, p_device_info, v_now);

  IF v_is_valid THEN
    UPDATE public.orders
    SET status = 'RECEIVED',
        received_at = v_now,
        last_pin_attempt_at = v_now,
        pin_attempts = 0,
        provided_pin = v_pin,
        asaas_transfer_status = 'READY_TO_RELEASE'
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
    VALUES (p_order_id, v_order.status, 'RECEIVED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'PIN validado com sucesso na entrega');

    UPDATE public.splits
    SET status = 'RELEASED', released_at = v_now
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'status', 'RECEIVED');
  ELSE
    IF (v_order.pin_attempts + 1) >= 5 THEN
      UPDATE public.orders
      SET pin_attempts = v_order.pin_attempts + 1,
          last_pin_attempt_at = v_now,
          status = 'PIN_LOCKED'
      WHERE id = p_order_id;

      INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
      VALUES (p_order_id, v_order.status, 'PIN_LOCKED', COALESCE(p_operator_id, auth.uid()), 'OPERATOR', 'Bloqueio automático após 5 tentativas de PIN');

      RETURN jsonb_build_object('success', false, 'error', 'PIN incorreto. Limite de 5 tentativas excedido. Pedido bloqueado.');
    ELSE
      UPDATE public.orders
      SET pin_attempts = v_order.pin_attempts + 1,
          last_pin_attempt_at = v_now
      WHERE id = p_order_id;

      RETURN jsonb_build_object('success', false, 'error', format('PIN incorreto. Tentativa %s de 5.', v_order.pin_attempts + 1));
    END IF;
  END IF;
END;
$$;
