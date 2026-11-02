-- ==============================================================================
-- AÇAÍFOOD R39 — FASE 1B: PRIVACIDADE DAS VIEWS DE AVALIAÇÃO E GUARDA DE COLUNAS
-- Timestamp: 20261102010100
-- Complemento aditivo da migration 20261102010000:
-- 1. Remove order_id da view public.ratings_public (evita correlação indireta do avaliador).
-- 2. Revoga acesso de anon/PUBLIC em public.ratings_public e public.user_rating_summary,
--    mantendo SELECT apenas para authenticated e service_role.
-- 3. Reforça GRANT SELECT (sujeito a RLS) nas tabelas novas para authenticated e
--    bloqueia alterações diretas nas colunas novas de users e orders via trigger
--    (mesmo padrão de protect_users_financial_fields do R16).
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

-- 4. Guarda de colunas de indicação/despacho em users e orders ------------------
CREATE OR REPLACE FUNCTION public.r39_protect_users_referral_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), 'anon') = 'service_role'
     OR COALESCE(public.is_admin(), false)
     OR COALESCE(current_setting('acaifood.r39_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.dispatch_mode := 'ALL';
    NEW.serve_mode := 'ALL';
  ELSE
    NEW.dispatch_mode := OLD.dispatch_mode;
    NEW.serve_mode := OLD.serve_mode;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_r39_protect_users_referral_fields ON public.users;
CREATE TRIGGER trg_r39_protect_users_referral_fields
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.r39_protect_users_referral_fields();

CREATE OR REPLACE FUNCTION public.r39_protect_orders_referral_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), 'anon') = 'service_role'
     OR COALESCE(public.is_admin(), false)
     OR COALESCE(current_setting('acaifood.r39_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_r39_protect_orders_referral_fields ON public.orders;
CREATE TRIGGER trg_r39_protect_orders_referral_fields
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.r39_protect_orders_referral_fields();

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
