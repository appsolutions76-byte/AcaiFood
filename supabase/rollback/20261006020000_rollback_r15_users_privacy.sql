-- Rollback: 20261006020000_rollback_r15_users_privacy.sql
-- Devolve as chaves das subcontas para users ANTES de apagar partner_secrets
-- (o Asaas só mostra a chave na criação; apagar sem copiar perde a chave).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS asaas_account_api_key TEXT;

UPDATE public.users u
SET asaas_account_api_key = s.asaas_account_api_key
FROM public.partner_secrets s
WHERE s.user_id = u.id;

DROP TABLE IF EXISTS public.partner_secrets CASCADE;
DROP FUNCTION IF EXISTS public.get_my_profile();
NOTIFY pgrst, 'reload schema';
