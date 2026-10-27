-- ==============================================================================
-- AÇAÍFOOD R32 — Registro da validação de saques pelo Asaas (auditoria docs/31, A5)
-- Timestamp: 20261028030000
-- Só cria uma tabela nova de registro. Nada existente é alterado.
-- Reversão: supabase/rollback/20261028030000_r32_transfer_validation_log_rollback.sql
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transfer_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operation_type text NOT NULL,
  operation_id text,
  value numeric(12,2),
  external_reference text,
  decision text NOT NULL,
  kind text,
  reason text,
  payload jsonb
);
CREATE INDEX IF NOT EXISTS transfer_validation_log_created_idx ON public.transfer_validation_log (created_at DESC);

ALTER TABLE public.transfer_validation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transfer_validation_log FROM anon, authenticated;
GRANT SELECT ON public.transfer_validation_log TO authenticated;
DROP POLICY IF EXISTS "transfer_validation_log_admin_select" ON public.transfer_validation_log;
CREATE POLICY "transfer_validation_log_admin_select" ON public.transfer_validation_log
  FOR SELECT TO authenticated USING (public.is_admin());
GRANT ALL ON public.transfer_validation_log TO service_role;

NOTIFY pgrst, 'reload schema';
