-- Migration: 20260924000000_add_reconciliation_columns.sql
-- Description: Adiciona colunas para conciliação manual de pagamentos Pix fora do Asaas e valor cobrado oficial

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_reconciled_manually BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS charged_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_end_to_end_id TEXT,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_reconciliation 
  ON public.orders (payment_reconciled_manually, created_at DESC);
