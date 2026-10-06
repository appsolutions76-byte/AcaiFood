-- Rollback: 20261006020000_rollback_r15_users_privacy.sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS asaas_account_api_key TEXT;
DROP TABLE IF EXISTS public.partner_secrets CASCADE;
DROP FUNCTION IF EXISTS public.get_my_profile();
