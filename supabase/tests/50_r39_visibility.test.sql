-- ==============================================================================
-- TESTE R39 (FASE 2): RPCS DE INDICAÇÃO, DESPACHO E MATRIZ DE VISIBILIDADE/ACEITE
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

-- Cidades: Belém (referrals_enabled = false inicialmente) e Ananindeua (referrals_enabled = true)
INSERT INTO public.cities (id, name, status, referrals_enabled, ratings_enabled, b2c_referred_exclusive_seconds) VALUES
  ('00000000-0000-0000-0000-000000000c01', 'Belém', 'active', false, false, 180),
  ('00000000-0000-0000-0000-000000000c02', 'Ananindeua', 'active', true, true, 180);

-- Usuários de teste
INSERT INTO public.users (id, name, role, vehicle_type, cidade, bairro, asaas_account_status, asaas_wallet_id) VALUES
  ('00000000-0000-0000-0000-000000000301', 'Loja Belém Desligada', 'loja', NULL, 'Belém', 'Nazaré', 'APPROVED', 'w-301'),
  ('00000000-0000-0000-0000-000000000302', 'Loja Ananindeua', 'loja', NULL, 'Ananindeua', 'Centro', 'APPROVED', 'w-302'),
  ('00000000-0000-0000-0000-000000000303', 'Loja 2 Ananindeua', 'loja', NULL, 'Ananindeua', 'Coqueiro', 'APPROVED', 'w-303'),
  ('00000000-0000-0000-0000-000000000304', 'Moto Indicado', 'motorista', 'Moto', 'Ananindeua', 'Centro', 'APPROVED', 'w-304'),
  ('00000000-0000-0000-0000-000000000305', 'Moto Avulso', 'motorista', 'Moto', 'Ananindeua', 'Centro', 'APPROVED', 'w-305'),
  ('00000000-0000-0000-0000-000000000306', 'Caminhoneiro B2B', 'caminhao', 'Caminhao', 'Ananindeua', 'Centro', 'APPROVED', 'w-306'),
  ('00000000-0000-0000-0000-000000000307', 'Cliente Teste', 'cliente', NULL, 'Ananindeua', 'Centro', NULL, NULL);

INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000301', 'Açaí Belém'),
  ('00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-000000000302', 'Açaí Ananindeua'),
  ('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000303', 'Açaí Coqueiro');

-- 1. Cidade com referrals_enabled = false retorna mensagem amigável
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r JSONB; BEGIN
  r := public.referral_create_invite_link('B2C');
  PERFORM tests.assert((r->>'success')::boolean = false AND r->>'error' = 'Recurso ainda não disponível na sua cidade',
    'RPC bloqueia cidade com referrals_enabled = false');
END $$;

-- 2. Fluxo de convite por link (loja cria -> motorista lê -> caminhão tenta aceitar B2C e falha -> motoboy aceita -> ACTIVE)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
DO $$
DECLARE
  r_create JSONB;
  v_tok TEXT;
  r_info JSONB;
  r_truck JSONB;
  r_accept JSONB;
BEGIN
  r_create := public.referral_create_invite_link('B2C');
  PERFORM tests.assert((r_create->>'success')::boolean = true AND length(r_create->>'token') = 64,
    'loja cria link de convite B2C com token de 64 hex chars');
  v_tok := r_create->>'token';

  r_info := public.referral_get_invite(v_tok);
  PERFORM tests.assert((r_info->>'success')::boolean = true AND r_info->>'partner_name' = 'Açaí Ananindeua',
    'referral_get_invite retorna nome da loja');

  -- Caminhoneiro não pode aceitar convite B2C
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000306', true);
  r_truck := public.referral_accept_invite(v_tok);
  PERFORM tests.assert((r_truck->>'success')::boolean = false, 'caminhoneiro não aceita convite B2C');

  -- Motoboy aceita convite B2C -> já nasce ACTIVE
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
  r_accept := public.referral_accept_invite(v_tok);
  PERFORM tests.assert((r_accept->>'success')::boolean = true AND r_accept->>'status' = 'ACTIVE',
    'motoboy aceita convite B2C e indicação fica ACTIVE');
END $$;

-- 3. Fluxo de pedido de indicação pelo motorista (referral_request -> só a loja responde)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
DO $$
DECLARE
  r_req JSONB;
  v_ref_id UUID;
  r_self_resp JSONB;
  r_store_resp JSONB;
  r_rem JSONB;
BEGIN
  r_req := public.referral_request('00000000-0000-0000-0000-000000000303', 'B2C');
  PERFORM tests.assert((r_req->>'success')::boolean = true AND r_req->>'status' = 'PENDING',
    'motoboy pede indicação à Loja 2 (PENDING)');
  v_ref_id := (r_req->>'referral_id')::uuid;

  -- O próprio motorista que pediu NÃO pode aprovar o próprio pedido
  r_self_resp := public.referral_respond(v_ref_id, true);
  PERFORM tests.assert((r_self_resp->>'success')::boolean = false,
    'quem enviou o pedido não pode aprovar a própria solicitação');

  -- A Loja 2 (que recebeu) aprova
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
  r_store_resp := public.referral_respond(v_ref_id, true);
  PERFORM tests.assert((r_store_resp->>'success')::boolean = true AND r_store_resp->>'status' = 'ACTIVE',
    'loja aprova solicitação de indicação');

  -- Remover indicação da Loja 2 para isolar a matriz na Loja 1 (302)
  r_rem := public.referral_remove(v_ref_id);
  PERFORM tests.assert((r_rem->>'success')::boolean = true AND r_rem->>'status' = 'REMOVED',
    'remoção de indicação funciona sem justificativa');
END $$;
RESET ROLE;

-- 4. MATRIZ DE VISIBILIDADE E ACEITE (2.5)
-- Pedidos da Loja 1 (302, onde 304 é indicado ativo e 305 NÃO é indicado) e da Loja 2 (303, onde ninguém é indicado):
-- O1: ALL (aberto imediatamente)
-- O2: REFERRED_FIRST dentro do tempo exclusivo (radar_open_at no futuro: +3 min)
-- O3: REFERRED_FIRST após o tempo exclusivo (radar_open_at no passado: -1 min)
-- O4: REFERRED_ONLY (radar_open_at IS NULL)
-- O5: Pedido da Loja 2 em ALL (para testar serve_mode = SELECTED do Moto Indicado 304)
-- O6: Pedido com self_delivery = true (não aparece para ninguém)
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.orders (id, buyer_id, seller_storefront_id, status, order_type, dispatch_mode, dispatch_called_at, radar_open_at, self_delivery) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f02', 'READY', 'B2C', 'ALL', now(), now() - interval '5 seconds', false),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f02', 'READY', 'B2C', 'REFERRED_FIRST', now(), now() + interval '180 seconds', false),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f02', 'READY', 'B2C', 'REFERRED_FIRST', now() - interval '200 seconds', now() - interval '20 seconds', false),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f02', 'READY', 'B2C', 'REFERRED_ONLY', now(), NULL, false),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f03', 'READY', 'B2C', 'ALL', now(), now() - interval '5 seconds', false),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000f02', 'READY', 'B2C', 'REFERRED_ONLY', now(), NULL, true);

-- Caso A: Moto Avulso (305, não indicado, serve_mode = ALL)
-- Deve ver apenas O1 (401), O3 (403, REFERRED_FIRST já vencido) e O5 (405). NÃO vê O2 (402), O4 (404) nem O6 (406).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
DECLARE
  v_ids UUID[];
  r_acc JSONB;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.get_driver_radar();
  PERFORM tests.assert(
    v_ids = ARRAY[
      '00000000-0000-0000-0000-000000000401'::uuid,
      '00000000-0000-0000-0000-000000000403'::uuid,
      '00000000-0000-0000-0000-000000000405'::uuid
    ],
    'Moto Avulso (ALL) vê só ALL + REFERRED_FIRST após o tempo (não vê REFERRED_ONLY nem durante exclusividade)');

  -- Tentar aceitar O4 (REFERRED_ONLY) direto pela RPC -> bloqueado!
  r_acc := public.accept_order_atomic('00000000-0000-0000-0000-000000000404');
  PERFORM tests.assert((r_acc->>'success')::boolean = false,
    'Moto Avulso chamando accept_order_atomic direto NÃO aceita pedido REFERRED_ONLY');

  -- Tentar aceitar O2 (REFERRED_FIRST antes do tempo) direto pela RPC -> bloqueado!
  r_acc := public.accept_order_atomic('00000000-0000-0000-0000-000000000402');
  PERFORM tests.assert((r_acc->>'success')::boolean = false,
    'Moto Avulso chamando accept_order_atomic direto NÃO aceita REFERRED_FIRST antes do tempo');
END $$;

-- Caso B: Moto Indicado (304, serve_mode = ALL)
-- Deve ver O1 (401), O2 (402), O3 (403), O4 (404) e O5 (405). NÃO vê O6 (406, self_delivery).
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
DO $$
DECLARE
  v_ids UUID[];
  r_mode JSONB;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.get_driver_radar();
  PERFORM tests.assert(
    v_ids = ARRAY[
      '00000000-0000-0000-0000-000000000401'::uuid,
      '00000000-0000-0000-0000-000000000402'::uuid,
      '00000000-0000-0000-0000-000000000403'::uuid,
      '00000000-0000-0000-0000-000000000404'::uuid,
      '00000000-0000-0000-0000-000000000405'::uuid
    ],
    'Moto Indicado (serve_mode=ALL) vê todos os pedidos da loja que o indicou + radar geral, exceto self_delivery');

  -- Caso C: Moto Indicado muda serve_mode para SELECTED -> deixa de ver O5 (405, da Loja 2 que não o indicou)
  r_mode := public.driver_set_serve_mode('SELECTED');
  PERFORM tests.assert((r_mode->>'success')::boolean = true, 'driver_set_serve_mode(SELECTED) funciona');

  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.get_driver_radar();
  PERFORM tests.assert(
    v_ids = ARRAY[
      '00000000-0000-0000-0000-000000000401'::uuid,
      '00000000-0000-0000-0000-000000000402'::uuid,
      '00000000-0000-0000-0000-000000000403'::uuid,
      '00000000-0000-0000-0000-000000000404'::uuid
    ],
    'Moto Indicado (serve_mode=SELECTED) vê apenas pedidos de lojas com indicação ativa e driver_serves=true');
END $$;

-- Caso D: Moto Indicado aceita O4 (REFERRED_ONLY) -> grava assigned_via_referral = true
DO $$
DECLARE
  r_acc JSONB;
BEGIN
  r_acc := public.accept_order_atomic('00000000-0000-0000-0000-000000000404');
  PERFORM tests.assert(
    (r_acc->>'success')::boolean = true AND (r_acc->>'assigned_via_referral')::boolean = true,
    'Moto Indicado aceita pedido REFERRED_ONLY com assigned_via_referral = true');
END $$;
RESET ROLE;

SELECT tests.assert(
  (SELECT assigned_via_referral = true AND driver_id = '00000000-0000-0000-0000-000000000304'
     FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000404'),
  'orders.assigned_via_referral gravado como true no banco');

ROLLBACK;
