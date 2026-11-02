-- ==============================================================================
-- ROLLBACK R39 (FASE 6): AVALIAÇÕES 1 A 5 ESTRELAS, DENÚNCIAS E MODERAÇÃO
-- ==============================================================================

DROP FUNCTION IF EXISTS public.admin_get_ratings_moderation();
DROP FUNCTION IF EXISTS public.get_public_ratings_for_user(uuid);
DROP FUNCTION IF EXISTS public.get_order_ratings_for_me(uuid);
DROP FUNCTION IF EXISTS public.admin_rating_moderate(uuid, text, text);
DROP FUNCTION IF EXISTS public.rating_report_create(uuid, text);
DROP FUNCTION IF EXISTS public.rating_submit(uuid, uuid, int, text);

NOTIFY pgrst, 'reload schema';
