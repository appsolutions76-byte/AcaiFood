-- ==============================================================================
-- ROLLBACK R39 (FASE 6): AVALIAÇÕES 1 A 5 ESTRELAS, DENÚNCIAS E MODERAÇÃO
-- ==============================================================================

DROP FUNCTION IF EXISTS public.admin_get_ratings_moderation();
DROP FUNCTION IF EXISTS public.get_public_ratings_for_user(uuid);
DROP FUNCTION IF EXISTS public.get_order_ratings_for_me(uuid);
DROP FUNCTION IF EXISTS public.admin_rating_moderate(uuid, text, text);
DROP FUNCTION IF EXISTS public.rating_report_create(uuid, text);
DROP FUNCTION IF EXISTS public.rating_submit(uuid, uuid, int, text);

ALTER TABLE public.rating_reports
  DROP COLUMN IF EXISTS status;

ALTER TABLE public.ratings
  DROP COLUMN IF EXISTS hidden_by,
  DROP COLUMN IF EXISTS hidden_reason,
  DROP COLUMN IF EXISTS flow;

NOTIFY pgrst, 'reload schema';
