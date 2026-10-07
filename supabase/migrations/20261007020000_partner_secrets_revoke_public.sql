-- ==============================================================================
-- AÇAÍFOOD — partner_secrets só para service_role
-- Timestamp: 20261007020000
-- A tabela guarda a chave de API de cada subconta Asaas. Ela tinha RLS ligado, mas
-- os papéis anon e authenticated ainda tinham GRANT de leitura/escrita (padrão do
-- Supabase). Remove os GRANTs: só o servidor (service_role) acessa.
-- ==============================================================================
ALTER TABLE public.partner_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_secrets FROM anon, authenticated;
GRANT ALL ON public.partner_secrets TO service_role;
NOTIFY pgrst, 'reload schema';
