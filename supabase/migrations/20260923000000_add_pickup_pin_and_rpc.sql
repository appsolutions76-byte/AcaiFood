-- ==========================================================
-- AÇAÍFOOD — SISTEMA DE DUPLO PIN (PIN DE RETIRADA & CUSTÓDIA)
-- Timestamp: 20260923000000
-- ==========================================================

-- 1. Adicionar colunas de PIN de Retirada na tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_pin TEXT,
  ADD COLUMN IF NOT EXISTS pickup_pin_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_pickup_pin_attempt_at TIMESTAMPTZ;

-- 2. Preencher pickup_pin para pedidos existentes que ainda não foram retirados se necessário
UPDATE public.orders
SET pickup_pin = lpad((floor(random() * 9000) + 1000)::text, 4, '0')
WHERE pickup_pin IS NULL AND order_type != 'COLETA';

-- 3. Função RPC para Verificação e Validação do PIN de Retirada
CREATE OR REPLACE FUNCTION public.check_pickup_pin(
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
    RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de 4 dígitos de retirada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- Se já foi retirado e está em trânsito ou entregue
  IF v_order.picked_up_at IS NOT NULL OR v_order.status IN ('DELIVERING', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Retirada já confirmada anteriormente');
  END IF;

  -- Bloqueio após 5 tentativas inválidas de PIN de retirada
  IF COALESCE(v_order.pickup_pin_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN de retirada bloqueado por excesso de tentativas. Contate o Administrador.');
  END IF;

  -- Rate limit de 3 segundos entre tentativas
  IF v_order.last_pickup_pin_attempt_at IS NOT NULL AND (v_now - v_order.last_pickup_pin_attempt_at) < interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas rápidas. Aguarde 3 segundos.');
  END IF;

  -- Validação do PIN de retirada
  IF v_order.pickup_pin IS NOT NULL AND trim(v_order.pickup_pin) = v_pin THEN
    v_is_valid := TRUE;
  END IF;

  -- Fallback de segurança: se o pedido for antigo e não tiver pickup_pin gerado, aceita delivery_pin
  IF NOT v_is_valid AND v_order.pickup_pin IS NULL AND v_order.delivery_pin IS NOT NULL AND trim(v_order.delivery_pin) = v_pin THEN
    v_is_valid := TRUE;
  END IF;

  -- Gravar auditoria em pin_attempt_log se a tabela existir
  BEGIN
    INSERT INTO public.pin_attempt_log (order_id, actor_id, success, ip_device, created_at)
    VALUES (p_order_id, COALESCE(p_operator_id, auth.uid()), v_is_valid, 'PICKUP: ' || p_device_info, v_now);
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

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Retirada confirmada com sucesso! Pedido agora em trânsito para o destino.'
    );
  ELSE
    UPDATE public.orders
    SET pickup_pin_attempts = COALESCE(pickup_pin_attempts, 0) + 1,
        last_pickup_pin_attempt_at = v_now
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'PIN de Retirada inválido. Verifique o código informado pelo estabelecimento.'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_pickup_pin TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_pickup_pin TO service_role;

NOTIFY pgrst, 'reload schema';
