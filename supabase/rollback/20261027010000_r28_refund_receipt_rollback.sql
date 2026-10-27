-- Reversão de 20261027010000_r28_refund_receipt.sql
-- ATENÇÃO: antes de rodar, volte o app para a versão anterior ao R28 (ele lê estas colunas).
REVOKE SELECT (refund_value, refunded_at, refund_receipt_url, refund_e2e_id) ON public.orders FROM authenticated;
ALTER TABLE public.orders DROP COLUMN IF EXISTS refund_value;
ALTER TABLE public.orders DROP COLUMN IF EXISTS refunded_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS refund_receipt_url;
ALTER TABLE public.orders DROP COLUMN IF EXISTS refund_e2e_id;
ALTER TABLE public.refund_history DROP COLUMN IF EXISTS end_to_end_id;
ALTER TABLE public.refund_history DROP COLUMN IF EXISTS receipt_url;
ALTER TABLE public.refund_history DROP COLUMN IF EXISTS refunded_at;
NOTIFY pgrst, 'reload schema';
