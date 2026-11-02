-- ==============================================================================
-- TESTE R39 (F1 + F1b): SCHEMA, RLS, PRIVACIDADE DAS VIEWS E BLOQUEIO DE ESCRITA
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

-- 1. Existência das tabelas e views
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partner_referrals'),
  'tabela partner_referrals existe');
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_invite_links'),
  'tabela referral_invite_links existe');
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings'),
  'tabela ratings existe');
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rating_reports'),
  'tabela rating_reports existe');
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'ratings_public'),
  'view ratings_public existe');
SELECT tests.assert(
  EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'user_rating_summary'),
  'view user_rating_summary existe');

-- 2. F1b: ratings_public NÃO expõe rater_id nem order_id
SELECT tests.assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ratings_public'
      AND column_name IN ('rater_id', 'order_id')
  ),
  'ratings_public não expõe rater_id nem order_id');

-- 3. F1b: permissões das views (anon bloqueado; authenticated e service_role com SELECT)
SELECT tests.assert(NOT has_table_privilege('anon', 'public.ratings_public', 'SELECT'), 'anon não lê ratings_public');
SELECT tests.assert(NOT has_table_privilege('anon', 'public.user_rating_summary', 'SELECT'), 'anon não lê user_rating_summary');
SELECT tests.assert(has_table_privilege('authenticated', 'public.ratings_public', 'SELECT'), 'authenticated lê ratings_public');
SELECT tests.assert(has_table_privilege('authenticated', 'public.user_rating_summary', 'SELECT'), 'authenticated lê user_rating_summary');
SELECT tests.assert(has_table_privilege('service_role', 'public.ratings_public', 'SELECT'), 'service_role lê ratings_public');
SELECT tests.assert(has_table_privilege('service_role', 'public.user_rating_summary', 'SELECT'), 'service_role lê user_rating_summary');

-- 4. Sem escrita direta em partner_referrals, referral_invite_links, ratings, rating_reports
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.partner_referrals', 'INSERT'), 'authenticated não insere em partner_referrals');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.partner_referrals', 'UPDATE'), 'authenticated não atualiza partner_referrals');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.partner_referrals', 'DELETE'), 'authenticated não apaga partner_referrals');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.referral_invite_links', 'INSERT'), 'authenticated não insere em referral_invite_links');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.ratings', 'INSERT'), 'authenticated não insere em ratings');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.ratings', 'UPDATE'), 'authenticated não atualiza ratings');
SELECT tests.assert(NOT has_table_privilege('authenticated', 'public.rating_reports', 'INSERT'), 'authenticated não insere em rating_reports');

-- 5. Sem UPDATE direto nas colunas novas de users e orders
SELECT tests.assert(NOT has_column_privilege('authenticated', 'public.users', 'dispatch_mode', 'UPDATE'), 'authenticated não atualiza users.dispatch_mode');
SELECT tests.assert(NOT has_column_privilege('authenticated', 'public.users', 'serve_mode', 'UPDATE'), 'authenticated não atualiza users.serve_mode');
SELECT tests.assert(NOT has_column_privilege('authenticated', 'public.orders', 'dispatch_mode', 'UPDATE'), 'authenticated não atualiza orders.dispatch_mode');
SELECT tests.assert(NOT has_column_privilege('authenticated', 'public.orders', 'self_delivery', 'UPDATE'), 'authenticated não atualiza orders.self_delivery');
SELECT tests.assert(NOT has_column_privilege('authenticated', 'public.orders', 'radar_open_at', 'UPDATE'), 'authenticated não atualiza orders.radar_open_at');

-- 6. Teste funcional de RLS e user_rating_summary (média só com >= 5 avaliações VISIBLE)
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.users (id, name, role) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Loja R39', 'loja'),
  ('00000000-0000-0000-0000-000000000102', 'Motoboy R39', 'motorista'),
  ('00000000-0000-0000-0000-000000000103', 'Terceiro R39', 'cliente');

-- Índice único parcial de partner_referrals (PENDING/ACTIVE)
INSERT INTO public.partner_referrals (partner_id, driver_id, flow, origin, status)
VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102', 'B2C', 'PARTNER_INVITE', 'PENDING');

DO $$ BEGIN
  BEGIN
    INSERT INTO public.partner_referrals (partner_id, driver_id, flow, origin, status)
    VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102', 'B2C', 'DRIVER_REQUEST', 'ACTIVE');
    PERFORM tests.assert(false, 'duplicidade ativa deveria falhar');
  EXCEPTION WHEN unique_violation THEN
    PERFORM tests.assert(true, 'índice único parcial impede duplicidade PENDING/ACTIVE');
  END;
END $$;

-- Terceiro não vê indicação alheia via RLS
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
SELECT tests.assert((SELECT count(*) FROM public.partner_referrals) = 0, 'terceiro não lê partner_referrals alheio');

-- Parte envolvida vê sua indicação
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
SELECT tests.assert((SELECT count(*) FROM public.partner_referrals) = 1, 'motorista lê a própria indicação');
RESET ROLE;

-- Avaliações e cálculo de user_rating_summary (mínimo 5 para exibir avg_stars)
INSERT INTO public.orders (id, buyer_id, driver_id, status, order_type) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'RECEIVED', 'B2C'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'RECEIVED', 'B2C'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'RECEIVED', 'B2C'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'RECEIVED', 'B2C'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'RECEIVED', 'B2C');

INSERT INTO public.ratings (order_id, rater_id, ratee_id, rater_role, ratee_role, stars, comment, status) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'cliente', 'motorista', 5, 'Ótimo', 'VISIBLE'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'cliente', 'motorista', 4, NULL, 'VISIBLE'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'cliente', 'motorista', 5, NULL, 'VISIBLE'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'cliente', 'motorista', 5, NULL, 'VISIBLE'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 'cliente', 'motorista', 1, 'Oculta', 'HIDDEN');

SELECT tests.assert(
  (SELECT avg_stars IS NULL AND rating_count = 4 FROM public.user_rating_summary WHERE ratee_id = '00000000-0000-0000-0000-000000000102'),
  'abaixo de 5 avaliações visíveis avg_stars é NULL e HIDDEN não entra');

UPDATE public.ratings SET status = 'VISIBLE', stars = 5 WHERE order_id = '00000000-0000-0000-0000-000000000205';

SELECT tests.assert(
  (SELECT avg_stars = 4.8 AND rating_count = 5 FROM public.user_rating_summary WHERE ratee_id = '00000000-0000-0000-0000-000000000102'),
  'com 5 avaliações visíveis avg_stars é calculado (4.8)');

-- Em ratings (tabela base), só o próprio rater_id vê suas linhas; o avaliado lê via ratings_public
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
SELECT tests.assert((SELECT count(*) FROM public.ratings) = 0, 'avaliado não lê a tabela base ratings (que tem rater_id)');
SELECT tests.assert((SELECT count(*) FROM public.ratings_public WHERE ratee_id = '00000000-0000-0000-0000-000000000102') = 5, 'avaliado lê suas 5 avaliações via ratings_public sem rater_id/order_id');
RESET ROLE;

ROLLBACK;
