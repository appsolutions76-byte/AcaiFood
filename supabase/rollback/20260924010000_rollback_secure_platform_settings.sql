-- Rollback: 20260924010000_rollback_secure_platform_settings.sql
-- Description: Reverte migração de segurança de platform_settings

-- 1. Restaurar SELECT geral em platform_settings
GRANT SELECT ON public.platform_settings TO anon, authenticated;

-- 2. Remover coluna charged_amount (opcional / conservador: mantendo coluna para evitar perda de histórico)
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS charged_amount;
