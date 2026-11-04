-- Reversão da R45: remove a hora da última posição
ALTER TABLE public.users DROP COLUMN IF EXISTS location_updated_at;
NOTIFY pgrst, 'reload schema';
