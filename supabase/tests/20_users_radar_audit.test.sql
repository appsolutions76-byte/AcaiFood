-- Privacidade de users, campos financeiros, radar e log de admin (migration 20261006030000).
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

INSERT INTO public.users (id, name, role, cpf_cnpj, pix_key, birth_date, email, bairro, asaas_account_status) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Comprador', 'cliente', '11122233344', 'pix-b', '1990-01-01', 'b@teste.com', 'Umarizal', NULL),
  ('00000000-0000-0000-0000-0000000000c1', 'Loja', 'loja', '55566677788', 'pix-c', '1985-05-05', 'c@teste.com', 'Nazaré', 'PENDING_DOCUMENTS'),
  ('00000000-0000-0000-0000-0000000000d1', 'Motorista', 'motorista', '99988877766', 'pix-d', '1995-09-09', 'd@teste.com', 'Marco', NULL);
INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-0000000000c1', 'Loja Teste');
INSERT INTO public.orders (id, buyer_id, seller_storefront_id, status, order_type, delivery_lat, delivery_lng, delivery_bairro) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000005f', 'READY', 'B2C', -1.4558321, -48.4902245, 'Umarizal');

-- Coluna sem default APPROVED
SELECT tests.assert(
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'asaas_account_status') IS NULL,
  'asaas_account_status sem default APPROVED');

-- anon não lê users
SELECT tests.assert(NOT has_table_privilege('anon', 'public.users', 'SELECT'), 'anon não lê users');

-- Cliente não lê dados sensíveis de outro usuário
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ BEGIN
  BEGIN PERFORM cpf_cnpj FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000c1';
    PERFORM tests.assert(false, 'cliente não deveria ler cpf_cnpj');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, 'cliente não lê cpf_cnpj de outro'); END;
  BEGIN PERFORM pix_key FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000c1';
    PERFORM tests.assert(false, 'cliente não deveria ler pix_key');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, 'cliente não lê pix_key de outro'); END;
  BEGIN PERFORM birth_date FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000c1';
    PERFORM tests.assert(false, 'cliente não deveria ler birth_date');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, 'cliente não lê birth_date de outro'); END;
  PERFORM tests.assert((SELECT name FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000c1') = 'Loja', 'cliente lê nome público da loja');
END $$;

-- O próprio perfil completo via RPC
DO $$ DECLARE j JSONB; BEGIN
  j := public.get_my_profile_json();
  PERFORM tests.assert(j->>'cpf_cnpj' = '11122233344', 'get_my_profile_json devolve o próprio CPF');
  PERFORM tests.assert(NOT (j ? 'asaas_account_api_key'), 'get_my_profile_json sem chave da subconta');
END $$;

-- Cliente não aprova a própria subconta
UPDATE public.users SET asaas_account_status = 'APPROVED', split_enabled = true, name = 'Comprador 2'
WHERE id = '00000000-0000-0000-0000-0000000000b1';
RESET ROLE;
SELECT tests.assert(
  (SELECT asaas_account_status IS NULL AND split_enabled = false AND name = 'Comprador 2' FROM public.users WHERE id = '00000000-0000-0000-0000-0000000000b1'),
  'cliente muda o nome mas não a situação da subconta');

-- Radar: sem dados do cliente, coordenadas com 2 casas
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r RECORD; n INT; BEGIN
  SELECT count(*) INTO n FROM public.get_driver_radar();
  PERFORM tests.assert(n = 1, 'radar mostra o pedido pronto');
  SELECT * INTO r FROM public.get_driver_radar() LIMIT 1;
  PERFORM tests.assert(r.origin_name = 'Loja Teste', 'radar usa store_name');
  PERFORM tests.assert(r.approx_lat = -1.46 AND r.approx_lng = -48.49, 'radar com coordenadas aproximadas');
END $$;
RESET ROLE;
SELECT tests.assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public' AND r.routine_name = 'get_driver_radar'
      AND p.parameter_name IN ('buyer_name', 'buyer_phone', 'delivery_address', 'cpf_cnpj')
  ), 'radar não devolve nome, telefone ou endereço do cliente');
SELECT tests.assert(NOT has_function_privilege('anon', 'public.get_driver_radar()', 'EXECUTE'), 'anon não usa o radar');

-- Log de admin: só inclusão (nem service_role apaga)
INSERT INTO public.admin_audit_log (action, target_type, target_id) VALUES ('TEST', 'TEST', '1');
DO $$ BEGIN
  BEGIN UPDATE public.admin_audit_log SET action = 'X';
    PERFORM tests.assert(false, 'UPDATE no log deveria falhar');
  EXCEPTION WHEN raise_exception THEN PERFORM tests.assert(true, 'log de admin não aceita UPDATE'); END;
  BEGIN DELETE FROM public.admin_audit_log;
    PERFORM tests.assert(false, 'DELETE no log deveria falhar');
  EXCEPTION WHEN raise_exception THEN PERFORM tests.assert(true, 'log de admin não aceita DELETE'); END;
END $$;

-- Cópia da configuração antiga para platform_config
SELECT tests.assert((SELECT (value->>'activationFee')::numeric FROM public.platform_config WHERE key = 'activation') = 29.9, 'taxa de ativação copiada');
SELECT tests.assert((SELECT (value->>'freeQuota')::int FROM public.platform_config WHERE key = 'activation') = 50, 'cota de fundadores copiada');
SELECT tests.assert((SELECT value->>'whatsappNumber' FROM public.platform_config WHERE key = 'support') = '5591000000000', 'config do suporte copiada');

-- platform_config e monthly_sla só para service_role
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.platform_config', 'SELECT'), 'platform_config fechado para usuários');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.monthly_sla', 'SELECT'), 'monthly_sla fechado para usuários');
DO $$ BEGIN
  BEGIN INSERT INTO public.monthly_sla (month, uptime_percent, source) VALUES ('2026-13', 99.9, 'x');
    PERFORM tests.assert(false, 'mês inválido deveria falhar');
  EXCEPTION WHEN check_violation THEN PERFORM tests.assert(true, 'monthly_sla recusa mês inválido'); END;
END $$;

ROLLBACK;
