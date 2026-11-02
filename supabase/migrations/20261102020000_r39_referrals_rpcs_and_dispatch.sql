-- ==============================================================================
-- AÇAÍFOOD R39 — FASE 2: RPCS DE INDICAÇÕES, DESPACHO E VISIBILIDADE DO RADAR/ACEITE
-- Timestamp: 20261102020000
-- Aditiva e reversível. Com referrals_enabled = false na cidade, tudo se comporta
-- exatamente como antes do R39.
-- Reversão: supabase/rollback/20261102020000_r39_referrals_rpcs_and_dispatch_rollback.sql
-- ==============================================================================

-- 1. Funções auxiliares de cidade, papéis e expiração ---------------------------

CREATE OR REPLACE FUNCTION public.r39_norm_city(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(regexp_replace(
    translate(
      COALESCE(v, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '\s+', ' ', 'g'
  )));
$$;

CREATE OR REPLACE FUNCTION public.r39_is_city_enabled(p_city TEXT, p_flag TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT := public.r39_norm_city(p_city);
  v_city RECORD;
BEGIN
  IF v_norm = '' THEN
    RETURN FALSE;
  END IF;

  SELECT referrals_enabled, ratings_enabled, rates
    INTO v_city
    FROM public.cities
   WHERE public.r39_norm_city(name) = v_norm
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF lower(COALESCE(p_flag, '')) = 'referrals' THEN
    RETURN COALESCE(v_city.referrals_enabled, false)
        OR COALESCE((v_city.rates->>'referrals_enabled')::boolean, false);
  ELSIF lower(COALESCE(p_flag, '')) = 'ratings' THEN
    RETURN COALESCE(v_city.ratings_enabled, false)
        OR COALESCE((v_city.rates->>'ratings_enabled')::boolean, false);
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.r39_city_exclusive_seconds(p_city TEXT, p_flow TEXT)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT := public.r39_norm_city(p_city);
  v_flow TEXT := upper(COALESCE(p_flow, 'B2C'));
  v_city RECORD;
  v_val INT;
BEGIN
  IF v_norm <> '' THEN
    SELECT b2c_referred_exclusive_seconds,
           b2b_referred_exclusive_seconds,
           col_referred_exclusive_seconds,
           rates
      INTO v_city
      FROM public.cities
     WHERE public.r39_norm_city(name) = v_norm
     LIMIT 1;

    IF FOUND THEN
      IF v_flow = 'COLETA' THEN
        v_val := COALESCE(
          NULLIF(v_city.rates->>'col_referred_exclusive_seconds', '')::int,
          v_city.col_referred_exclusive_seconds,
          180
        );
      ELSIF v_flow = 'B2B' THEN
        v_val := COALESCE(
          NULLIF(v_city.rates->>'b2b_referred_exclusive_seconds', '')::int,
          v_city.b2b_referred_exclusive_seconds,
          180
        );
      ELSE
        v_val := COALESCE(
          NULLIF(v_city.rates->>'b2c_referred_exclusive_seconds', '')::int,
          v_city.b2c_referred_exclusive_seconds,
          180
        );
      END IF;
      RETURN GREATEST(0, COALESCE(v_val, 180));
    END IF;
  END IF;

  RETURN 180;
END;
$$;

CREATE OR REPLACE FUNCTION public.r39_order_partner_id(
  p_order_type TEXT,
  p_seller_storefront_id UUID,
  p_buyer_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN upper(COALESCE(p_order_type, 'B2C')) = 'COLETA' THEN p_buyer_id
    ELSE COALESCE(
      (SELECT sf.partner_id FROM public.storefronts sf WHERE sf.id = p_seller_storefront_id),
      p_buyer_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.r39_order_city(
  p_seller_storefront_id UUID,
  p_buyer_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(u.cidade), '') FROM public.storefronts sf JOIN public.users u ON u.id = sf.partner_id WHERE sf.id = p_seller_storefront_id),
    (SELECT NULLIF(btrim(u.cidade), '') FROM public.users u WHERE u.id = p_buyer_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.r39_partner_matches_flow(p_user_id UUID, p_flow TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_flow TEXT := upper(COALESCE(p_flow, 'B2C'));
BEGIN
  SELECT lower(COALESCE(role, '')) INTO v_role FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_flow IN ('B2C', 'COLETA') THEN
    RETURN v_role IN ('loja', 'batedeira', 'partner');
  ELSIF v_flow = 'B2B' THEN
    RETURN v_role IN ('fornecedor', 'supplier');
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.r39_driver_matches_flow(p_user_id UUID, p_flow TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_veic TEXT;
  v_flow TEXT := upper(COALESCE(p_flow, 'B2C'));
BEGIN
  SELECT lower(COALESCE(role, '')), lower(COALESCE(vehicle_type, ''))
    INTO v_role, v_veic
    FROM public.users
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_role NOT IN ('motorista', 'motoboy', 'caminhao', 'caminhoneiro', 'courier', 'driver') THEN
    RETURN FALSE;
  END IF;

  IF v_flow = 'B2C' THEN
    IF v_role IN ('caminhao', 'caminhoneiro')
       OR v_veic LIKE '%caminh%'
       OR v_veic LIKE '%truck%'
       OR v_veic LIKE '%caçamb%'
       OR v_veic LIKE '%cacamb%' THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  ELSIF v_flow IN ('B2B', 'COLETA') THEN
    IF v_role = 'motoboy'
       OR (v_veic LIKE '%moto%' AND v_veic NOT LIKE '%truck%' AND v_veic NOT LIKE '%caminh%') THEN
      RETURN FALSE;
    END IF;
    IF v_role IN ('caminhao', 'caminhoneiro')
       OR v_veic LIKE '%caminh%'
       OR v_veic LIKE '%truck%'
       OR v_veic LIKE '%caçamb%'
       OR v_veic LIKE '%cacamb%'
       OR v_veic = '' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.r39_expire_pending_referrals()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_referrals
     SET status = 'EXPIRED'
   WHERE status = 'PENDING'
     AND expires_at <= NOW();
END;
$$;

-- 2. RPCs de Indicação (2.1) ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.referral_create_invite_link(p_flow TEXT DEFAULT 'B2C')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_flow TEXT := upper(btrim(COALESCE(p_flow, 'B2C')));
  v_city TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_active_count INT := 0;
  v_token TEXT;
  v_token_hash TEXT;
  v_link_id UUID;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  IF v_flow NOT IN ('B2C', 'B2B', 'COLETA') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fluxo inválido.');
  END IF;

  SELECT cidade, (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin')
    INTO v_city, v_is_admin
    FROM public.users
   WHERE id = v_caller_id;

  IF NOT v_is_admin AND NOT public.r39_partner_matches_flow(v_caller_id, v_flow) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável por este fluxo pode gerar link de convite.');
  END IF;

  IF NOT v_is_admin AND NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  SELECT count(*) INTO v_active_count
    FROM public.referral_invite_links
   WHERE partner_id = v_caller_id
     AND revoked_at IS NULL
     AND expires_at > NOW();

  IF v_active_count >= 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já atingiu o limite de 20 links de convite ativos.');
  END IF;

  -- Token aleatório de 32 bytes (64 hex chars); salva apenas o SHA-256 no banco
  v_token := md5(gen_random_uuid()::text || random()::text || clock_timestamp()::text)
          || md5(random()::text || gen_random_uuid()::text || v_caller_id::text);
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.referral_invite_links (partner_id, flow, token_hash, expires_at)
  VALUES (v_caller_id, v_flow, v_token_hash, v_expires)
  RETURNING id INTO v_link_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_link_id,
    'token', v_token,
    'flow', v_flow,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_get_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean TEXT := lower(btrim(COALESCE(p_token, '')));
  v_hash TEXT;
  v_link RECORD;
  v_partner RECORD;
  v_store_name TEXT;
  v_avg NUMERIC;
  v_count BIGINT;
BEGIN
  IF v_clean = '' OR length(v_clean) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado.');
  END IF;

  v_hash := encode(sha256(convert_to(v_clean, 'UTF8')), 'hex');

  SELECT * INTO v_link
    FROM public.referral_invite_links
   WHERE token_hash = v_hash
   LIMIT 1;

  IF NOT FOUND OR v_link.revoked_at IS NOT NULL OR v_link.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite já expirou ou foi revogado.');
  END IF;

  SELECT id, name, role, bairro, cidade INTO v_partner
    FROM public.users
   WHERE id = v_link.partner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parceiro do convite não encontrado.');
  END IF;

  IF NOT public.r39_is_city_enabled(v_partner.cidade, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  SELECT store_name INTO v_store_name
    FROM public.storefronts
   WHERE partner_id = v_partner.id
   LIMIT 1;

  SELECT avg_stars, rating_count INTO v_avg, v_count
    FROM public.user_rating_summary
   WHERE ratee_id = v_partner.id;

  RETURN jsonb_build_object(
    'success', true,
    'partner_id', v_partner.id,
    'partner_name', COALESCE(NULLIF(btrim(v_store_name), ''), v_partner.name, 'Parceiro AçaíFood'),
    'partner_role', v_partner.role,
    'partner_bairro', v_partner.bairro,
    'partner_cidade', v_partner.cidade,
    'flow', v_link.flow,
    'avg_stars', v_avg,
    'rating_count', COALESCE(v_count, 0),
    'expires_at', v_link.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_accept_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_clean TEXT := lower(btrim(COALESCE(p_token, '')));
  v_hash TEXT;
  v_link RECORD;
  v_partner_city TEXT;
  v_existing RECORD;
  v_ref_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faça login ou crie sua conta de entregador para aceitar o convite.');
  END IF;

  IF v_clean = '' OR length(v_clean) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado.');
  END IF;

  PERFORM public.r39_expire_pending_referrals();

  v_hash := encode(sha256(convert_to(v_clean, 'UTF8')), 'hex');

  SELECT * INTO v_link
    FROM public.referral_invite_links
   WHERE token_hash = v_hash
   LIMIT 1;

  IF NOT FOUND OR v_link.revoked_at IS NOT NULL OR v_link.expires_at <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite já expirou ou foi revogado.');
  END IF;

  IF v_link.partner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode aceitar o próprio convite.');
  END IF;

  SELECT cidade INTO v_partner_city FROM public.users WHERE id = v_link.partner_id;
  IF NOT public.r39_is_city_enabled(v_partner_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  IF NOT public.r39_driver_matches_flow(v_caller_id, v_link.flow) THEN
    IF v_link.flow = 'B2C' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este convite é exclusivo para entregadores com motocicleta (B2C).');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Este convite é exclusivo para parceiros de caminhão ou caçamba.');
    END IF;
  END IF;

  SELECT * INTO v_existing
    FROM public.partner_referrals
   WHERE partner_id = v_link.partner_id
     AND driver_id = v_caller_id
     AND flow = v_link.flow
     AND status IN ('PENDING', 'ACTIVE')
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'ACTIVE' THEN
      RETURN jsonb_build_object('success', true, 'referral_id', v_existing.id, 'status', 'ACTIVE', 'message', 'Você já é um parceiro indicado ativo.');
    END IF;

    UPDATE public.partner_referrals
       SET status = 'ACTIVE',
           driver_serves = TRUE,
           responded_at = v_now
     WHERE id = v_existing.id
     RETURNING id INTO v_ref_id;
  ELSE
    INSERT INTO public.partner_referrals (
      partner_id, driver_id, flow, origin, status, driver_serves, created_at, expires_at, responded_at
    ) VALUES (
      v_link.partner_id, v_caller_id, v_link.flow, 'PARTNER_INVITE', 'ACTIVE', TRUE, v_now, v_now + INTERVAL '7 days', v_now
    )
    RETURNING id INTO v_ref_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_ref_id,
    'status', 'ACTIVE',
    'flow', v_link.flow
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_request(p_partner_id UUID, p_flow TEXT DEFAULT 'B2C')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_flow TEXT := upper(btrim(COALESCE(p_flow, 'B2C')));
  v_partner_city TEXT;
  v_driver_city TEXT;
  v_today_count INT := 0;
  v_existing RECORD;
  v_ref_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  IF p_partner_id IS NULL OR p_partner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parceiro inválido.');
  END IF;

  IF v_flow NOT IN ('B2C', 'B2B', 'COLETA') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fluxo inválido.');
  END IF;

  PERFORM public.r39_expire_pending_referrals();

  SELECT cidade INTO v_driver_city FROM public.users WHERE id = v_caller_id;
  SELECT cidade INTO v_partner_city FROM public.users WHERE id = p_partner_id;

  IF NOT public.r39_is_city_enabled(COALESCE(v_partner_city, v_driver_city), 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  IF NOT public.r39_driver_matches_flow(v_caller_id, v_flow) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seu perfil de veículo não corresponde a este fluxo.');
  END IF;

  IF NOT public.r39_partner_matches_flow(p_partner_id, v_flow) THEN
    RETURN jsonb_build_object('success', false, 'error', 'O parceiro selecionado não atua neste fluxo.');
  END IF;

  SELECT count(*) INTO v_today_count
    FROM public.partner_referrals
   WHERE driver_id = v_caller_id
     AND origin = 'DRIVER_REQUEST'
     AND created_at >= (v_now - INTERVAL '24 hours');

  IF v_today_count >= 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite diário de 30 solicitações de indicação atingido. Tente novamente amanhã.');
  END IF;

  SELECT * INTO v_existing
    FROM public.partner_referrals
   WHERE partner_id = p_partner_id
     AND driver_id = v_caller_id
     AND flow = v_flow
     AND status IN ('PENDING', 'ACTIVE');

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe uma indicação pendente ou ativa com este parceiro.');
  END IF;

  INSERT INTO public.partner_referrals (
    partner_id, driver_id, flow, origin, status, driver_serves, created_at, expires_at
  ) VALUES (
    p_partner_id, v_caller_id, v_flow, 'DRIVER_REQUEST', 'PENDING', TRUE, v_now, v_now + INTERVAL '7 days'
  )
  RETURNING id INTO v_ref_id;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_ref_id,
    'status', 'PENDING',
    'flow', v_flow
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_respond(p_referral_id UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ref RECORD;
  v_city TEXT;
  v_new_status TEXT := CASE WHEN COALESCE(p_accept, false) THEN 'ACTIVE' ELSE 'DECLINED' END;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  PERFORM public.r39_expire_pending_referrals();

  SELECT * INTO v_ref
    FROM public.partner_referrals
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indicação não encontrada.');
  END IF;

  SELECT cidade INTO v_city FROM public.users WHERE id = v_ref.partner_id;
  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  IF v_ref.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitação não está mais pendente.');
  END IF;

  -- Somente o lado que recebeu o pedido pode responder
  IF v_ref.origin = 'DRIVER_REQUEST' AND v_ref.partner_id IS DISTINCT FROM v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento que recebeu a solicitação pode responder.');
  ELSIF v_ref.origin = 'PARTNER_INVITE' AND v_ref.driver_id IS DISTINCT FROM v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o motorista convidado pode responder a este convite.');
  END IF;

  UPDATE public.partner_referrals
     SET status = v_new_status,
         responded_at = v_now
   WHERE id = p_referral_id;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', p_referral_id,
    'status', v_new_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_remove(p_referral_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_ref RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  SELECT (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin')
    INTO v_is_admin
    FROM public.users
   WHERE id = v_caller_id;

  SELECT * INTO v_ref
    FROM public.partner_referrals
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indicação não encontrada.');
  END IF;

  IF NOT v_is_admin AND v_ref.partner_id IS DISTINCT FROM v_caller_id AND v_ref.driver_id IS DISTINCT FROM v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para remover esta indicação.');
  END IF;

  UPDATE public.partner_referrals
     SET status = 'REMOVED',
         removed_at = v_now,
         removed_by = v_caller_id
   WHERE id = p_referral_id;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', p_referral_id,
    'status', 'REMOVED'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_set_driver_serves(p_referral_id UUID, p_serves BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ref RECORD;
  v_city TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  SELECT * INTO v_ref
    FROM public.partner_referrals
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indicação não encontrada.');
  END IF;

  IF v_ref.driver_id IS DISTINCT FROM v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o motorista da indicação pode alterar esta preferência.');
  END IF;

  SELECT cidade INTO v_city FROM public.users WHERE id = v_ref.partner_id;
  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  IF v_ref.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas indicações ativas podem ser alteradas.');
  END IF;

  UPDATE public.partner_referrals
     SET driver_serves = COALESCE(p_serves, true)
   WHERE id = p_referral_id;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', p_referral_id,
    'driver_serves', COALESCE(p_serves, true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_set_serve_mode(p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_mode TEXT := upper(btrim(COALESCE(p_mode, '')));
  v_role TEXT;
  v_city TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  IF v_mode NOT IN ('ALL', 'SELECTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Modo inválido (use ALL ou SELECTED).');
  END IF;

  SELECT lower(COALESCE(role, '')), cidade INTO v_role, v_city
    FROM public.users
   WHERE id = v_caller_id;

  IF v_role NOT IN ('motorista', 'motoboy', 'caminhao', 'caminhoneiro', 'courier', 'driver') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas motoristas podem alterar o modo de atendimento.');
  END IF;

  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.users SET serve_mode = v_mode WHERE id = v_caller_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  RETURN jsonb_build_object('success', true, 'serve_mode', v_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_set_dispatch_mode(p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_mode TEXT := upper(btrim(COALESCE(p_mode, '')));
  v_role TEXT;
  v_city TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida. Entre novamente no app.');
  END IF;

  IF v_mode NOT IN ('ALL', 'REFERRED_FIRST', 'REFERRED_ONLY') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Modo de despacho inválido.');
  END IF;

  SELECT lower(COALESCE(role, '')), cidade INTO v_role, v_city
    FROM public.users
   WHERE id = v_caller_id;

  IF v_role NOT IN ('loja', 'batedeira', 'fornecedor', 'partner', 'supplier') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas lojas e fornecedores podem alterar quem recebe suas corridas.');
  END IF;

  IF NOT public.r39_is_city_enabled(v_city, 'referrals') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.users SET dispatch_mode = v_mode WHERE id = v_caller_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  RETURN jsonb_build_object('success', true, 'dispatch_mode', v_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referrals(p_flow TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_flow TEXT := NULLIF(upper(btrim(COALESCE(p_flow, ''))), '');
  v_rows JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  PERFORM public.r39_expire_pending_referrals();

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        pr.id,
        pr.partner_id,
        pr.driver_id,
        pr.flow,
        pr.origin,
        pr.status,
        pr.driver_serves,
        pr.created_at,
        pr.expires_at,
        pr.responded_at,
        COALESCE(NULLIF(btrim(sf.store_name), ''), u_partner.name, 'Parceiro') AS partner_name,
        u_partner.bairro AS partner_bairro,
        u_partner.cidade AS partner_cidade,
        sf.logo_url AS partner_photo,
        urs_p.avg_stars AS partner_avg_stars,
        COALESCE(urs_p.rating_count, 0) AS partner_rating_count,
        COALESCE(u_driver.name, 'Motorista') AS driver_name,
        u_driver.vehicle_type AS driver_vehicle_type,
        u_driver.bairro AS driver_bairro,
        urs_d.avg_stars AS driver_avg_stars,
        COALESCE(urs_d.rating_count, 0) AS driver_rating_count
      FROM public.partner_referrals pr
      LEFT JOIN public.users u_partner ON u_partner.id = pr.partner_id
      LEFT JOIN public.storefronts sf ON sf.partner_id = pr.partner_id
      LEFT JOIN public.user_rating_summary urs_p ON urs_p.ratee_id = pr.partner_id
      LEFT JOIN public.users u_driver ON u_driver.id = pr.driver_id
      LEFT JOIN public.user_rating_summary urs_d ON urs_d.ratee_id = pr.driver_id
      WHERE (pr.partner_id = v_caller_id OR pr.driver_id = v_caller_id)
        AND pr.status IN ('PENDING', 'ACTIVE')
        AND (v_flow IS NULL OR pr.flow = v_flow)
      ORDER BY pr.created_at DESC
    ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_city_partners_for_referral(
  p_flow TEXT DEFAULT 'B2C',
  p_query TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_flow TEXT := upper(btrim(COALESCE(p_flow, 'B2C')));
  v_q TEXT := lower(btrim(COALESCE(p_query, '')));
  v_city TEXT;
  v_norm_city TEXT;
  v_rows JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT cidade INTO v_city FROM public.users WHERE id = v_caller_id;
  v_norm_city := public.r39_norm_city(v_city);

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        u.id AS partner_id,
        COALESCE(NULLIF(btrim(sf.store_name), ''), u.name, 'Parceiro') AS name,
        u.bairro,
        u.cidade,
        sf.logo_url,
        urs.avg_stars,
        COALESCE(urs.rating_count, 0) AS rating_count,
        (
          SELECT pr.status
            FROM public.partner_referrals pr
           WHERE pr.partner_id = u.id
             AND pr.driver_id = v_caller_id
             AND pr.flow = v_flow
             AND pr.status IN ('PENDING', 'ACTIVE')
           LIMIT 1
        ) AS existing_status
      FROM public.users u
      LEFT JOIN public.storefronts sf ON sf.partner_id = u.id
      LEFT JOIN public.user_rating_summary urs ON urs.ratee_id = u.id
      WHERE COALESCE(u.status, 'active') <> 'blocked'
        AND (
          (v_flow IN ('B2C', 'COLETA') AND lower(COALESCE(u.role, '')) IN ('loja', 'batedeira', 'partner'))
          OR (v_flow = 'B2B' AND lower(COALESCE(u.role, '')) IN ('fornecedor', 'supplier'))
        )
        AND (v_norm_city = '' OR public.r39_norm_city(u.cidade) = v_norm_city)
        AND (
          v_q = ''
          OR lower(COALESCE(sf.store_name, '')) LIKE '%' || v_q || '%'
          OR lower(COALESCE(u.name, '')) LIKE '%' || v_q || '%'
          OR lower(COALESCE(u.bairro, '')) LIKE '%' || v_q || '%'
        )
      ORDER BY COALESCE(NULLIF(btrim(sf.store_name), ''), u.name) ASC
      LIMIT 50
    ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

-- 3. Despacho: gatilho em orders + advance_order_status (2.4) -------------------

CREATE OR REPLACE FUNCTION public.r39_protect_orders_referral_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_privileged BOOLEAN := (
    COALESCE(auth.role(), 'anon') = 'service_role'
    OR COALESCE(public.is_admin(), false)
    OR COALESCE(current_setting('acaifood.r39_rpc', true), '') = '1'
  );
  v_city TEXT;
  v_partner_id UUID;
  v_excl INT;
BEGIN
  IF NOT v_is_privileged THEN
    IF TG_OP = 'INSERT' THEN
      NEW.dispatch_mode := 'ALL';
      NEW.radar_open_at := NULL;
      NEW.dispatch_called_at := NULL;
      NEW.stuck_alert_sent_at := NULL;
      NEW.self_delivery := FALSE;
      NEW.assigned_via_referral := FALSE;
      NEW.dispatch_mode_snapshot := NULL;
      NEW.delivery_platform_fee_pct_applied := NULL;
    ELSE
      NEW.dispatch_mode := OLD.dispatch_mode;
      NEW.radar_open_at := OLD.radar_open_at;
      NEW.dispatch_called_at := OLD.dispatch_called_at;
      NEW.stuck_alert_sent_at := OLD.stuck_alert_sent_at;
      NEW.self_delivery := OLD.self_delivery;
      NEW.assigned_via_referral := OLD.assigned_via_referral;
      NEW.dispatch_mode_snapshot := OLD.dispatch_mode_snapshot;
      NEW.delivery_platform_fee_pct_applied := OLD.delivery_platform_fee_pct_applied;
    END IF;
  END IF;

  -- Quando o pedido entra em estado de chamar motorista (READY / SEARCHING_OPERATOR)
  IF NEW.status IN ('READY', 'SEARCHING_OPERATOR', 'ready')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.dispatch_called_at IS NULL THEN
    NEW.dispatch_called_at := NOW();

    -- Só calcula radar_open_at automaticamente se não foi explicitamente informado por service_role/RPC
    IF NEW.radar_open_at IS NULL THEN
      v_city := public.r39_order_city(NEW.seller_storefront_id, NEW.buyer_id);

      IF public.r39_is_city_enabled(v_city, 'referrals') THEN
        IF COALESCE(NEW.dispatch_mode, 'ALL') = 'ALL' AND NEW.dispatch_mode_snapshot IS NULL THEN
          v_partner_id := public.r39_order_partner_id(NEW.order_type, NEW.seller_storefront_id, NEW.buyer_id);
          IF v_partner_id IS NOT NULL THEN
            SELECT COALESCE(dispatch_mode, 'ALL') INTO NEW.dispatch_mode
              FROM public.users WHERE id = v_partner_id;
          END IF;
        END IF;
      ELSE
        NEW.dispatch_mode := 'ALL';
      END IF;

      IF COALESCE(NEW.dispatch_mode, 'ALL') = 'ALL' THEN
        NEW.radar_open_at := NOW();
      ELSIF NEW.dispatch_mode = 'REFERRED_FIRST' THEN
        v_excl := public.r39_city_exclusive_seconds(v_city, NEW.order_type);
        NEW.radar_open_at := NOW() + make_interval(secs => COALESCE(v_excl, 180));
      ELSIF NEW.dispatch_mode = 'REFERRED_ONLY' THEN
        NEW.radar_open_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_store RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_status TEXT;
  v_city TEXT;
  v_dispatch_mode TEXT;
  v_excl_secs INT;
  v_radar_open TIMESTAMPTZ;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
    v_caller_role := 'admin';
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT role, (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin') INTO v_caller_role, v_is_admin
    FROM public.users WHERE id = v_caller_id;
    v_caller_role := lower(COALESCE(v_caller_role, 'cliente'));
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou não autenticada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.seller_storefront_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.storefronts WHERE id = v_order.seller_storefront_id;
  END IF;

  CASE lower(trim(p_action))
    WHEN 'accept', 'iniciar_preparo' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode aceitar o pedido');
      END IF;
      IF v_order.status NOT IN ('PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível iniciar o preparo de pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'PREPARING';
      UPDATE public.orders SET status = v_new_status, accepted_at = v_now WHERE id = p_order_id;

    WHEN 'ready', 'pronto' THEN
      IF NOT v_is_admin AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o estabelecimento responsável pode marcar o pedido como pronto');
      END IF;
      IF v_order.status NOT IN ('PREPARING', 'preparing', 'PAID', 'paid') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível marcar como pronto pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'READY';

      v_city := public.r39_order_city(v_order.seller_storefront_id, v_order.buyer_id);
      IF public.r39_is_city_enabled(v_city, 'referrals') THEN
        v_dispatch_mode := COALESCE(NULLIF(v_order.dispatch_mode_snapshot, ''), v_order.dispatch_mode, 'ALL');
      ELSE
        v_dispatch_mode := 'ALL';
      END IF;

      IF v_dispatch_mode = 'REFERRED_FIRST' THEN
        v_excl_secs := public.r39_city_exclusive_seconds(v_city, v_order.order_type);
        v_radar_open := v_now + make_interval(secs => COALESCE(v_excl_secs, 180));
      ELSIF v_dispatch_mode = 'REFERRED_ONLY' THEN
        v_radar_open := NULL;
      ELSE
        v_dispatch_mode := 'ALL';
        v_radar_open := v_now;
      END IF;

      PERFORM set_config('acaifood.r39_rpc', '1', true);
      UPDATE public.orders
         SET status = v_new_status,
             ready_at = v_now,
             dispatch_mode = v_dispatch_mode,
             dispatch_called_at = v_now,
             radar_open_at = v_radar_open
       WHERE id = p_order_id;
      PERFORM set_config('acaifood.r39_rpc', '', true);

    WHEN 'pickup', 'retirada' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode marcar a retirada do pedido');
      END IF;
      IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Não é possível retirar pedido em status %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERING';
      UPDATE public.orders SET status = v_new_status, picked_up_at = v_now WHERE id = p_order_id;

    WHEN 'delivered_by_driver', 'entregue_motorista' THEN
      IF NOT v_is_admin AND (v_order.driver_id IS NULL OR v_order.driver_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o entregador responsável pode atualizar a chegada no destino');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'IN_TRANSIT', 'in_transit') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Status inválido para entrega: %s', v_order.status));
      END IF;
      v_new_status := 'DELIVERED';
      UPDATE public.orders SET status = v_new_status, delivered_at = v_now WHERE id = p_order_id;

    WHEN 'cancel_unpaid', 'cancelar_pendente' THEN
      IF NOT v_is_admin AND v_order.buyer_id != v_caller_id AND (v_store.partner_id IS NULL OR v_store.partner_id != v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para cancelar este pedido');
      END IF;
      IF v_order.status NOT IN ('PENDING', 'pending', 'AWAITING_PAYMENT') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cancelamento direto permitido apenas para pedidos pendentes de pagamento');
      END IF;
      v_new_status := 'CANCELLED';
      UPDATE public.orders
      SET status = v_new_status,
          cancelled_at = v_now,
          cancelled_by = v_caller_id,
          cancellation_reason = COALESCE(p_reason, 'Cancelado pelo usuário antes do pagamento')
      WHERE id = p_order_id;

    WHEN 'archive_driver', 'pagar_motorista' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Arquivamento de corrida restrito exclusivamente a administradores');
      END IF;
      IF v_order.status NOT IN ('RECEIVED', 'received', 'COMPLETED') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Pedido em status %s não pode ser arquivado (deve estar RECEIVED)', v_order.status));
      END IF;
      v_new_status := 'COMPLETED';
      UPDATE public.orders SET status = v_new_status, payout_driver_done = true WHERE id = p_order_id;

    WHEN 'force_receive', 'forcar_baixa' THEN
      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Baixa forçada é restrita a administradores');
      END IF;
      IF v_order.status NOT IN ('DELIVERING', 'delivering', 'DELIVERED', 'delivered', 'PIN_LOCKED', 'pin_locked') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Baixa forçada não permitida a partir do status %s', v_order.status));
      END IF;
      IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Justificativa de no mínimo 10 caracteres é obrigatória para baixa forçada');
      END IF;
      v_new_status := 'RECEIVED';

      UPDATE public.orders
      SET status = v_new_status,
          received_at = v_now,
          cancellation_reason = 'Baixa forçada admin: ' || p_reason
      WHERE id = p_order_id;

      INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before_state, after_state)
      VALUES (
        v_caller_id,
        'ORDER_FORCE_RECEIVE',
        'ORDER',
        p_order_id::text,
        jsonb_build_object('status', v_order.status, 'reason', p_reason),
        jsonb_build_object('status', 'RECEIVED')
      );

    ELSE
      RETURN jsonb_build_object('success', false, 'error', format('Ação desconhecida: %s', p_action));
  END CASE;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, v_new_status, v_caller_id, v_caller_role, p_reason, v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'from_status', v_order.status,
    'status', v_new_status,
    'message', 'Status do pedido atualizado com sucesso'
  );
END;
$$;

-- 4. Visibilidade no Radar e no Aceite (2.5) -----------------------------------

CREATE OR REPLACE FUNCTION public.get_driver_radar()
RETURNS TABLE (
  id UUID,
  order_type TEXT,
  status TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
  origin_name TEXT,
  origin_bairro TEXT,
  delivery_bairro TEXT,
  approx_lat NUMERIC,
  approx_lng NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_is_admin BOOLEAN := FALSE;
  v_serve_mode TEXT := 'ALL';
BEGIN
  IF v_caller_id IS NULL AND NOT v_is_service THEN
    RETURN;
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT COALESCE(u.serve_mode, 'ALL'),
           (COALESCE(u.is_admin, false) OR lower(COALESCE(u.role, '')) = 'admin')
      INTO v_serve_mode, v_is_admin
      FROM public.users u
     WHERE u.id = v_caller_id;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(o.order_type, 'B2C')::text AS order_type,
    o.status::text,
    COALESCE(o.delivery_distance_km, 0)::numeric AS delivery_distance_km,
    COALESCE(o.driver_payout_amount, 0)::numeric AS driver_payout_amount,
    COALESCE(sf.store_name, u_seller.name, 'Loja / Batedeira')::text AS origin_name,
    COALESCE(u_seller.bairro, 'Centro')::text AS origin_bairro,
    COALESCE(o.delivery_bairro, u_buyer.bairro, 'Destino')::text AS delivery_bairro,
    ROUND(COALESCE(o.delivery_lat, 0)::numeric, 2) AS approx_lat,
    ROUND(COALESCE(o.delivery_lng, 0)::numeric, 2) AS approx_lng,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  LEFT JOIN public.users u_seller ON u_seller.id = sf.partner_id
  LEFT JOIN public.users u_buyer ON u_buyer.id = o.buyer_id
  WHERE o.driver_id IS NULL
    AND o.status IN ('READY', 'SEARCHING_OPERATOR', 'ready')
    AND COALESCE(o.is_hidden, false) = false
    AND COALESCE(o.self_delivery, false) = false
    AND (
      v_is_service
      OR v_is_admin
      OR (
        -- Se o motorista está em SELECTED, exige indicação ativa com driver_serves = true
        (
          v_serve_mode <> 'SELECTED'
          OR EXISTS (
            SELECT 1
              FROM public.partner_referrals pr
             WHERE pr.partner_id = COALESCE(
                     CASE WHEN upper(COALESCE(o.order_type, 'B2C')) = 'COLETA' THEN o.buyer_id ELSE sf.partner_id END,
                     o.buyer_id
                   )
               AND pr.driver_id = v_caller_id
               AND pr.flow = upper(COALESCE(o.order_type, 'B2C'))
               AND pr.status = 'ACTIVE'
               AND pr.driver_serves = TRUE
          )
        )
        -- E o pedido já abriu para o radar geral OU o motorista é indicado ativo que atende o vendedor
        AND (
          (o.radar_open_at IS NOT NULL AND NOW() >= o.radar_open_at)
          OR (COALESCE(o.dispatch_mode, 'ALL') = 'ALL' AND o.radar_open_at IS NULL)
          OR EXISTS (
            SELECT 1
              FROM public.partner_referrals pr
             WHERE pr.partner_id = COALESCE(
                     CASE WHEN upper(COALESCE(o.order_type, 'B2C')) = 'COLETA' THEN o.buyer_id ELSE sf.partner_id END,
                     o.buyer_id
                   )
               AND pr.driver_id = v_caller_id
               AND pr.flow = upper(COALESCE(o.order_type, 'B2C'))
               AND pr.status = 'ACTIVE'
               AND pr.driver_serves = TRUE
          )
        )
      )
    )
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_order_atomic(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT := '';
  v_caller_veiculo TEXT := '';
  v_serve_mode TEXT := 'ALL';
  v_is_admin BOOLEAN := FALSE;
  v_order RECORD;
  v_order_type TEXT;
  v_partner_id UUID;
  v_has_active_referral BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.role() = 'service_role' THEN
    v_is_admin := TRUE;
  ELSIF v_caller_id IS NOT NULL THEN
    SELECT
      lower(COALESCE(role, '')),
      lower(COALESCE(vehicle_type, '')),
      COALESCE(serve_mode, 'ALL'),
      (COALESCE(is_admin, false) OR lower(COALESCE(role, '')) = 'admin')
    INTO v_caller_role, v_caller_veiculo, v_serve_mode, v_is_admin
    FROM public.users WHERE id = v_caller_id;

    IF NOT v_is_admin AND v_caller_role NOT IN ('motorista', 'motoboy', 'caminhao', 'courier', 'driver') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas motoristas cadastrados e autorizados podem aceitar corridas');
    END IF;

    -- R21: a corrida é paga na conta Asaas do entregador; sem conta aprovada não aceita
    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v_caller_id
        AND upper(COALESCE(u.asaas_account_status, '')) = 'APPROVED'
        AND COALESCE(trim(u.asaas_wallet_id), '') <> ''
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sua conta Asaas ainda não está aprovada. Envie os documentos em "Minha conta Asaas" para aceitar corridas.');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou não autenticada');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF COALESCE(v_order.self_delivery, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido está marcado para entrega própria pelo estabelecimento.');
  END IF;

  IF v_order.driver_id IS NOT NULL THEN
    IF v_order.driver_id = v_caller_id THEN
      RETURN jsonb_build_object('success', true, 'message', 'Você já aceitou este pedido', 'driver_id', v_caller_id);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi aceito por outro motorista');
    END IF;
  END IF;

  IF v_order.status NOT IN ('READY', 'ready', 'SEARCHING_OPERATOR') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Pedido não está pronto para despacho de entrega (Status atual: %s)', v_order.status));
  END IF;

  v_order_type := upper(COALESCE(v_order.order_type, 'B2C'));

  IF NOT v_is_admin THEN
    IF v_order_type = 'B2C' THEN
      IF v_caller_role IN ('caminhao', 'caminhoneiro') OR (v_caller_veiculo LIKE '%caminh%' OR v_caller_veiculo LIKE '%truck%') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Corridas B2C são exclusivas para entregadores com motocicleta');
      END IF;
    ELSIF v_order_type IN ('B2B', 'COLETA') THEN
      IF v_caller_role = 'motoboy' OR (v_caller_veiculo LIKE '%moto%' AND v_caller_veiculo NOT LIKE '%truck%') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cargas B2B e Coletas de Caroço exigem caminhão ou caçamba');
      END IF;
    END IF;
  END IF;

  -- R39 (2.5): checar indicação ativa e regras de visibilidade/despacho no aceite
  v_partner_id := public.r39_order_partner_id(v_order_type, v_order.seller_storefront_id, v_order.buyer_id);

  IF v_caller_id IS NOT NULL AND v_partner_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.partner_referrals pr
       WHERE pr.partner_id = v_partner_id
         AND pr.driver_id = v_caller_id
         AND pr.flow = v_order_type
         AND pr.status = 'ACTIVE'
         AND pr.driver_serves = TRUE
    ) INTO v_has_active_referral;
  END IF;

  IF NOT v_is_admin THEN
    IF v_serve_mode = 'SELECTED' AND NOT v_has_active_referral THEN
      RETURN jsonb_build_object('success', false, 'error', 'Seu modo de atendimento está configurado para atender apenas parceiros selecionados que indicaram você.');
    END IF;

    IF NOT v_has_active_referral
       AND NOT (v_order.radar_open_at IS NOT NULL AND v_now >= v_order.radar_open_at)
       AND NOT (COALESCE(v_order.dispatch_mode, 'ALL') = 'ALL' AND v_order.radar_open_at IS NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este pedido está restrito aos motoristas indicados pelo estabelecimento.');
    END IF;
  END IF;

  PERFORM set_config('acaifood.r39_rpc', '1', true);
  UPDATE public.orders
  SET driver_id = v_caller_id,
      status = 'DELIVERING',
      assigned_via_referral = v_has_active_referral
  WHERE id = p_order_id;
  PERFORM set_config('acaifood.r39_rpc', '', true);

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason, created_at)
  VALUES (p_order_id, v_order.status, 'DELIVERING', v_caller_id, 'MOTORISTA', 'Corrida aceita no radar pelo motorista', v_now);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'driver_id', v_caller_id,
    'status', 'DELIVERING',
    'assigned_via_referral', v_has_active_referral,
    'message', 'Corrida aceita com sucesso!'
  );
END;
$$;

-- 5. Permissões de execução das novas RPCs -------------------------------------
REVOKE EXECUTE ON FUNCTION public.referral_create_invite_link(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.referral_get_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.referral_accept_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.referral_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.referral_respond(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.referral_remove(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.referral_set_driver_serves(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_set_serve_mode(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.partner_set_dispatch_mode(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referrals(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_city_partners_for_referral(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_radar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_order_atomic(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text) FROM PUBLIC, anon;

-- referral_get_invite pode ser consultada na tela pública /convite/[token] antes do login
GRANT EXECUTE ON FUNCTION public.referral_get_invite(text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.referral_create_invite_link(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referral_accept_invite(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referral_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referral_respond(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referral_remove(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referral_set_driver_serves(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_set_serve_mode(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.partner_set_dispatch_mode(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_referrals(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_city_partners_for_referral(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_order_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.advance_order_status(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
