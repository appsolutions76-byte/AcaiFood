-- ==============================================================================
-- TESTE R39 (FASE 6): AVALIAÇÕES 1 A 5 ESTRELAS, DENÚNCIAS E MODERAÇÃO
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

UPDATE public.platform_settings
   SET rating_window_days = 7,
       rating_min_count_display = 3,
       rating_comments_enabled = true;

-- Cidade 1 (Ananindeua): ratings_enabled = true
-- Cidade 2 (Barcarena):  ratings_enabled = false
INSERT INTO public.cities (id, name, status, referrals_enabled, ratings_enabled) VALUES
  ('00000000-0000-0000-0000-000000000c61', 'Ananindeua', 'active', true, true),
  ('00000000-0000-0000-0000-000000000c62', 'Barcarena',  'active', false, false);

INSERT INTO public.users (id, name, role, vehicle_type, cidade, bairro, is_admin) VALUES
  ('00000000-0000-0000-0000-000000000600', 'Admin R39',          'admin',      NULL,       'Ananindeua', 'Centro', true),
  ('00000000-0000-0000-0000-000000000611', 'Loja Ananindeua',    'loja',       NULL,       'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000612', 'Moto Ananindeua',    'motorista',  'Moto',     'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000613', 'Cliente Ananindeua', 'cliente',    NULL,       'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000614', 'Fornecedor B2B',     'fornecedor', NULL,       'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000615', 'Caminhoneiro B2B',   'caminhao',   'Caminhão', 'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000619', 'Estranho',           'cliente',    NULL,       'Ananindeua', 'Centro', false),
  ('00000000-0000-0000-0000-000000000621', 'Loja Barcarena',     'loja',       NULL,       'Barcarena',  'Centro', false),
  ('00000000-0000-0000-0000-000000000623', 'Cliente Barcarena',  'cliente',    NULL,       'Barcarena',  'Centro', false);

INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-000000000f61', '00000000-0000-0000-0000-000000000611', 'Açaí Ananindeua'),
  ('00000000-0000-0000-0000-000000000f64', '00000000-0000-0000-0000-000000000614', 'Usina Ananindeua'),
  ('00000000-0000-0000-0000-000000000f62', '00000000-0000-0000-0000-000000000621', 'Açaí Barcarena');

-- Pedidos:
-- 701: B2C concluído (RECEIVED) em Ananindeua (ratings ON) com motorista 612
-- 702: B2C concluído (RECEIVED) em Barcarena (ratings OFF)
-- 703: B2C ainda em READY em Ananindeua
-- 704: B2C concluído com self_delivery = true em Ananindeua
-- 705: B2C concluído há 10 dias (fora da janela de 7 dias)
-- 706: B2B concluído (Loja 611 comprou do Fornecedor 614 com Caminhoneiro 615)
-- 707: COLETA concluída (Loja 611 com Caçamba 615)
INSERT INTO public.orders (
  id, buyer_id, seller_storefront_id, driver_id, status, order_type,
  self_delivery, received_at, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000f61', '00000000-0000-0000-0000-000000000612', 'RECEIVED', 'B2C',    false, now() - interval '1 hour',  now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000623', '00000000-0000-0000-0000-000000000f62', NULL,                                   'RECEIVED', 'B2C',    false, now() - interval '1 hour',  now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000f61', '00000000-0000-0000-0000-000000000612', 'READY',    'B2C',    false, NULL,                       now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000f61', '00000000-0000-0000-0000-000000000612', 'RECEIVED', 'B2C',    true,  now() - interval '1 hour',  now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000f61', '00000000-0000-0000-0000-000000000612', 'RECEIVED', 'B2C',    false, now() - interval '10 days', now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000f64', '00000000-0000-0000-0000-000000000615', 'RECEIVED', 'B2B',    false, now() - interval '1 hour',  now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000611', NULL,                                   '00000000-0000-0000-0000-000000000615', 'RECEIVED', 'COLETA', false, now() - interval '1 hour',  now() - interval '2 hours');

-- 1. Cidade com ratings_enabled = false (Barcarena, pedido 702) -> bloqueia
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000623', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
DECLARE
  r JSONB;
BEGIN
  r := public.rating_submit('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000621', 5, 'Ótimo');
  PERFORM tests.assert(
    (r->>'success')::boolean = false AND (r->>'error') = 'Recurso ainda não disponível na sua cidade',
    'rating_submit bloqueado quando ratings_enabled = false na cidade'
  );
END $$;

-- 2. Pedido não concluído (703 em READY) e pedido fora da janela de 7 dias (705) -> bloqueia
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000613', true);
DO $$
DECLARE
  r_ready JSONB;
  r_old   JSONB;
BEGIN
  r_ready := public.rating_submit('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000611', 5, 'Teste');
  PERFORM tests.assert((r_ready->>'success')::boolean = false, 'rating_submit bloqueia pedido não concluído');

  r_old := public.rating_submit('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000611', 5, 'Teste');
  PERFORM tests.assert((r_old->>'success')::boolean = false, 'rating_submit bloqueia pedido fora da janela de 7 dias');
END $$;

-- 3. Filtro de dados pessoais no comentário (telefone, e-mail, CPF) -> erro 'Não coloque dados pessoais no comentário'
DO $$
DECLARE
  r_phone JSONB;
  r_email JSONB;
  r_cpf   JSONB;
BEGIN
  r_phone := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 5, 'Me liga no 91999998888');
  PERFORM tests.assert(
    (r_phone->>'success')::boolean = false AND (r_phone->>'error') = 'Não coloque dados pessoais no comentário',
    'Comentário com telefone bloqueado'
  );

  r_email := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 5, 'Meu email é cliente@teste.com');
  PERFORM tests.assert(
    (r_email->>'success')::boolean = false AND (r_email->>'error') = 'Não coloque dados pessoais no comentário',
    'Comentário com e-mail bloqueado'
  );

  r_cpf := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 5, 'CPF 123.456.789-00');
  PERFORM tests.assert(
    (r_cpf->>'success')::boolean = false AND (r_cpf->>'error') = 'Não coloque dados pessoais no comentário',
    'Comentário com CPF bloqueado'
  );
END $$;

-- 4. Em self_delivery = true (704), não existe avaliação de/para motorista, mas Cliente <-> Loja funciona
DO $$
DECLARE
  r_drv  JSONB;
  r_shop JSONB;
BEGIN
  r_drv := public.rating_submit('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000612', 5, 'Tentando avaliar motorista em self_delivery');
  PERFORM tests.assert((r_drv->>'success')::boolean = false, 'Em self_delivery = true não permite avaliar motorista');

  r_shop := public.rating_submit('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000611', 5, 'Entrega própria rápida!');
  PERFORM tests.assert((r_shop->>'success')::boolean = true, 'Em self_delivery = true permite Cliente avaliar Loja');
END $$;

-- 5. Usuário que não participou do pedido (619) não consegue avaliar
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000619', true);
DO $$
DECLARE
  r_stranger JSONB;
BEGIN
  r_stranger := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 1, 'Não comprei');
  PERFORM tests.assert((r_stranger->>'success')::boolean = false, 'Terceiro fora do pedido não pode avaliar');
END $$;

-- 6. Pares válidos em B2C (701), B2B (706) e Coleta (707) + edição dentro da janela
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000613', true);
DO $$
DECLARE
  r1 JSONB;
  r1_edit JSONB;
  r2 JSONB;
BEGIN
  r1 := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 4, 'Bom açaí');
  r1_edit := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000611', 5, 'Excelente açaí grosso!');
  r2 := public.rating_submit('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000612', 5, 'Motoboy super educado');
  PERFORM tests.assert(
    (r1->>'success')::boolean = true
    AND (r1_edit->>'success')::boolean = true
    AND (r1_edit->>'stars')::int = 5
    AND (r2->>'success')::boolean = true,
    'Cliente avalia e edita avaliação da Loja e do Motoboy em B2C'
  );
END $$;

-- Loja (611) avalia Fornecedor (614) e Caminhoneiro (615) no B2B (706) e Caçamba (615) na Coleta (707)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000611', true);
DO $$
DECLARE
  r_b2b_forn JSONB;
  r_b2b_cam  JSONB;
  r_col_cam  JSONB;
BEGIN
  r_b2b_forn := public.rating_submit('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000614', 5, 'Fruto graúdo de primeira');
  r_b2b_cam  := public.rating_submit('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000615', 5, 'Transporte cuidadoso');
  r_col_cam  := public.rating_submit('00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000615', 4, 'Coleta rápida');
  PERFORM tests.assert(
    (r_b2b_forn->>'success')::boolean = true
    AND (r_b2b_cam->>'success')::boolean = true
    AND (r_col_cam->>'success')::boolean = true,
    'Loja avalia Fornecedor/Caminhoneiro em B2B e Caçamba em Coleta'
  );
END $$;

-- 7. Denúncia (rating_report_create), leituras e Moderação Admin (admin_rating_moderate) com log de auditoria
DO $$
DECLARE
  v_rating_id UUID;
  r_rep       JSONB;
  r_rep_dup   JSONB;
  r_my        JSONB;
  r_pub       JSONB;
  r_non_admin JSONB;
  v_rep_st    TEXT;
BEGIN
  r_my := public.get_order_ratings_for_me('00000000-0000-0000-0000-000000000706');
  PERFORM tests.assert(
    (r_my->>'success')::boolean = true AND jsonb_array_length(r_my->'ratings') = 2,
    'get_order_ratings_for_me retorna as 2 avaliações feitas pela Loja no pedido B2B 706'
  );

  r_pub := public.get_public_ratings_for_user('00000000-0000-0000-0000-000000000611');
  PERFORM tests.assert(
    (r_pub->>'success')::boolean = true AND (r_pub->>'rating_count')::int = 2,
    'get_public_ratings_for_user retorna resumo e comentários públicos'
  );

  -- Loja (611) pega o ID da avaliação recebida pela view pública ratings_public (sem precisar ler public.ratings direto)
  SELECT id INTO v_rating_id
    FROM public.ratings_public
   WHERE ratee_id = '00000000-0000-0000-0000-000000000611'
     AND comment = 'Excelente açaí grosso!'
   LIMIT 1;

  PERFORM tests.assert(v_rating_id IS NOT NULL, 'Loja encontra ID da avaliação recebida em ratings_public');

  r_rep := public.rating_report_create(v_rating_id, 'Comentário suspeito');
  PERFORM tests.assert((r_rep->>'success')::boolean = true, 'Loja cria denúncia de avaliação');

  SELECT status INTO v_rep_st FROM public.rating_reports WHERE id = (r_rep->>'report_id')::uuid;
  PERFORM tests.assert(v_rep_st = 'OPEN', 'rating_reports.status inicia como OPEN');

  r_rep_dup := public.rating_report_create(v_rating_id, 'Denúncia repetida');
  PERFORM tests.assert(
    (r_rep_dup->>'success')::boolean = true AND COALESCE((r_rep_dup->>'already_reported')::boolean, false) = true,
    'rating_report_create evita denúncia duplicada OPEN pelo mesmo usuário'
  );

  r_non_admin := public.admin_rating_moderate(v_rating_id, 'HIDDEN', 'Tentativa sem ser admin');
  PERFORM tests.assert((r_non_admin->>'success')::boolean = false, 'Não-admin não pode moderar avaliação');
END $$;

-- Admin (600) oculta a avaliação -> some de ratings_public, atualiza hidden_reason/hidden_by/status e registra em admin_audit_log
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000600', true);
DO $$
DECLARE
  v_rating_id UUID;
  r_mod_list  JSONB;
  r_mod       JSONB;
  r_mod_keep  JSONB;
  v_pub_cnt   INT;
  v_audit_cnt INT;
  v_h_reason  TEXT;
  v_h_by      UUID;
  v_rep_st    TEXT;
BEGIN
  SELECT id INTO v_rating_id
    FROM public.ratings
   WHERE order_id = '00000000-0000-0000-0000-000000000701'
     AND ratee_id = '00000000-0000-0000-0000-000000000611';

  r_mod_list := public.admin_get_ratings_moderation();
  PERFORM tests.assert(
    (r_mod_list->>'success')::boolean = true AND jsonb_array_length(r_mod_list->'reports') >= 1,
    'admin_get_ratings_moderation retorna denúncias e avaliações recentes'
  );

  r_mod := public.admin_rating_moderate(v_rating_id, 'HIDDEN', 'Ocultado em teste');
  PERFORM tests.assert((r_mod->>'success')::boolean = true AND r_mod->>'status' = 'HIDDEN',
    'Admin oculta avaliação denunciada');

  SELECT hidden_reason, hidden_by INTO v_h_reason, v_h_by FROM public.ratings WHERE id = v_rating_id;
  PERFORM tests.assert(
    v_h_reason = 'Ocultado em teste' AND v_h_by = '00000000-0000-0000-0000-000000000600',
    'ratings.hidden_reason e ratings.hidden_by preenchidos ao ocultar'
  );

  SELECT status INTO v_rep_st FROM public.rating_reports WHERE rating_id = v_rating_id LIMIT 1;
  PERFORM tests.assert(v_rep_st = 'RESOLVED_HIDDEN', 'rating_reports.status atualizado para RESOLVED_HIDDEN');

  SELECT count(*) INTO v_pub_cnt FROM public.ratings_public WHERE id = v_rating_id;
  PERFORM tests.assert(v_pub_cnt = 0, 'Avaliação ocultada não aparece em ratings_public');

  SELECT count(*) INTO v_audit_cnt
    FROM public.admin_audit_log
   WHERE action = 'ADMIN_RATING_MODERATE' AND target_id = v_rating_id::text;
  PERFORM tests.assert(v_audit_cnt = 1, 'Moderação registrada em admin_audit_log');

  -- Reabre a denúncia em uma nova denúncia para testar manter visível (VISIBLE -> RESOLVED_KEPT)
  r_mod_keep := public.rating_report_create(v_rating_id, 'Revisão solicitada');
  r_mod_keep := public.admin_rating_moderate(v_rating_id, 'VISIBLE', 'Mantida após revisão');
  -- As duas denúncias nascem na mesma transação (mesmo created_at); por isso checamos pelo conjunto:
  -- nenhuma denúncia continua OPEN e existe pelo menos uma RESOLVED_KEPT.
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM public.rating_reports WHERE rating_id = v_rating_id AND status = 'OPEN') THEN 'OPEN'
           WHEN EXISTS (SELECT 1 FROM public.rating_reports WHERE rating_id = v_rating_id AND status = 'RESOLVED_KEPT') THEN 'RESOLVED_KEPT'
           ELSE 'NONE'
         END INTO v_rep_st;
  SELECT hidden_reason, hidden_by INTO v_h_reason, v_h_by FROM public.ratings WHERE id = v_rating_id;
  PERFORM tests.assert(
    (r_mod_keep->>'success')::boolean = true
    AND v_rep_st = 'RESOLVED_KEPT'
    AND v_h_reason IS NULL
    AND v_h_by IS NULL,
    'admin_rating_moderate VISIBLE limpa hidden_reason/hidden_by e marca RESOLVED_KEPT'
  );
END $$;

ROLLBACK;
