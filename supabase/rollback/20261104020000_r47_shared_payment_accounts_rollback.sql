-- Reversão da R47 (antes, desvincule as contas pelo Admin para limpar as chaves copiadas)
DROP INDEX IF EXISTS public.uq_withdrawal_open_per_account_group;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS account_group_id;
DROP TABLE IF EXISTS public.payment_account_links;
DROP TABLE IF EXISTS public.asaas_request_log;
NOTIFY pgrst, 'reload schema';
