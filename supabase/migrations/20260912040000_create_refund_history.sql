-- ==========================================================
-- AÇAÍFOOD — REFUND HISTORY TABLE (MIGRATION)
-- Timestamp: 20260912040000
-- Item P2.7 do PROMPT_CORRECOES_ANTIGRAVITY.md
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.refund_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  requested_value NUMERIC(12,2) NOT NULL CHECK (requested_value > 0),
  asaas_refund_id TEXT,
  status TEXT DEFAULT 'SUCCESS',
  requested_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_history_payment_id ON public.refund_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_history_order_id ON public.refund_history(order_id);

ALTER TABLE public.refund_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Refund History Select Admin and Owner" ON public.refund_history;
CREATE POLICY "Refund History Select Admin and Owner" ON public.refund_history
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Refund History Service Role Modify" ON public.refund_history;
CREATE POLICY "Refund History Service Role Modify" ON public.refund_history
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
