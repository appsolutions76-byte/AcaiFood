-- ==============================================================================
-- AÇAÍFOOD R39 — FASE 1: INDICAÇÕES DE PARCEIROS E AVALIAÇÕES (SCHEMA E RLS)
-- Timestamp: 20261102010000
-- 100% aditiva, segura para produção, sem quebra de compatibilidade.
-- Reversão: supabase/rollback/20261102010000_r39_indicacoes_e_avaliacoes_schema_rollback.sql
-- ==============================================================================

-- 1.1 Tabela partner_referrals -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flow TEXT NOT NULL CHECK (flow IN ('B2C', 'B2B', 'COLETA')),
  origin TEXT NOT NULL CHECK (origin IN ('PARTNER_INVITE', 'DRIVER_REQUEST')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DECLINED', 'REMOVED', 'EXPIRED')),
  driver_serves BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Índice único parcial: apenas uma indicação ativa ou pendente por par e fluxo
CREATE UNIQUE INDEX IF NOT EXISTS unq_partner_referrals_active
  ON public.partner_referrals (partner_id, driver_id, flow)
  WHERE status IN ('PENDING', 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_status
  ON public.partner_referrals (partner_id, status);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_driver_status
  ON public.partner_referrals (driver_id, status);

-- 1.2 Tabela referral_invite_links ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flow TEXT NOT NULL CHECK (flow IN ('B2C', 'B2B', 'COLETA')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_invite_links_partner_flow
  ON public.referral_invite_links (partner_id, flow);

CREATE INDEX IF NOT EXISTS idx_referral_invite_links_token_active
  ON public.referral_invite_links (token_hash)
  WHERE revoked_at IS NULL;

-- 1.3 Colunas novas (com defaults que preservam o comportamento atual) ----------

-- Usuários: vendedor e motorista
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS serve_mode TEXT NOT NULL DEFAULT 'ALL';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_dispatch_mode_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_dispatch_mode_check
      CHECK (dispatch_mode IN ('ALL', 'REFERRED_FIRST', 'REFERRED_ONLY'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_serve_mode_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_serve_mode_check
      CHECK (serve_mode IN ('ALL', 'SELECTED'));
  END IF;
END $$;

-- Pedidos (orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS radar_open_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispatch_called_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS stuck_alert_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS self_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assigned_via_referral BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispatch_mode_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_platform_fee_pct_applied NUMERIC NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_dispatch_mode_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_dispatch_mode_check
      CHECK (dispatch_mode IN ('ALL', 'REFERRED_FIRST', 'REFERRED_ONLY'));
  END IF;
END $$;

-- Cidades (cities)
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS referrals_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ratings_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS b2c_delivery_platform_fee_pct_referred NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS b2c_referred_exclusive_seconds INT NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS b2c_stuck_order_alert_seconds INT NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS b2b_delivery_platform_fee_pct_referred NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS b2b_referred_exclusive_seconds INT NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS b2b_stuck_order_alert_seconds INT NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS col_delivery_platform_fee_pct_referred NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS col_referred_exclusive_seconds INT NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS col_stuck_order_alert_seconds INT NOT NULL DEFAULT 300;

-- Configurações globais de avaliações (platform_settings)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS rating_window_days INT DEFAULT 7,
  ADD COLUMN IF NOT EXISTS rating_min_count_display INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS rating_comments_enabled BOOLEAN DEFAULT TRUE;

-- 1.4 Tabelas de avaliação -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rater_role TEXT NOT NULL,
  ratee_role TEXT NOT NULL,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT NULL CHECK (comment IS NULL OR CHAR_LENGTH(comment) <= 280),
  status TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE', 'HIDDEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unq_ratings_order_rater_ratee UNIQUE (order_id, rater_id, ratee_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_ratee_status ON public.ratings (ratee_id, status);
CREATE INDEX IF NOT EXISTS idx_ratings_order_id ON public.ratings (order_id);

CREATE TABLE IF NOT EXISTS public.rating_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES public.ratings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolution TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_rating_reports_rating ON public.rating_reports (rating_id);
CREATE INDEX IF NOT EXISTS idx_rating_reports_pending ON public.rating_reports (resolved_at) WHERE resolved_at IS NULL;

-- View pública de avaliações: sem expor rater_id para preservar a privacidade
CREATE OR REPLACE VIEW public.ratings_public AS
SELECT
  id,
  order_id,
  ratee_id,
  rater_role,
  ratee_role,
  stars,
  comment,
  status,
  created_at
FROM public.ratings
WHERE status = 'VISIBLE';

-- View sumário com média calculada apenas para avaliações VISIBLE (null se menor que min_count)
CREATE OR REPLACE VIEW public.user_rating_summary AS
WITH cfg AS (
  SELECT COALESCE((SELECT rating_min_count_display FROM public.platform_settings LIMIT 1), 5) AS min_count
),
agg AS (
  SELECT
    ratee_id,
    ROUND(AVG(stars)::numeric, 1) AS raw_avg,
    COUNT(*)::bigint AS count_visible
  FROM public.ratings
  WHERE status = 'VISIBLE'
  GROUP BY ratee_id
)
SELECT
  agg.ratee_id,
  CASE
    WHEN agg.count_visible >= cfg.min_count THEN agg.raw_avg
    ELSE NULL
  END AS avg_stars,
  agg.count_visible AS rating_count
FROM agg
CROSS JOIN cfg;

-- 1.5 RLS e Concessões ---------------------------------------------------------

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partner_referrals FROM anon;
REVOKE ALL ON public.referral_invite_links FROM anon;
REVOKE ALL ON public.ratings FROM anon;
REVOKE ALL ON public.rating_reports FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.partner_referrals FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.referral_invite_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ratings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.rating_reports FROM anon, authenticated;

DROP POLICY IF EXISTS "partner_referrals_select" ON public.partner_referrals;
CREATE POLICY "partner_referrals_select" ON public.partner_referrals
  FOR SELECT TO authenticated
  USING (
    partner_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "referral_invite_links_select" ON public.referral_invite_links;
CREATE POLICY "referral_invite_links_select" ON public.referral_invite_links
  FOR SELECT TO authenticated
  USING (
    partner_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "ratings_select_own_or_admin" ON public.ratings;
CREATE POLICY "ratings_select_own_or_admin" ON public.ratings
  FOR SELECT TO authenticated
  USING (
    rater_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "rating_reports_select_own_or_admin" ON public.rating_reports;
CREATE POLICY "rating_reports_select_own_or_admin" ON public.rating_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid() OR public.is_admin()
  );

-- Concessões de leitura nas views
GRANT SELECT ON public.ratings_public TO authenticated, anon, service_role;
GRANT SELECT ON public.user_rating_summary TO authenticated, anon, service_role;

-- Concessões de leitura nas novas colunas
GRANT SELECT (dispatch_mode, serve_mode) ON public.users TO authenticated;
GRANT SELECT (
  dispatch_mode,
  radar_open_at,
  dispatch_called_at,
  stuck_alert_sent_at,
  self_delivery,
  assigned_via_referral,
  dispatch_mode_snapshot,
  delivery_platform_fee_pct_applied
) ON public.orders TO authenticated;

-- Service role tem acesso completo (usado pelas rotas Next.js e RPCs)
GRANT ALL ON public.partner_referrals TO service_role;
GRANT ALL ON public.referral_invite_links TO service_role;
GRANT ALL ON public.ratings TO service_role;
GRANT ALL ON public.rating_reports TO service_role;

NOTIFY pgrst, 'reload schema';
