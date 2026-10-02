-- =========================================================================
-- ROLLBACK: 20261002090000_rollback_r14_support_tickets_asaas_and_terms_checks.sql
-- DESCRIÇÃO: Reversão dos campos de suporte financeiro e métricas Asaas.
-- =========================================================================

ALTER TABLE IF EXISTS public.support_messages 
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS forwarded_to_asaas,
  DROP COLUMN IF EXISTS forwarded_to_asaas_at,
  DROP COLUMN IF EXISTS asaas_protocol,
  DROP COLUMN IF EXISTS is_merited,
  DROP COLUMN IF EXISTS first_responded_at,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS resolution_notes;

DROP INDEX IF EXISTS idx_support_messages_category_created;
DROP INDEX IF EXISTS idx_support_messages_forwarded_asaas;

NOTIFY pgrst, 'reload schema';
