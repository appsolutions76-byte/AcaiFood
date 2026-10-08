-- Vitrine pública de lojas para visitante (migration 20261008010000).
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

-- Dados criados pelo servidor (o gatilho do R16 limpa campos financeiros vindos do app)
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.users (id, name, role, cpf_cnpj, pix_key, email, phone, endereco, bairro, cidade, status, asaas_wallet_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Loja Aberta', 'PARTNER', '55566677788', 'pix-a', 'a@teste.com', '91999990000', 'Rua X, 10', 'Nazaré', 'Belém', 'active', 'wallet-a'),
  ('00000000-0000-0000-0000-0000000000a2', 'Loja Bloqueada', 'loja', '55566677799', 'pix-b', 'b@teste.com', '91999990001', 'Rua Y, 20', 'Marco', 'Belém', 'blocked', NULL),
  ('00000000-0000-0000-0000-0000000000a3', 'Cliente', 'cliente', '11122233344', 'pix-c', 'c@teste.com', '91999990002', 'Rua Z, 30', 'Umarizal', 'Belém', 'active', NULL);
INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Açaí Teste');
INSERT INTO public.products (storefront_id, name, price) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'Açaí Grosso', 35);

SELECT set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;
DO $$
DECLARE
  v JSONB := public.get_public_stores();
  s TEXT := public.get_public_stores()::text;
BEGIN
  PERFORM tests.assert(jsonb_array_length(v) = 1, 'visitante vê só a loja não bloqueada');
  PERFORM tests.assert(v->0->>'name' = 'Loja Aberta', 'loja certa');
  PERFORM tests.assert(v->0->'storefronts'->0->>'store_name' = 'Açaí Teste', 'traz a vitrine');
  PERFORM tests.assert(jsonb_array_length(v->0->'storefronts'->0->'products') = 1, 'traz os produtos');
  PERFORM tests.assert(v->0->>'asaas_wallet_id' = 'wallet-a', 'traz o walletId para o filtro da vitrine');
  PERFORM tests.assert(position('55566677788' in s) = 0, 'sem CPF/CNPJ');
  PERFORM tests.assert(position('a@teste.com' in s) = 0, 'sem e-mail');
  PERFORM tests.assert(position('91999990000' in s) = 0, 'sem telefone');
  PERFORM tests.assert(position('Rua X' in s) = 0, 'sem endereço');
  PERFORM tests.assert(position('pix-a' in s) = 0, 'sem chave Pix');
  PERFORM tests.assert(position('Cliente' in s) = 0, 'não lista clientes');
END $$;
RESET ROLE;

SELECT tests.assert(NOT has_table_privilege('anon', 'public.users', 'SELECT'), 'users continua fechado para anon');

ROLLBACK;
