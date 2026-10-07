-- ==============================================================================
-- AÇAÍFOOD — Corrigir a situação "APPROVED" de quem NÃO tem subconta Asaas
--
-- Correção (07/10/2026): a chave de produção sempre foi lida do Supabase, então as
-- subcontas existentes são REAIS (produção) e NÃO são apagadas aqui.
--
-- O que faz:
--  1. Guarda uma cópia dos campos em public.users_asaas_backup_20261007.
--  2. Só para usuários SEM subconta (asaas_account_id e asaas_wallet_id vazios) que
--     aparecem como "APPROVED" (sobra do antigo valor padrão da coluna):
--       - parceiros → 'PENDING_DOCUMENTS' (abrem a conta pelo cartão "Minha conta Asaas");
--       - clientes e admin → sem situação (não precisam de subconta).
--  Subcontas reais, pedidos e saques não são alterados.
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
SET split_enabled = FALSE,
    asaas_account_status = CASE
      WHEN upper(COALESCE(role, '')) IN ('CLIENT', 'CLIENTE', 'ADMIN') THEN NULL
      ELSE 'PENDING_DOCUMENTS'
    END
WHERE asaas_account_status = 'APPROVED'
  AND NULLIF(trim(COALESCE(asaas_account_id, '')), '') IS NULL
  AND NULLIF(trim(COALESCE(asaas_wallet_id, '')), '') IS NULL;

INSERT INTO public.admin_audit_log (action, target_type, target_id, after_state)
VALUES ('ASAAS_STATUS_DEFAULT_CLEANUP', 'SYSTEM', 'users',
        jsonb_build_object('motivo', 'APPROVED sem subconta (valor padrão antigo)', 'backup', 'users_asaas_backup_20261007'));

COMMIT;

-- Reversão:
-- UPDATE public.users u SET asaas_account_status = b.asaas_account_status, split_enabled = b.split_enabled
-- FROM public.users_asaas_backup_20261007 b WHERE b.id = u.id;
