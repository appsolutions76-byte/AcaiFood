-- ═══════════════════════════════════════════════════
-- AÇAÍFOOD — SISTEMA DE PARCEIROS E SÓCIOS INVESTIDORES
-- Migration: 20261121010000_partners_system.sql
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════
-- PARTE A — SISTEMA DE PARCEIROS AFILIADOS
-- ═══════════════════════════════════════════════════

-- A1. Tabela principal de afiliados
CREATE TABLE IF NOT EXISTS public.partner_affiliates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invite_token        TEXT UNIQUE,
  invite_expires_at   TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended','revoked')),
  referral_code       TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  contact             TEXT,
  how_will_promote    TEXT,
  asaas_subaccount_id TEXT,
  asaas_wallet_id     TEXT,
  pix_key             TEXT,
  bonus_per_store     NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_per_client    NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_pct      NUMERIC(5,4)  NOT NULL DEFAULT 0,
  commission_months   INTEGER       NOT NULL DEFAULT 6,
  commission_start    DATE,
  withdrawal_mode     TEXT NOT NULL DEFAULT 'manual'
                      CHECK (withdrawal_mode IN ('manual','auto')),
  total_earned        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawn     NUMERIC(12,2) NOT NULL DEFAULT 0,
  invited_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at        TIMESTAMPTZ,
  notes               TEXT
);

-- A2. Indicações (quem se cadastrou pelo link)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      UUID NOT NULL REFERENCES public.partner_affiliates(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_role     TEXT,
  referred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at      TIMESTAMPTZ,
  bonus_paid        BOOLEAN NOT NULL DEFAULT false,
  bonus_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(affiliate_id, referred_user_id)
);

-- A3. Ledger de comissões por pedido
CREATE TABLE IF NOT EXISTS public.affiliate_commission_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        UUID NOT NULL REFERENCES public.partner_affiliates(id) ON DELETE CASCADE,
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  referred_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  platform_commission NUMERIC(10,2),
  affiliate_pct       NUMERIC(5,4),
  affiliate_amount    NUMERIC(10,2) NOT NULL,
  credited_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_out            BOOLEAN NOT NULL DEFAULT false,
  payout_at           TIMESTAMPTZ
);

-- A4. Coluna em users para rastrear quem indicou
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_affiliate UUID REFERENCES public.partner_affiliates(id) ON DELETE SET NULL;

-- Garante que authenticated e service_role possam ler a nova coluna em users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'referred_by_affiliate'
  ) THEN
    EXECUTE 'GRANT SELECT (referred_by_affiliate) ON public.users TO authenticated';
  END IF;
END $$;

-- A5. RPC para incrementar total_earned
CREATE OR REPLACE FUNCTION public.increment_affiliate_earned(p_affiliate_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.partner_affiliates
  SET total_earned = total_earned + p_amount
  WHERE id = p_affiliate_id;
$$;

-- A6. RLS - Afiliados
ALTER TABLE public.partner_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_affiliates" ON public.partner_affiliates;
CREATE POLICY "admin_all_affiliates" ON public.partner_affiliates FOR ALL TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_referrals" ON public.affiliate_referrals;
CREATE POLICY "admin_all_referrals" ON public.affiliate_referrals FOR ALL TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_ledger" ON public.affiliate_commission_ledger;
CREATE POLICY "admin_all_ledger" ON public.affiliate_commission_ledger FOR ALL TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "affiliate_own" ON public.partner_affiliates;
CREATE POLICY "affiliate_own" ON public.partner_affiliates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "affiliate_own_referrals" ON public.affiliate_referrals;
CREATE POLICY "affiliate_own_referrals" ON public.affiliate_referrals FOR SELECT TO authenticated
  USING (affiliate_id IN (SELECT id FROM public.partner_affiliates WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "affiliate_own_ledger" ON public.affiliate_commission_ledger;
CREATE POLICY "affiliate_own_ledger" ON public.affiliate_commission_ledger FOR SELECT TO authenticated
  USING (affiliate_id IN (SELECT id FROM public.partner_affiliates WHERE user_id = auth.uid()));

-- Acesso público apenas ao token de convite (para validar no cadastro)
DROP POLICY IF EXISTS "public_invite_token" ON public.partner_affiliates;
CREATE POLICY "public_invite_token" ON public.partner_affiliates FOR SELECT TO anon
  USING (invite_token IS NOT NULL AND invite_expires_at > now());

-- A7. Configurações globais de afiliados
DO $$
BEGIN
  -- Se platform_settings não possuir colunas key e value, criamos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'key'
  ) THEN
    ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS key TEXT UNIQUE;
    ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS value JSONB;
  END IF;
END $$;

INSERT INTO public.platform_settings (key, value)
VALUES ('affiliate_settings', '{"invite_expiry_days":7,"cookie_days":7,"min_withdrawal":20.00}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Também registra em platform_config para suporte unificado
INSERT INTO public.platform_config (key, value)
VALUES ('affiliate_settings', '{"invite_expiry_days":7,"cookie_days":7,"min_withdrawal":20.00}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════
-- PARTE B — SISTEMA DE SÓCIOS INVESTIDORES
-- ═══════════════════════════════════════════════════

-- B1. Tabela de sócios investidores
CREATE TABLE IF NOT EXISTS public.profit_sharing_partners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  pix_key       TEXT NOT NULL,
  pix_key_type  TEXT NOT NULL CHECK (pix_key_type IN ('cpf','cnpj','email','telefone','aleatoria')),
  share_pct     NUMERIC(5,4) NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  start_date    DATE NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- B2. Histórico de repasses mensais
CREATE TABLE IF NOT EXISTS public.profit_sharing_payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES public.profit_sharing_partners(id) ON DELETE RESTRICT,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  platform_fees     NUMERIC(12,2) NOT NULL DEFAULT 0,
  activation_fees   NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_revenue     NUMERIC(12,2) NOT NULL,
  asaas_fees        NUMERIC(12,2) NOT NULL DEFAULT 0,
  affiliate_costs   NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_costs       NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_costs_note  TEXT,
  net_revenue       NUMERIC(12,2) NOT NULL,
  share_pct         NUMERIC(5,4) NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','cancelled')),
  paid_at           TIMESTAMPTZ,
  pix_key_used      TEXT,
  receipt_note      TEXT,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B3. Trigger: máximo de 3 sócios ativos
CREATE OR REPLACE FUNCTION public.check_max_profit_partners()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.active = true THEN
    IF (SELECT COUNT(*) FROM public.profit_sharing_partners WHERE active = true AND id != NEW.id) >= 3 THEN
      RAISE EXCEPTION 'Máximo de 3 sócios investidores ativos permitido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_max_profit_partners ON public.profit_sharing_partners;
CREATE TRIGGER trg_max_profit_partners
  BEFORE INSERT OR UPDATE ON public.profit_sharing_partners
  FOR EACH ROW EXECUTE FUNCTION public.check_max_profit_partners();

-- B4. RLS - Sócios (somente admin)
ALTER TABLE public.profit_sharing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_sharing_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_profit_partners" ON public.profit_sharing_partners;
CREATE POLICY "admin_all_profit_partners" ON public.profit_sharing_partners FOR ALL TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_profit_payouts" ON public.profit_sharing_payouts;
CREATE POLICY "admin_all_profit_payouts" ON public.profit_sharing_payouts FOR ALL TO authenticated 
  USING (public.is_admin());

-- Permissões gerais para service_role (usado pelas rotas da API)
GRANT ALL ON public.partner_affiliates TO service_role;
GRANT ALL ON public.affiliate_referrals TO service_role;
GRANT ALL ON public.affiliate_commission_ledger TO service_role;
GRANT ALL ON public.profit_sharing_partners TO service_role;
GRANT ALL ON public.profit_sharing_payouts TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.partner_affiliates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.affiliate_referrals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.affiliate_commission_ledger TO authenticated;
GRANT SELECT ON public.partner_affiliates TO anon;
