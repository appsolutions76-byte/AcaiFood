-- ==============================================================================
-- MIGRATION R39 (FASE 6): AVALIAÇÕES 1 A 5 ESTRELAS, DENÚNCIAS E MODERAÇÃO
-- ==============================================================================

-- 1. RPC: rating_submit (6.1) --------------------------------------------------
CREATE OR REPLACE FUNCTION public.rating_submit(
  p_order_id UUID,
  p_ratee_id UUID,
  p_stars INT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_order RECORD;
  v_city TEXT;
  v_flow TEXT;
  v_seller_id UUID;
  v_buyer_id UUID;
  v_driver_id UUID;
  v_self_delivery BOOLEAN;
  v_caller_role TEXT := NULL;
  v_ratee_role TEXT := NULL;
  v_valid_pair BOOLEAN := FALSE;
  v_window_days INT := 7;
  v_comments_enabled BOOLEAN := TRUE;
  v_ref_time TIMESTAMPTZ;
  v_recent_count INT := 0;
  v_clean_comment TEXT := NULL;
  v_digits_only TEXT := '';
  v_rating_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  IF p_order_id IS NULL OR p_ratee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido e destinatário são obrigatórios.');
  END IF;

  IF v_caller = p_ratee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode avaliar a si mesmo.');
  END IF;

  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A nota deve ser de 1 a 5 estrelas.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  END IF;

  -- Verifica se a cidade do pedido tem ratings_enabled = true
  v_city := public.r39_order_city(v_order.seller_storefront_id, v_order.buyer_id);
  IF NOT public.r39_is_city_enabled(v_city, 'ratings') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso ainda não disponível na sua cidade');
  END IF;

  -- Verifica que o pedido está concluído (RECEIVED / COMPLETED)
  IF upper(COALESCE(v_order.status, '')) NOT IN ('RECEIVED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'A avaliação só fica disponível após a conclusão do pedido.');
  END IF;

  -- Configurações globais de avaliação em platform_settings
  SELECT COALESCE(rating_window_days, 7),
         COALESCE(rating_comments_enabled, true)
    INTO v_window_days, v_comments_enabled
    FROM public.platform_settings
   LIMIT 1;

  v_window_days := GREATEST(COALESCE(v_window_days, 7), 1);
  v_ref_time := COALESCE(v_order.received_at, v_order.delivered_at, v_order.created_at, NOW());

  IF NOW() > (v_ref_time + make_interval(days => v_window_days)) THEN
    RETURN jsonb_build_object('success', false, 'error', format('O prazo de %s dias para avaliar este pedido já encerrou.', v_window_days));
  END IF;

  -- Limite anti-abuso: máximo 30 avaliações por usuário por hora
  SELECT count(*) INTO v_recent_count
    FROM public.ratings r
   WHERE r.rater_id = v_caller
     AND r.created_at >= (NOW() - interval '1 hour')
     AND NOT (r.order_id = p_order_id AND r.ratee_id = p_ratee_id);

  IF v_recent_count >= 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite de avaliações por hora atingido. Tente novamente mais tarde.');
  END IF;

  -- Resolver partes do pedido conforme matriz 6.2
  v_flow := upper(COALESCE(v_order.order_type, 'B2C'));
  IF v_flow NOT IN ('B2C', 'B2B', 'COLETA') THEN
    v_flow := 'B2C';
  END IF;

  v_buyer_id := v_order.buyer_id;
  v_self_delivery := COALESCE(v_order.self_delivery, false);
  v_driver_id := CASE WHEN v_self_delivery THEN NULL ELSE v_order.driver_id END;

  IF v_flow IN ('B2C', 'B2B') THEN
    v_seller_id := public.r39_order_partner_id(v_flow, v_order.seller_storefront_id, v_order.buyer_id);
  ELSE
    v_seller_id := NULL;
  END IF;

  IF v_flow = 'B2C' THEN
    -- Cliente <-> Loja
    IF v_caller = v_buyer_id AND p_ratee_id = v_seller_id THEN
      v_valid_pair := TRUE; v_caller_role := 'cliente'; v_ratee_role := 'loja';
    ELSIF v_caller = v_seller_id AND p_ratee_id = v_buyer_id THEN
      v_valid_pair := TRUE; v_caller_role := 'loja'; v_ratee_role := 'cliente';
    -- Cliente <-> Motoboy
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_buyer_id AND p_ratee_id = v_driver_id THEN
      v_valid_pair := TRUE; v_caller_role := 'cliente'; v_ratee_role := 'motorista';
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_driver_id AND p_ratee_id = v_buyer_id THEN
      v_valid_pair := TRUE; v_caller_role := 'motorista'; v_ratee_role := 'cliente';
    -- Loja <-> Motoboy
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_seller_id AND p_ratee_id = v_driver_id THEN
      v_valid_pair := TRUE; v_caller_role := 'loja'; v_ratee_role := 'motorista';
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_driver_id AND p_ratee_id = v_seller_id THEN
      v_valid_pair := TRUE; v_caller_role := 'motorista'; v_ratee_role := 'loja';
    END IF;
  ELSIF v_flow = 'B2B' THEN
    -- Loja compradora <-> Fornecedor
    IF v_caller = v_buyer_id AND p_ratee_id = v_seller_id THEN
      v_valid_pair := TRUE; v_caller_role := 'loja'; v_ratee_role := 'fornecedor';
    ELSIF v_caller = v_seller_id AND p_ratee_id = v_buyer_id THEN
      v_valid_pair := TRUE; v_caller_role := 'fornecedor'; v_ratee_role := 'loja';
    -- Loja compradora <-> Caminhoneiro
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_buyer_id AND p_ratee_id = v_driver_id THEN
      v_valid_pair := TRUE; v_caller_role := 'loja'; v_ratee_role := 'caminhao';
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_driver_id AND p_ratee_id = v_buyer_id THEN
      v_valid_pair := TRUE; v_caller_role := 'caminhao'; v_ratee_role := 'loja';
    -- Fornecedor <-> Caminhoneiro
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_seller_id AND p_ratee_id = v_driver_id THEN
      v_valid_pair := TRUE; v_caller_role := 'fornecedor'; v_ratee_role := 'caminhao';
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_driver_id AND p_ratee_id = v_seller_id THEN
      v_valid_pair := TRUE; v_caller_role := 'caminhao'; v_ratee_role := 'fornecedor';
    END IF;
  ELSIF v_flow = 'COLETA' THEN
    -- Loja <-> Caçamba
    IF v_driver_id IS NOT NULL AND v_caller = v_buyer_id AND p_ratee_id = v_driver_id THEN
      v_valid_pair := TRUE; v_caller_role := 'loja'; v_ratee_role := 'caminhao';
    ELSIF v_driver_id IS NOT NULL AND v_caller = v_driver_id AND p_ratee_id = v_buyer_id THEN
      v_valid_pair := TRUE; v_caller_role := 'caminhao'; v_ratee_role := 'loja';
    END IF;
  END IF;

  IF NOT v_valid_pair THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não faz parte desta avaliação neste pedido.');
  END IF;

  -- Regras de comentário
  IF COALESCE(v_comments_enabled, true) = false THEN
    v_clean_comment := NULL;
  ELSE
    v_clean_comment := NULLIF(trim(COALESCE(p_comment, '')), '');
    IF v_clean_comment IS NOT NULL THEN
      IF char_length(v_clean_comment) > 280 THEN
        RETURN jsonb_build_object('success', false, 'error', 'O comentário deve ter no máximo 280 caracteres.');
      END IF;

      v_digits_only := regexp_replace(v_clean_comment, '[^0-9]', '', 'g');

      -- Bloquear e-mail, telefone (8+ dígitos seguidos ou na frase), CPF ou CNPJ
      IF v_clean_comment ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
         OR char_length(v_digits_only) >= 8
         OR v_clean_comment ~ '\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}'
         OR v_clean_comment ~ '\d{2}\.?\d{3}\.?\d{3}/?\d{4}[-.]?\d{2}' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não coloque dados pessoais no comentário');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.ratings (
    order_id, flow, rater_id, rater_role, ratee_id, ratee_role,
    stars, comment, status, created_at, updated_at
  )
  VALUES (
    p_order_id, v_flow, v_caller, v_caller_role, p_ratee_id, v_ratee_role,
    p_stars, v_clean_comment, 'VISIBLE', NOW(), NOW()
  )
  ON CONFLICT (order_id, rater_id, ratee_id) DO UPDATE
    SET stars      = EXCLUDED.stars,
        comment    = EXCLUDED.comment,
        updated_at = NOW()
  RETURNING id INTO v_rating_id;

  RETURN jsonb_build_object(
    'success', true,
    'rating_id', v_rating_id,
    'stars', p_stars,
    'comment', v_clean_comment
  );
END;
$$;

-- 2. RPC: rating_report_create (6.2) -------------------------------------------
CREATE OR REPLACE FUNCTION public.rating_report_create(
  p_rating_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_reason TEXT := trim(COALESCE(p_reason, ''));
  v_rating RECORD;
  v_report_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  IF p_rating_id IS NULL OR v_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o motivo da denúncia.');
  END IF;

  IF char_length(v_reason) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motivo muito longo (máximo 500 caracteres).');
  END IF;

  SELECT * INTO v_rating FROM public.ratings WHERE id = p_rating_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avaliação não encontrada.');
  END IF;

  -- Evitar denúncia duplicada aberta pelo mesmo usuário para a mesma avaliação
  IF EXISTS (
    SELECT 1 FROM public.rating_reports rr
     WHERE rr.rating_id = p_rating_id
       AND rr.reporter_id = v_caller
       AND rr.status = 'OPEN'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_reported', true, 'message', 'Denúncia já registrada e em análise.');
  END IF;

  INSERT INTO public.rating_reports (rating_id, reporter_id, reason, status, created_at)
  VALUES (p_rating_id, v_caller, v_reason, 'OPEN', NOW())
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'message', 'Denúncia enviada para análise da moderação.'
  );
END;
$$;

-- 3. RPC: admin_rating_moderate (6.2) ------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_rating_moderate(
  p_rating_id UUID,
  p_status TEXT,
  p_resolution TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_target_status TEXT := upper(trim(COALESCE(p_status, '')));
  v_before RECORD;
  v_report_status TEXT;
BEGIN
  IF NOT v_is_service AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem moderar avaliações.');
  END IF;

  IF v_target_status NOT IN ('VISIBLE', 'HIDDEN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido. Use VISIBLE ou HIDDEN.');
  END IF;

  SELECT * INTO v_before FROM public.ratings WHERE id = p_rating_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avaliação não encontrada.');
  END IF;

  UPDATE public.ratings
     SET status         = v_target_status,
         hidden_reason  = CASE WHEN v_target_status = 'HIDDEN' THEN COALESCE(NULLIF(trim(p_resolution), ''), 'Ocultado pela moderação') ELSE NULL END,
         hidden_by      = CASE WHEN v_target_status = 'HIDDEN' THEN v_caller ELSE NULL END,
         updated_at     = NOW()
   WHERE id = p_rating_id;

  v_report_status := CASE WHEN v_target_status = 'HIDDEN' THEN 'RESOLVED_HIDDEN' ELSE 'RESOLVED_KEPT' END;

  UPDATE public.rating_reports
     SET status      = v_report_status,
         resolved_by = v_caller,
         resolved_at = NOW()
   WHERE rating_id = p_rating_id
     AND status = 'OPEN';

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, before_state, after_state, created_at
  )
  VALUES (
    v_caller,
    'ADMIN_RATING_MODERATE',
    'rating',
    p_rating_id::text,
    jsonb_build_object('status', v_before.status, 'hidden_reason', v_before.hidden_reason),
    jsonb_build_object('status', v_target_status, 'resolution', p_resolution, 'report_status', v_report_status),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'rating_id', p_rating_id,
    'status', v_target_status,
    'report_status', v_report_status
  );
END;
$$;

-- 4. RPCs auxiliares de leitura para o app e Admin -----------------------------
CREATE OR REPLACE FUNCTION public.get_order_ratings_for_me(p_order_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_items JSONB := '[]'::jsonb;
  v_window_days INT := 7;
  v_min_display INT := 3;
  v_comments_enabled BOOLEAN := TRUE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  SELECT COALESCE(rating_window_days, 7),
         COALESCE(rating_min_count_display, 3),
         COALESCE(rating_comments_enabled, true)
    INTO v_window_days, v_min_display, v_comments_enabled
    FROM public.platform_settings
   LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'order_id', r.order_id,
        'flow', r.flow,
        'ratee_id', r.ratee_id,
        'ratee_role', r.ratee_role,
        'stars', r.stars,
        'comment', r.comment,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.ratings r
  WHERE r.rater_id = v_caller
    AND (p_order_id IS NULL OR r.order_id = p_order_id);

  RETURN jsonb_build_object(
    'success', true,
    'ratings', v_items,
    'rating_window_days', COALESCE(v_window_days, 7),
    'rating_min_count_display', COALESCE(v_min_display, 3),
    'rating_comments_enabled', COALESCE(v_comments_enabled, true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_ratings_for_user(p_ratee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_avg NUMERIC := NULL;
  v_cnt INT := 0;
  v_min_display INT := 3;
  v_comments JSONB := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  SELECT COALESCE(rating_min_count_display, 3)
    INTO v_min_display
    FROM public.platform_settings
   LIMIT 1;

  SELECT s.avg_stars, s.rating_count
    INTO v_avg, v_cnt
    FROM public.user_rating_summary s
   WHERE s.ratee_id = p_ratee_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', rp.id,
        'flow', rp.flow,
        'ratee_id', rp.ratee_id,
        'ratee_role', rp.ratee_role,
        'rater_role', rp.rater_role,
        'stars', rp.stars,
        'comment', rp.comment,
        'created_at', rp.created_at
      )
      ORDER BY rp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_comments
  FROM (
    SELECT *
      FROM public.ratings_public p
     WHERE p.ratee_id = p_ratee_id
       AND p.comment IS NOT NULL
     ORDER BY p.created_at DESC
     LIMIT 30
  ) rp;

  RETURN jsonb_build_object(
    'success', true,
    'ratee_id', p_ratee_id,
    'avg_stars', v_avg,
    'rating_count', COALESCE(v_cnt, 0),
    'min_count_display', COALESCE(v_min_display, 3),
    'comments', v_comments
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_ratings_moderation()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_service BOOLEAN := (COALESCE(auth.role(), 'anon') = 'service_role');
  v_reports JSONB := '[]'::jsonb;
  v_ratings JSONB := '[]'::jsonb;
BEGIN
  IF NOT v_is_service AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso restrito ao administrador.');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'report_id', rr.id,
        'report_status', rr.status,
        'reason', rr.reason,
        'reported_at', rr.created_at,
        'reporter_name', u_rep.name,
        'rating_id', r.id,
        'order_id', r.order_id,
        'flow', r.flow,
        'stars', r.stars,
        'comment', r.comment,
        'rating_status', r.status,
        'rater_id', r.rater_id,
        'rater_name', u_rater.name,
        'rater_role', r.rater_role,
        'ratee_id', r.ratee_id,
        'ratee_name', u_ratee.name,
        'ratee_role', r.ratee_role,
        'rating_created_at', r.created_at
      )
      ORDER BY (CASE WHEN rr.status = 'OPEN' THEN 0 ELSE 1 END), rr.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_reports
  FROM public.rating_reports rr
  JOIN public.ratings r ON r.id = rr.rating_id
  LEFT JOIN public.users u_rep ON u_rep.id = rr.reporter_id
  LEFT JOIN public.users u_rater ON u_rater.id = r.rater_id
  LEFT JOIN public.users u_ratee ON u_ratee.id = r.ratee_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'rating_id', x.id,
        'order_id', x.order_id,
        'flow', x.flow,
        'stars', x.stars,
        'comment', x.comment,
        'status', x.status,
        'hidden_reason', x.hidden_reason,
        'rater_id', x.rater_id,
        'rater_name', x.rater_name,
        'rater_role', x.rater_role,
        'ratee_id', x.ratee_id,
        'ratee_name', x.ratee_name,
        'ratee_role', x.ratee_role,
        'created_at', x.created_at
      )
      ORDER BY x.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_ratings
  FROM (
    SELECT r.*, u_rater.name AS rater_name, u_ratee.name AS ratee_name
      FROM public.ratings r
      LEFT JOIN public.users u_rater ON u_rater.id = r.rater_id
      LEFT JOIN public.users u_ratee ON u_ratee.id = r.ratee_id
     ORDER BY r.created_at DESC
     LIMIT 100
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'reports', v_reports,
    'ratings', v_ratings
  );
END;
$$;

-- 5. Permissões -----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.rating_submit(uuid, uuid, int, text)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rating_report_create(uuid, text)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_rating_moderate(uuid, text, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_order_ratings_for_me(uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_ratings_for_user(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_ratings_moderation()            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rating_submit(uuid, uuid, int, text)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rating_report_create(uuid, text)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_rating_moderate(uuid, text, text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_ratings_for_me(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_ratings_for_user(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_ratings_moderation()            TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
