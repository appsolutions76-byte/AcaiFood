-- ==============================================================================
-- AÇAÍFOOD R47 — Mais de uma conta do app na mesma subconta Asaas (mesmo CPF/CNPJ)
-- e registro das requisições ao Asaas (para o suporte).
-- Só ADICIONA tabelas, uma coluna e um índice; nada existente muda.
-- Tabelas acessadas apenas pelo servidor (service_role).
-- Timestamp: 20261104020000
-- Reversão: supabase/rollback/20261104020000_r47_shared_payment_accounts_rollback.sql
-- ==============================================================================

-- 1. Registro das requisições ao Asaas (sem chaves secretas)
CREATE TABLE IF NOT EXISTS public.asaas_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  action text NOT NULL,
  method text,
  endpoint text,
  request_body jsonb,
  response_status integer,
  response_body jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS idx_asaas_request_log_created ON public.asaas_request_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asaas_request_log_user ON public.asaas_request_log (user_id);
ALTER TABLE public.asaas_request_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asaas_request_log FROM anon, authenticated;
GRANT ALL ON public.asaas_request_log TO service_role;

-- 2. Vínculo de contas do app à subconta da conta principal (mesmo CPF/CNPJ)
CREATE TABLE IF NOT EXISTS public.payment_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  linked_user_id uuid NOT NULL,
  cpf_cnpj text NOT NULL,
  asaas_account_id text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED')),
  can_withdraw boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  CONSTRAINT payment_account_links_not_self CHECK (owner_user_id <> linked_user_id)
);
-- Uma conta só pode ter um vínculo aberto (pendente ou ativo) por vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_account_links_open
  ON public.payment_account_links (linked_user_id)
  WHERE status IN ('PENDING', 'ACTIVE');
CREATE INDEX IF NOT EXISTS idx_payment_account_links_owner ON public.payment_account_links (owner_user_id, status);
ALTER TABLE public.payment_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_account_links FROM anon, authenticated;
GRANT ALL ON public.payment_account_links TO service_role;

-- 3. Trava de saque por subconta: no máximo UM saque aberto por grupo (conta principal + vinculadas)
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS account_group_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_open_per_account_group
  ON public.withdrawal_requests (account_group_id)
  WHERE status IN ('PENDENTE', 'APROVADO', 'PROCESSING') AND account_group_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
