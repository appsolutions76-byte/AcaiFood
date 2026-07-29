-- ==========================================================
-- MASTER CLEAN SCHEMA & PERFORMANCE OPTIMIZATION - AÇAÍFOOD
-- Execute este script no SQL Editor do Supabase para limpar
-- estruturas legadas, criar índices de alta performance e
-- otimizar o esquema do banco de dados para o Asaas.
-- ==========================================================

-- 1. Remoção de Tabelas Legadas Sem Utilidade (Mercado Pago e Antigas)
DROP TABLE IF EXISTS public.mp_oauth_states CASCADE;
DROP TABLE IF EXISTS public.mercadopago_tokens CASCADE;
DROP TABLE IF EXISTS public.mp_payments CASCADE;
DROP TABLE IF EXISTS public.legacy_orders CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.transfers CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.webhooks CASCADE;

-- 2. Limpeza de Colunas Legadas
DO $$
BEGIN
  -- Remover colunas do antigo Mercado Pago se ainda existirem na tabela users
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mp_access_token') THEN
    ALTER TABLE public.users DROP COLUMN mp_access_token;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mp_merchant_id') THEN
    ALTER TABLE public.users DROP COLUMN mp_merchant_id;
  END IF;
  
  -- Remover colunas legadas na tabela orders se existirem
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='mp_payment_id') THEN
    ALTER TABLE public.orders DROP COLUMN mp_payment_id;
  END IF;
END $$;

-- 3. Garante a Estrutura Correta das Colunas Principais no Users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN DEFAULT TRUE;

-- 4. Garante a Estrutura Correta das Colunas Principais no Orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(4),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS provided_pin TEXT,
ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_charge_status TEXT,
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'B2C_ORDER',
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_lat FLOAT8,
ADD COLUMN IF NOT EXISTS delivery_lng FLOAT8,
ADD COLUMN IF NOT EXISTS delivery_reference TEXT,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 5. Criação de Índices de Alta Performance (Evita lentidão no carregamento de listas)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_storefront_id ON public.orders(seller_storefront_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_asaas_wallet_id ON public.users(asaas_wallet_id);
CREATE INDEX IF NOT EXISTS idx_users_pix_key ON public.users(pix_key);

CREATE INDEX IF NOT EXISTS idx_storefronts_partner_id ON public.storefronts(partner_id);
CREATE INDEX IF NOT EXISTS idx_products_storefront_id ON public.products(storefront_id);

-- 6. Trigger de Segurança Financeira (Impede alteração não autorizada nos valores)
CREATE OR REPLACE FUNCTION public.protect_order_financials()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    IF (NEW.products_subtotal IS DISTINCT FROM OLD.products_subtotal) OR
       (NEW.delivery_distance_km IS DISTINCT FROM OLD.delivery_distance_km) OR
       (NEW.applied_platform_fee_percent IS DISTINCT FROM OLD.applied_platform_fee_percent) OR
       (NEW.applied_delivery_fee_per_km IS DISTINCT FROM OLD.applied_delivery_fee_per_km) OR
       (NEW.applied_delivery_platform_fee_percent IS DISTINCT FROM OLD.applied_delivery_platform_fee_percent) THEN
       
       RAISE EXCEPTION 'Acesso negado: Tentativa de alteração não autorizada nos valores do pedido.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_order_financials ON public.orders;
CREATE TRIGGER trigger_protect_order_financials
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_order_financials();

-- 7. Trigger de Validação Rigorosa do PIN de Segurança
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
      IF NEW.provided_pin IS NULL OR NEW.provided_pin IS DISTINCT FROM OLD.delivery_pin THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança incorreto ou ausente.';
      END IF;
    END IF;
  END IF;
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders;
CREATE TRIGGER check_delivery_pin
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_pin_trigger();

-- 8. Validação de Constraint de Status dos Pedidos
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'RECEIVED', 'COMPLETED', 'CANCELLED'));

-- 9. Habilitação de Realtime no Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 10. Notificar a API REST do Supabase para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
