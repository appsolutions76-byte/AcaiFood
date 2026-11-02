-- ==============================================================================
-- ROLLBACK: AÇAÍFOOD R39 — FASE 1B: PRIVACIDADE DAS VIEWS DE AVALIAÇÃO E GUARDA DE COLUNAS
-- Timestamp: 20261102010100
-- Para reverter toda a Fase 1 (F1 + F1b), execute em seguida:
-- supabase/rollback/20261102010000_r39_indicacoes_e_avaliacoes_schema_rollback.sql
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_r39_protect_orders_referral_fields ON public.orders;
DROP FUNCTION IF EXISTS public.r39_protect_orders_referral_fields();

DROP TRIGGER IF EXISTS trg_r39_protect_users_referral_fields ON public.users;
DROP FUNCTION IF EXISTS public.r39_protect_users_referral_fields();

DROP VIEW IF EXISTS public.ratings_public;

CREATE VIEW public.ratings_public AS
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

REVOKE ALL ON public.ratings_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_rating_summary FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.ratings_public TO authenticated, anon, service_role;
GRANT SELECT ON public.user_rating_summary TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
