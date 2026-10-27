-- ==============================================================================
-- AÇAÍFOOD R28 — Registro do estorno (valor, data, código Pix e comprovante)
-- Timestamp: 20261027010000
-- Só adiciona colunas (não altera nem apaga dados). Compatível com o app no ar.
-- Reversão: supabase/rollback/20261027010000_r28_refund_receipt_rollback.sql
-- ==============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_value NUMERIC(12,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_receipt_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_e2e_id TEXT;

-- orders usa GRANT SELECT por coluna (R14): liberar as novas colunas para quem já vê o pedido (RLS continua valendo)
GRANT SELECT (refund_value, refunded_at, refund_receipt_url, refund_e2e_id) ON public.orders TO authenticated;

ALTER TABLE public.refund_history ADD COLUMN IF NOT EXISTS end_to_end_id TEXT;
ALTER TABLE public.refund_history ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.refund_history ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
