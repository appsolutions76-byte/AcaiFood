-- =========================================================================
-- MIGRATION: 20261002090000_r14_support_tickets_asaas_and_terms_checks.sql
-- DESCRIÇÃO: Suporte a categorização financeira (K6), encaminhamento ao Asaas,
--            métrica de prazos (K7) e regularização de chamados.
-- AUTOR: AçaíFood Core Team / Asaas BaaS Compliance
-- DATA: 2026-10-02
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'support_messages' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.support_messages 
      ADD COLUMN category TEXT NOT NULL DEFAULT 'geral',
      ADD COLUMN forwarded_to_asaas BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN forwarded_to_asaas_at TIMESTAMPTZ,
      ADD COLUMN asaas_protocol TEXT,
      ADD COLUMN is_merited BOOLEAN,
      ADD COLUMN first_responded_at TIMESTAMPTZ,
      ADD COLUMN resolved_at TIMESTAMPTZ,
      ADD COLUMN resolution_notes TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_messages_category_created
  ON public.support_messages (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_forwarded_asaas
  ON public.support_messages (forwarded_to_asaas, created_at DESC);

NOTIFY pgrst, 'reload schema';
