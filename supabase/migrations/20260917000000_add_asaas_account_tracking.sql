-- ==========================================================
-- AÇAÍFOOD — ADD ASAAS ACCOUNT API KEY TRACKING & ACCOUNT STATUS HISTORY
-- Timestamp: 20260917000000
-- Prompt de Correções — Rodada 3 (Items P1 & P4)
-- ==========================================================

-- 1. Adicionar coluna asaas_account_api_key na tabela public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS asaas_account_api_key text;

-- 2. Garantir que a coluna tenha comentário explicativo de segurança
COMMENT ON COLUMN public.users.asaas_account_api_key IS 'Chave de API individual da subconta Asaas do parceiro. Restrita ao backend/service_role.';

-- 3. Criar tabela account_status_history para auditoria de transições de status da subconta
CREATE TABLE IF NOT EXISTS public.account_status_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    asaas_account_id text,
    asaas_wallet_id text,
    from_status text,
    to_status text,
    actor_role text DEFAULT 'SYSTEM_ASAAS_WEBHOOK',
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS para account_status_history
ALTER TABLE public.account_status_history ENABLE ROW LEVEL SECURITY;

-- Admins podem ler histórico de conta
DROP POLICY IF EXISTS "Admins podem visualizar historico de conta" ON public.account_status_history;
CREATE POLICY "Admins podem visualizar historico de conta"
ON public.account_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND (lower(COALESCE(u.role, '')) = 'admin' OR u.is_admin = true)
  )
);

-- Service role tem acesso completo
GRANT ALL ON public.account_status_history TO service_role;

NOTIFY pgrst, 'reload schema';
