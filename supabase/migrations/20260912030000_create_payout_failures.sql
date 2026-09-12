-- ==========================================================
-- AÇAÍFOOD — PAYOUT FAILURES LOG TABLE (MIGRATION)
-- Timestamp: 20260912030000
-- Item P2.2 do PROMPT_CORRECOES_ANTIGRAVITY.md
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.payout_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('seller', 'driver')),
  attempted_value NUMERIC(12,2) NOT NULL,
  asaas_response JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_failures_order_id ON public.payout_failures(order_id);

ALTER TABLE public.payout_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payout Failures Admin Select" ON public.payout_failures;
CREATE POLICY "Payout Failures Admin Select" ON public.payout_failures
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Payout Failures Service Role Modify" ON public.payout_failures;
CREATE POLICY "Payout Failures Service Role Modify" ON public.payout_failures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
