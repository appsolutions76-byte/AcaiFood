-- Reversão do R33: devolve TRUNCATE (padrão do Supabase) e o acesso à tabela de backup
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT TRUNCATE ON public.%I TO anon, authenticated', t.tablename);
  END LOOP;
  IF to_regclass('public.users_asaas_backup_20261007') IS NOT NULL THEN
    EXECUTE 'GRANT ALL ON public.users_asaas_backup_20261007 TO anon, authenticated';
    EXECUTE 'ALTER TABLE public.users_asaas_backup_20261007 DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
