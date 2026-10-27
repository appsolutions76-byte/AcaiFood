-- ==============================================================================
-- AÇAÍFOOD R33 — Limpeza de permissões (auditoria docs/31, B1)
-- Timestamp: 20261028040000
-- 1. Nenhum usuário do app (anon/authenticated) pode TRUNCATE em tabelas públicas
--    (o app nunca usa; o servidor usa service_role, que não muda).
-- 2. A tabela de backup users_asaas_backup_20261007 fica só para o servidor.
-- Reversão: supabase/rollback/20261028040000_r33_revoke_truncate_backup_rollback.sql
-- ==============================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
  IF to_regclass('public.users_asaas_backup_20261007') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.users_asaas_backup_20261007 FROM anon, authenticated';
    EXECUTE 'ALTER TABLE public.users_asaas_backup_20261007 ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
