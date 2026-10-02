-- ==========================================================
-- AÇAÍFOOD — FASE 3: SNAPSHOT DE PREÇOS & LIQUIDAÇÃO (SETTLEMENTS)
-- Timestamp: 20261002020000
-- Prompt R11 - Fase 3.1 & 3.3
-- ==========================================================

-- 1. Colunas de Snapshot de Precificação e Repasse na tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_payout_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS driver_payout_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS asaas_fee_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

-- 2. Tabela oficial de Liquidações e Repasses Pós-Entrega (settlements)
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('seller', 'driver')),
  amount NUMERIC(10,2) NOT NULL,
  wallet_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'WAITING_ACCOUNT')),
  asaas_transfer_id TEXT,
  attempt_ref TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  CONSTRAINT unq_settlement_order_role UNIQUE (order_id, role)
);

-- Índices de performance para busca de repasses
CREATE INDEX IF NOT EXISTS idx_settlements_partner_status ON public.settlements(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_order_id ON public.settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status);

-- 3. Habilitação de RLS para settlements
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settlements Partner Select" ON public.settlements;
DROP POLICY IF EXISTS "Settlements Admin All" ON public.settlements;

CREATE POLICY "Settlements Partner Select" ON public.settlements
FOR SELECT USING (
  auth.role() = 'authenticated' AND (partner_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Settlements Admin All" ON public.settlements
FOR ALL USING (
  auth.role() = 'authenticated' AND public.is_admin()
);

-- 4. Índice Unique parcial para conciliação manual Pix EndToEnd
CREATE UNIQUE INDEX IF NOT EXISTS unq_orders_pix_end_to_end_id
ON public.orders(pix_end_to_end_id)
WHERE pix_end_to_end_id IS NOT NULL AND pix_end_to_end_id != '';

-- 5. Trigger / Função para auto-criação de settlements quando pedido vira RECEIVED
CREATE OR REPLACE FUNCTION public.create_order_settlements_on_receive()
RETURNS TRIGGER AS $$
DECLARE
  v_store_partner_id UUID;
  v_seller_amount NUMERIC(10,2);
  v_driver_amount NUMERIC(10,2);
  v_seller_wallet TEXT;
  v_driver_wallet TEXT;
  v_seller_status TEXT;
  v_driver_status TEXT;
BEGIN
  -- Dispara apenas quando o pedido passa para RECEIVED
  IF NEW.status = 'RECEIVED' AND (OLD.status IS NULL OR OLD.status != 'RECEIVED') THEN
    
    -- 1. Resolver parceiro vendedor e valores do snapshot
    IF NEW.seller_storefront_id IS NOT NULL THEN
      SELECT partner_id INTO v_store_partner_id 
      FROM public.storefronts WHERE id = NEW.seller_storefront_id;
    END IF;

    v_seller_amount := COALESCE(NEW.seller_payout_amount, 0);
    v_driver_amount := COALESCE(NEW.driver_payout_amount, 0);

    -- Se não havia snapshot gravado, fallback seguro para products_subtotal
    IF v_seller_amount <= 0 THEN
      v_seller_amount := COALESCE(NEW.products_subtotal, 0);
    END IF;

    -- Inserir settlement do Vendedor
    IF v_store_partner_id IS NOT NULL AND v_seller_amount > 0 THEN
      SELECT asaas_wallet_id, asaas_account_status INTO v_seller_wallet, v_seller_status
      FROM public.users WHERE id = v_store_partner_id;

      INSERT INTO public.settlements (
        order_id, partner_id, role, amount, wallet_id,
        status, attempt_ref, created_at, updated_at
      )
      VALUES (
        NEW.id, v_store_partner_id, 'seller', v_seller_amount, v_seller_wallet,
        CASE WHEN v_seller_wallet IS NOT NULL AND v_seller_status = 'APPROVED' THEN 'PENDING' ELSE 'WAITING_ACCOUNT' END,
        gen_random_uuid()::text, NOW(), NOW()
      )
      ON CONFLICT (order_id, role) DO NOTHING;
    END IF;

    -- Inserir settlement do Motorista
    IF NEW.driver_id IS NOT NULL AND v_driver_amount > 0 THEN
      SELECT asaas_wallet_id, asaas_account_status INTO v_driver_wallet, v_driver_status
      FROM public.users WHERE id = NEW.driver_id;

      INSERT INTO public.settlements (
        order_id, partner_id, role, amount, wallet_id,
        status, attempt_ref, created_at, updated_at
      )
      VALUES (
        NEW.id, NEW.driver_id, 'driver', v_driver_amount, v_driver_wallet,
        CASE WHEN v_driver_wallet IS NOT NULL AND v_driver_status = 'APPROVED' THEN 'PENDING' ELSE 'WAITING_ACCOUNT' END,
        gen_random_uuid()::text, NOW(), NOW()
      )
      ON CONFLICT (order_id, role) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_order_settlements ON public.orders;
CREATE TRIGGER trg_create_order_settlements
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_order_settlements_on_receive();

NOTIFY pgrst, 'reload schema';
