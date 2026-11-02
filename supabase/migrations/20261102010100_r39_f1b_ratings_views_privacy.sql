-- ==============================================================================
-- AÇAÍFOOD R39 — FASE 1B: PRIVACIDADE DAS VIEWS DE AVALIAÇÃO E HARDENING DE GRANTS
-- Timestamp: 20261102010100
-- Complemento aditivo da migration 20261102010000:
-- 1. Remove order_id da view public.ratings_public (evita correlação indireta do avaliador).
-- 2. Revoga acesso de anon/PUBLIC em public.ratings_public e public.user_rating_summary,
--    mantendo SELECT apenas para authenticated e service_role.
-- 3. Reforça GRANT SELECT (sujeito a RLS) nas tabelas novas para authenticated e
--    REVOKE UPDATE explícito nas colunas de despacho/indicação em users e orders.
-- Reversão: supabase/rollback/20261102010100_r39_f1b_ratings_views_privacy_rollback.sql
-- ==============================================================================

-- 1. Recriar public.ratings_public sem order_id e sem rater_id ------------------
DROP VIEW IF EXISTS public.ratings_public;

CREATE VIEW public.ratings_public AS
SELECT
  id,
  ratee_id,
  rater_role,
  ratee_role,
  stars,
  comment,
  status,
  created_at
FROM public.ratings
WHERE status = 'VISIBLE';

-- 2. Permissões nas views: somente authenticated e service_role (sem anon) ------
REVOKE ALL ON public.ratings_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_rating_summary FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.ratings_public TO authenticated, service_role;
GRANT SELECT ON public.user_rating_summary TO authenticated, service_role;

-- 3. Garantir SELECT nas tabelas base para authenticated (filtrado pelas policies RLS)
GRANT SELECT ON public.partner_referrals TO authenticated;
GRANT SELECT ON public.referral_invite_links TO authenticated;
GRANT SELECT ON public.ratings TO authenticated;
GRANT SELECT ON public.rating_reports TO authenticated;

-- 4. Garantir bloqueio de UPDATE direto nas colunas novas de users e orders -----
REVOKE UPDATE (dispatch_mode, serve_mode) ON public.users FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (
  dispatch_mode,
  radar_open_at,
  dispatch_called_at,
  stuck_alert_sent_at,
  self_delivery,
  assigned_via_referral,
  dispatch_mode_snapshot,
  delivery_platform_fee_pct_applied
) ON public.orders FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
