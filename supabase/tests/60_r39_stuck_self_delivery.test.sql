-- ==============================================================================
-- TESTE R39 (FASE 4): PEDIDO PARADO, ABRIR PARA O APP E ENTREGA PRÓPRIA
-- ==============================================================================
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
CREATE FUNCTION tests.assert(p_ok BOOLEAN, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'ok: %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION tests.assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;

SELECT set_config('request.jwt.claim.role', 'service_role', true);

UPDATE public.platform_settings SET settlements_enabled = true;

-- Cidade 1 (Castanhal): referrals_enabled = true
-- Cidade 2 (Braganca):  referrals_enabled = false
INSERT INTO public.cities (id, name, status, referrals_enabled, ratings_enabled, b2c_stuck_order_alert_seconds) VALUES
  ('00000000-0000-0000-0000-000000000c41', 'Castanhal', 'active', true, true, 300),
  ('00000000-0000-0000-0000-000000000c42', 'Braganca',  'active', false, false, 300);

INSERT INTO public.users (id, name, role, vehicle_type, cidade, bairro, asaas_account_status, asaas_wallet_id) VALUES
  ('00000000-0000-0000-0000-000000000411', 'Loja Castanhal',    'loja',      NULL,   'Castanhal', 'Centro', 'APPROVED', 'w-411'),
  ('00000000-0000-0000-0000-000000000412', 'Moto Geral',        'motorista', 'Moto', 'Castanhal', 'Centro', 'APPROVED', 'w-412'),
  ('00000000-0000-0000-0000-000000000413', 'Cliente Castanhal', 'cliente',   NULL,   'Castanhal', 'Centro', NULL,       NULL),
  ('00000000-0000-0000-0000-000000000421', 'Loja Braganca',     'loja',      NULL,   'Braganca',  'Centro', 'APPROVED', 'w-421'),
  ('00000000-0000-0000-0000-000000000423', 'Cliente Braganca',  'cliente',   NULL,   'Braganca',  'Centro', NULL,       NULL);

INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-000000000f41', '00000000-0000-0000-0000-000000000411', 'Açaí Castanhal'),
  ('00000000-0000-0000-0000-000000000f42', '00000000-0000-0000-0000-000000000421', 'Açaí Braganca');

-- Pedidos de teste:
-- 501: Castanhal (ON), REFERRED_ONLY, READY, chamado há 360s -> testar alerta + abrir para o app
-- 502: Castanhal (ON), REFERRED_ONLY, READY, chamado há 360s -> testar bloqueio antes do alerta, alerta, entrega própria + PIN + settlements
-- 503: Castanhal (ON), COLETA em REFERRED_ONLY, READY, chamado há 360s -> tentar self_delivery deve falhar mesmo após alerta
-- 504: Braganca (OFF), REFERRED_ONLY, READY, chamado há 360s, stuck_alert_sent_at preenchido -> todas as 3 RPCs devem falhar com 'Recurso ainda não disponível na sua cidade'
-- 505: Castanhal (ON), dispatch_mode = 'ALL', READY, chamado há 360s -> todas as 3 RPCs devem falhar
-- 506: Castanhal (ON), dispatch_mode = 'REFERRED_FIRST', READY, chamado há 360s -> todas as 3 RPCs devem falhar
-- 507: Castanhal (ON), dispatch_mode = 'REFERRED_ONLY', status = 'PREPARING', stuck_alert_sent_at preenchido -> dispatch_set_self_delivery deve falhar
INSERT INTO public.orders (
  id, buyer_id, seller_storefront_id, status, order_type,
  dispatch_mode, dispatch_called_at, radar_open_at, stuck_alert_sent_at, self_delivery,
  seller_payout_amount, driver_payout_amount
) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000f41', 'READY',     'B2C',    'REFERRED_ONLY',  now() - interval '360 seconds', NULL, NULL,                          false, 40.00, 10.00),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000f41', 'READY',     'B2C',    'REFERRED_ONLY',  now() - interval '360 seconds', NULL, NULL,                          false, 40.00, 10.00),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000411', NULL,                                   'READY',     'COLETA', 'REFERRED_ONLY',  now() - interval '360 seconds', NULL, now() - interval '10 seconds', false, 0.00,  35.00),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000f42', 'READY',     'B2C',    'REFERRED_ONLY',  now() - interval '360 seconds', NULL, now() - interval '10 seconds', false, 40.00, 10.00),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000f41', 'READY',     'B2C',    'ALL',            now() - interval '360 seconds', now() - interval '360 seconds', now() - interval '10 seconds', false, 40.00, 10.00),
  ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000f41', 'READY',     'B2C',    'REFERRED_FIRST', now() - interval '360 seconds', now() - interval '180 seconds', now() - interval '10 seconds', false, 40.00, 10.00),
  ('00000000-0000-0000-0000-000000000507', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000f41', 'PREPARING', 'B2C',    'REFERRED_ONLY',  now() - interval '360 seconds', NULL, now() - interval '10 seconds', false, 40.00, 10.00);

INSERT INTO public.order_pins (order_id, delivery_pin, pickup_pin) VALUES
  ('00000000-0000-0000-0000-000000000501', '1234', '5678'),
  ('00000000-0000-0000-0000-000000000502', '4321', '8765');

-- ==============================================================================
-- CASO (a): Chave da cidade desligada (Bragança, pedido 504)
-- Nenhuma das 3 RPCs pode funcionar; erro deve ser 'Recurso ainda não disponível na sua cidade'
-- ==============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000421', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
DECLARE
  r1 JSONB;
  r2 JSONB;
  r3 JSONB;
  v_self BOOLEAN;
BEGIN
  r1 := public.dispatch_mark_stuck_alert_sent('00000000-0000-0000-0000-000000000504');
  PERFORM tests.assert(
    (r1->>'success')::boolean = false AND (r1->>'error') = 'Recurso ainda não disponível na sua cidade',
    '(a) dispatch_mark_stuck_alert_sent bloqueado com chave da cidade desligada'
  );

  r2 := public.dispatch_open_order_to_app('00000000-0000-0000-0000-000000000504');
  PERFORM tests.assert(
    (r2->>'success')::boolean = false AND (r2->>'error') = 'Recurso ainda não disponível na sua cidade',
    '(a) dispatch_open_order_to_app bloqueado com chave da cidade desligada'
  );

  r3 := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000504');
  PERFORM tests.assert(
    (r3->>'success')::boolean = false AND (r3->>'error') = 'Recurso ainda não disponível na sua cidade',
    '(a) dispatch_set_self_delivery bloqueado com chave da cidade desligada'
  );

  SELECT self_delivery INTO v_self FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000504';
  PERFORM tests.assert(v_self = false, '(a) Com a chave desligada, NENHUM pedido pode virar self_delivery');
END $$;

-- ==============================================================================
-- CASO (b): Pedido com dispatch_mode != 'REFERRED_ONLY' (505 = ALL, 506 = REFERRED_FIRST)
-- ==============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000411', true);
DO $$
DECLARE
  r_all_alert JSONB;
  r_all_open  JSONB;
  r_all_self  JSONB;
  r_rf_alert  JSONB;
  r_rf_open   JSONB;
  r_rf_self   JSONB;
BEGIN
  r_all_alert := public.dispatch_mark_stuck_alert_sent('00000000-0000-0000-0000-000000000505');
  r_all_open  := public.dispatch_open_order_to_app('00000000-0000-0000-0000-000000000505');
  r_all_self  := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000505');
  PERFORM tests.assert(
    (r_all_alert->>'success')::boolean = false
    AND (r_all_open->>'success')::boolean = false
    AND (r_all_self->>'success')::boolean = false,
    '(b) Pedido em modo ALL não aceita alerta nem abrir p/ app nem entrega própria'
  );

  r_rf_alert := public.dispatch_mark_stuck_alert_sent('00000000-0000-0000-0000-000000000506');
  r_rf_open  := public.dispatch_open_order_to_app('00000000-0000-0000-0000-000000000506');
  r_rf_self  := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000506');
  PERFORM tests.assert(
    (r_rf_alert->>'success')::boolean = false
    AND (r_rf_open->>'success')::boolean = false
    AND (r_rf_self->>'success')::boolean = false,
    '(b) Pedido em modo REFERRED_FIRST não aceita alerta nem abrir p/ app nem entrega própria'
  );
END $$;

-- ==============================================================================
-- CASO (c): dispatch_set_self_delivery exige status READY/SEARCHING_OPERATOR (não PREPARING)
--           e exige stuck_alert_sent_at IS NOT NULL (só depois do alerta)
-- ==============================================================================
DO $$
DECLARE
  r_prep      JSONB;
  r_no_alert  JSONB;
BEGIN
  -- 507 está em PREPARING (mesmo com stuck_alert_sent_at não nulo)
  r_prep := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000507');
  PERFORM tests.assert(
    (r_prep->>'success')::boolean = false,
    '(c) dispatch_set_self_delivery rejeita pedido em status PREPARING'
  );

  -- 502 está em READY e REFERRED_ONLY, mas ainda com stuck_alert_sent_at IS NULL
  r_no_alert := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000502');
  PERFORM tests.assert(
    (r_no_alert->>'success')::boolean = false,
    '(c) dispatch_set_self_delivery rejeita pedido antes do alerta (stuck_alert_sent_at IS NULL)'
  );
END $$;

-- ==============================================================================
-- FLUXO COMPLETO:
-- 1. Antes de abrir para o app, Moto Geral (412, não indicado) NÃO vê 501
-- ==============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000412', true);
DO $$ DECLARE n INT; BEGIN
  SELECT count(*) INTO n FROM public.get_driver_radar() WHERE id = '00000000-0000-0000-0000-000000000501';
  PERFORM tests.assert(n = 0, 'Moto Geral não vê pedido REFERRED_ONLY antes de abrir para o app');
END $$;

-- 2. Loja marca alerta de pedido parado e depois abre 501 para o app
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000411', true);
DO $$
DECLARE
  r_alert JSONB;
  r_open JSONB;
BEGIN
  r_alert := public.dispatch_mark_stuck_alert_sent('00000000-0000-0000-0000-000000000501');
  PERFORM tests.assert((r_alert->>'success')::boolean = true AND (r_alert->>'already_sent')::boolean = false,
    'dispatch_mark_stuck_alert_sent grava stuck_alert_sent_at na primeira chamada');

  r_open := public.dispatch_open_order_to_app('00000000-0000-0000-0000-000000000501');
  PERFORM tests.assert((r_open->>'success')::boolean = true,
    'dispatch_open_order_to_app abre pedido para todos do app');
END $$;

-- Agora Moto Geral vê 501 no radar
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000412', true);
DO $$ DECLARE n INT; BEGIN
  SELECT count(*) INTO n FROM public.get_driver_radar() WHERE id = '00000000-0000-0000-0000-000000000501';
  PERFORM tests.assert(n = 1, 'Moto Geral passa a ver 501 após dispatch_open_order_to_app');
END $$;

-- 3. Em Coleta (503), tentar dispatch_set_self_delivery falha
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000411', true);
DO $$
DECLARE
  r_col JSONB;
BEGIN
  r_col := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000503');
  PERFORM tests.assert((r_col->>'success')::boolean = false,
    'Coleta de resíduos não permite entrega por conta própria');
END $$;

-- 4. Em B2C (502): loja primeiro marca o alerta -> depois ativa self_delivery -> Loja valida PIN de entrega -> NÃO cria settlement de driver
DO $$
DECLARE
  r_alert2 JSONB;
  r_self   JSONB;
  r_wrong  JSONB;
BEGIN
  r_alert2 := public.dispatch_mark_stuck_alert_sent('00000000-0000-0000-0000-000000000502');
  PERFORM tests.assert((r_alert2->>'success')::boolean = true,
    'Loja registra stuck_alert_sent_at no pedido 502');

  r_self := public.dispatch_set_self_delivery('00000000-0000-0000-0000-000000000502');
  PERFORM tests.assert((r_self->>'success')::boolean = true,
    'Loja ativa self_delivery no pedido 502 após o alerta');

  -- Loja tenta PIN errado -> conta tentativa 1 de 5
  r_wrong := public.check_delivery_pin('00000000-0000-0000-0000-000000000502', '0000', 'Teste Loja');
  PERFORM tests.assert((r_wrong->>'success')::boolean = false AND (r_wrong->>'error') LIKE '%Tentativa 1 de 5%',
    'PIN errado na entrega própria contabiliza tentativa 1 de 5');
END $$;
RESET ROLE;

-- Limpar last_pin_attempt_at para não esperar 3s no teste e validar PIN correto pela loja
SELECT set_config('request.jwt.claim.role', 'service_role', true);
UPDATE public.orders SET last_pin_attempt_at = now() - interval '10 seconds' WHERE id = '00000000-0000-0000-0000-000000000502';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000411', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
DECLARE
  r_ok JSONB;
BEGIN
  r_ok := public.check_delivery_pin('00000000-0000-0000-0000-000000000502', '4321', 'Teste Loja');
  PERFORM tests.assert((r_ok->>'success')::boolean = true AND r_ok->>'status' = 'RECEIVED',
    'Loja confirma entrega própria com o PIN de 4 dígitos do cliente');
END $$;
RESET ROLE;

SELECT tests.assert(
  EXISTS (
    SELECT 1 FROM public.settlements
     WHERE order_id = '00000000-0000-0000-0000-000000000502' AND role = 'seller'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.settlements
     WHERE order_id = '00000000-0000-0000-0000-000000000502' AND role = 'driver'
  ),
  'Settlement do vendedor é criado e NENHUM settlement de motorista é criado quando self_delivery = true'
);

ROLLBACK;
