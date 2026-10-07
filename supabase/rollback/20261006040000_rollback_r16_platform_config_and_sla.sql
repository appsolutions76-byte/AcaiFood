-- Rollback de 20261006040000_r16_platform_config_and_sla.sql
-- O JSON antigo em platform_settings.asaas_platform_wallet_id não foi apagado pela
-- migration; o app volta a lê-lo automaticamente se platform_config não existir.
DROP TABLE IF EXISTS public.platform_config;
DROP TABLE IF EXISTS public.monthly_sla;
NOTIFY pgrst, 'reload schema';
