-- Reverte 20261008010000_public_store_list.sql
DROP FUNCTION IF EXISTS public.get_public_stores();
NOTIFY pgrst, 'reload schema';
