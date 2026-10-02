-- ==============================================================================
-- AÇAÍFOOD — R14: Idempotência de Saques e Regras de Repasse (Item 3.1 & Fase 4)
-- Timestamp: 20261002080000
-- ==============================================================================

-- 1. Adicionar transfer_attempt_id em withdrawal_requests
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS transfer_attempt_id TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_transfer_attempt_id
  ON public.withdrawal_requests(transfer_attempt_id)
  WHERE transfer_attempt_id IS NOT NULL;

-- 2. Garantir coluna attempts e last_error em settlements
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_settlements_attempts
  ON public.settlements(status, attempts);

NOTIFY pgrst, 'reload schema';
