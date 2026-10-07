-- Rollback de 20261006030000_r16_users_privacy_account_status_radar.sql
-- Volta a leitura ampla de users (menos seguro). Usar só se o app R16 não estiver no ar.
DROP TRIGGER IF EXISTS trg_protect_users_financial_fields ON public.users;
DROP FUNCTION IF EXISTS public.protect_users_financial_fields();
DROP TRIGGER IF EXISTS trg_admin_audit_log_append_only ON public.admin_audit_log;
DROP FUNCTION IF EXISTS public.admin_audit_log_append_only();
DROP FUNCTION IF EXISTS public.get_my_profile_json();
GRANT SELECT ON public.users TO authenticated;
-- A coluna asaas_account_status_detail é mantida (sem perda de dados).
-- get_driver_radar: reaplicar a versão de 20261003193000 se necessário.
NOTIFY pgrst, 'reload schema';
