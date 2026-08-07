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
ADD COLUMN IF NOT EXISTS payout_seller_done BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payout_driver_done BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 4.1. Garante as Colunas de Modalidade de Pagamento na Tabela platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS courier_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS courier_fixed_fee NUMERIC DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS transporter_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS transporter_fixed_fee NUMERIC DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS ecopoint_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS ecopoint_fixed_fee NUMERIC DEFAULT 50.00;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'storefronts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.storefronts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'platform_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.storefronts REPLICA IDENTITY FULL;
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;

-- 10. Garantir Políticas RLS Granulares e Seguras na Tabela Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all select on orders" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Select" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Update" ON public.orders;

CREATE POLICY "Orders Granular Select" ON public.orders 
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() OR 
    driver_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.storefronts sf WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
  )
);

CREATE POLICY "Orders Granular Insert" ON public.orders 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

CREATE POLICY "Orders Granular Update" ON public.orders 
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() OR 
    driver_id = auth.uid() OR 
    driver_id IS NULL OR
    EXISTS (SELECT 1 FROM public.storefronts sf WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
  )
) WITH CHECK (true);

-- 12. Garante a Tabela Cities e Coluna rates com RLS Protegido
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  rates JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS rates JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all select on cities" ON public.cities;
DROP POLICY IF EXISTS "Allow all update on cities" ON public.cities;
DROP POLICY IF EXISTS "Allow all insert on cities" ON public.cities;
DROP POLICY IF EXISTS "Allow all delete on cities" ON public.cities;

CREATE POLICY "Allow public select on cities" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Allow admin write on cities" ON public.cities FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
);

-- 13. Garante RLS Protegido na Tabela platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all select on platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Allow all update on platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Allow all insert on platform_settings" ON public.platform_settings;

CREATE POLICY "Allow public select on platform_settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin write on platform_settings" ON public.platform_settings FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
);

-- 15. Garante Estrutura e RLS nas Tabelas storefronts e products
CREATE TABLE IF NOT EXISTS public.storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  store_name TEXT,
  price_b2b NUMERIC DEFAULT 140.00,
  price_b2c_popular NUMERIC DEFAULT 20.00,
  price_b2c_medio NUMERIC DEFAULT 26.00,
  price_b2c_grosso NUMERIC DEFAULT 35.00,
  frete_subsidy_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS price_b2b NUMERIC DEFAULT 140.00;
ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS price_b2c_popular NUMERIC DEFAULT 20.00;
ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS price_b2c_medio NUMERIC DEFAULT 26.00;
ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS price_b2c_grosso NUMERIC DEFAULT 35.00;
ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS frete_subsidy_pct NUMERIC DEFAULT 0;

ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all select on storefronts" ON public.storefronts;
DROP POLICY IF EXISTS "Allow all update on storefronts" ON public.storefronts;
DROP POLICY IF EXISTS "Allow all insert on storefronts" ON public.storefronts;
DROP POLICY IF EXISTS "Allow all delete on storefronts" ON public.storefronts;

CREATE POLICY "Allow public select on storefronts" ON public.storefronts FOR SELECT USING (true);
CREATE POLICY "Allow partner write on storefronts" ON public.storefronts FOR ALL USING (
  auth.role() = 'authenticated' AND (
    partner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
  )
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID REFERENCES public.storefronts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all select on products" ON public.products;
DROP POLICY IF EXISTS "Allow all update on products" ON public.products;
DROP POLICY IF EXISTS "Allow all insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow all delete on products" ON public.products;

CREATE POLICY "Allow public select on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow partner write on products" ON public.products FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.storefronts sf WHERE sf.id = products.storefront_id AND (
      sf.partner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'ADMIN' OR u.role = 'admin'))
    )
  )
);

-- 16. Notificar a API REST do Supabase para recarregar o schema cache
NOTIFY pgrst, 'reload schema';

