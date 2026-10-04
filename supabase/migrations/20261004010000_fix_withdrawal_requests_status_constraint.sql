-- ==============================================================================
-- AÇAÍFOOD — Correção de Constraint de Status e Colunas de Saque (withdrawal_requests)
-- Timestamp: 20261004010000
-- ==============================================================================

-- 1. Remover constraint antiga se existir
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;

-- 2. Adicionar constraint atualizada permitindo PROCESSING
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN ('PENDENTE', 'APROVADO', 'PROCESSING', 'REJEITADO', 'PAGO', 'FALHOU'));

-- 3. Garantir coluna transfer_attempt_id e seu índice
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS transfer_attempt_id TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_transfer_attempt_id
  ON public.withdrawal_requests(transfer_attempt_id)
  WHERE transfer_attempt_id IS NOT NULL;

-- 4. Garantir colunas de integração financeira na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_account_status TEXT,
  ADD COLUMN IF NOT EXISTS asaas_account_api_key TEXT,
  ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN DEFAULT FALSE;

-- 5. Notificar PostgREST para recarregar o schema de cache
NOTIFY pgrst, 'reload schema';

