-- ==============================================================================
-- AÇAÍFOOD — Limpeza das subcontas criadas com a chave SANDBOX do Asaas
-- Rodar UMA vez, logo DEPOIS de trocar ASAAS_API_KEY de Production pela chave de PRODUÇÃO.
--
-- Por quê: até 07/10/2026 a Vercel Production usava uma chave sandbox. As subcontas,
-- walletIds e a situação "APPROVED" gravadas em users vieram do sandbox (ou do antigo
-- default 'APPROVED') e não existem na conta Asaas de produção.
--
-- O que faz:
--  1. Guarda uma cópia dos campos atuais em public.users_asaas_backup_20261007.
--  2. Zera subconta, walletId, split e situação de todos os usuários.
--     Parceiros voltam para "PENDING_DOCUMENTS" (abrem a conta de novo pelo cartão
--     "Minha conta Asaas"); clientes ficam sem situação (não precisam de subconta).
--  3. Pedidos e saques antigos ficam como histórico (não são apagados).
-- Reversão: ver o bloco no fim do arquivo.
-- ==============================================================================

BEGIN;

-- O trigger protect_users_financial_fields só deixa service_role mudar esses campos
SELECT set_config('request.jwt.claim.role', 'service_role', true),
       set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE TABLE IF NOT EXISTS public.users_asaas_backup_20261007 AS
SELECT id, role, asaas_account_id, asaas_wallet_id, asaas_account_status,
       asaas_account_status_detail, split_enabled, NOW() AS backed_up_at
FROM public.users;
ALTER TABLE public.users_asaas_backup_20261007 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users_asaas_backup_20261007 FROM anon, authenticated;

UPDATE public.users
SET asaas_account_id = NULL,
    asaas_wallet_id = NULL,
    split_enabled = FALSE,
    asaas_account_status_detail = NULL,
    asaas_account_status = CASE
      WHEN upper(COALESCE(role, '')) IN ('CLIENT', 'CLIENTE', 'ADMIN') THEN NULL
      ELSE 'PENDING_DOCUMENTS'
    END;

DELETE FROM public.partner_secrets;

INSERT INTO public.admin_audit_log (action, target_type, target_id, after_state)
VALUES ('ASAAS_SANDBOX_SUBACCOUNTS_RESET', 'SYSTEM', 'users',
        jsonb_build_object('motivo', 'troca da chave sandbox pela chave de produção', 'backup', 'users_asaas_backup_20261007'));

COMMIT;

-- Reversão (só se precisar voltar):
-- UPDATE public.users u SET asaas_account_id = b.asaas_account_id, asaas_wallet_id = b.asaas_wallet_id,
--   asaas_account_status = b.asaas_account_status, asaas_account_status_detail = b.asaas_account_status_detail,
--   split_enabled = b.split_enabled
-- FROM public.users_asaas_backup_20261007 b WHERE b.id = u.id;
