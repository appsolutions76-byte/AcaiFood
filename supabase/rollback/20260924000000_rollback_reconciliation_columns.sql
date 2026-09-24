-- Rollback: 20260924000000_rollback_reconciliation_columns.sql
-- Description: Reverte a adição de colunas de conciliação manual

DROP INDEX IF EXISTS public.idx_orders_reconciliation;

ALTER TABLE public.orders 
  DROP COLUMN IF EXISTS payment_reconciled_manually,
  DROP COLUMN IF EXISTS charged_amount,
  DROP COLUMN IF EXISTS pix_end_to_end_id,
  DROP COLUMN IF EXISTS reconciled_by,
  DROP COLUMN IF EXISTS reconciled_at;
