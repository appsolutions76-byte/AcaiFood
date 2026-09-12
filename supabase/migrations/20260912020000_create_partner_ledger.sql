-- ==========================================================
-- AÇAÍFOOD — PARTNER LEDGER TABLE & RLS (MIGRATION)
-- Timestamp: 20260912020000
-- Item P2.1 do PROMPT_CORRECOES_ANTIGRAVITY.md
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.partner_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para buscas por parceiro e histórico
CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner_id ON public.partner_ledger(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_order_id ON public.partner_ledger(order_id);

-- RLS
ALTER TABLE public.partner_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner Ledger Select Own" ON public.partner_ledger;
CREATE POLICY "Partner Ledger Select Own" ON public.partner_ledger
  FOR SELECT TO authenticated
  USING (partner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Partner Ledger Service Role Modify" ON public.partner_ledger;
CREATE POLICY "Partner Ledger Service Role Modify" ON public.partner_ledger
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
