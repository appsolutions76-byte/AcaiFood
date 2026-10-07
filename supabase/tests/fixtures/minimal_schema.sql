-- Esquema mínimo (só as tabelas/colunas que as migrations R15/R16 usam).
-- Serve para o CI testar PIN, privacidade de users, radar e log de admin
-- sem precisar de um projeto Supabase. NÃO rodar no Supabase.

CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'cliente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  phone TEXT,
  telefone TEXT,
  endereco TEXT,
  address TEXT,
  cidade TEXT,
  bairro TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  vehicle_type TEXT,
  is_online BOOLEAN,
  status TEXT DEFAULT 'active',
  pix_key TEXT,
  pix_key_type TEXT,
  cpf_cnpj TEXT,
  asaas_account_id TEXT,
  asaas_wallet_id TEXT,
  asaas_account_status TEXT DEFAULT 'APPROVED',
  asaas_account_api_key TEXT,
  activation_payment_id TEXT,
  split_enabled BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  birth_date DATE,
  monthly_income NUMERIC,
  company_type TEXT,
  postal_code TEXT,
  address_number TEXT,
  province TEXT
);

CREATE TABLE public.storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID,
  store_name TEXT,
  price_b2b NUMERIC,
  price_b2c_popular NUMERIC,
  price_b2c_medio NUMERIC,
  price_b2c_grosso NUMERIC,
  logo_url TEXT
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID,
  name TEXT,
  price NUMERIC
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID,
  seller_storefront_id UUID,
  driver_id UUID,
  status TEXT,
  order_type TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
  delivery_bairro TEXT,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  asaas_transfer_status TEXT,
  delivery_pin TEXT,
  pickup_pin TEXT,
  pin_hash TEXT,
  provided_pin TEXT,
  pin_attempts INTEGER DEFAULT 0,
  pickup_pin_attempts INTEGER DEFAULT 0,
  last_pin_attempt_at TIMESTAMPTZ,
  last_pickup_pin_attempt_at TIMESTAMPTZ
);

CREATE TABLE public.order_pins (
  order_id UUID PRIMARY KEY,
  delivery_pin TEXT,
  pickup_pin TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_status_history (
  order_id UUID,
  from_status TEXT,
  to_status TEXT,
  actor_id UUID,
  actor_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE public.pin_attempt_log (
  order_id UUID,
  actor_id UUID,
  success BOOLEAN,
  ip_device TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  asaas_platform_wallet_id TEXT
);

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin OR lower(role) = 'admin' FROM public.users WHERE id = auth.uid()), false)
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

-- Políticas parecidas com as do projeto (leitura ampla de users; o que limita é o GRANT por coluna)
CREATE POLICY users_select ON public.users FOR SELECT USING (true);
CREATE POLICY users_update_self ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY storefronts_select ON public.storefronts FOR SELECT USING (true);
CREATE POLICY orders_select ON public.orders FOR SELECT USING (
  public.is_admin() OR buyer_id = auth.uid() OR driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.storefronts s WHERE s.id = orders.seller_storefront_id AND s.partner_id = auth.uid())
);
CREATE POLICY orders_update ON public.orders FOR UPDATE USING (
  public.is_admin() OR buyer_id = auth.uid() OR driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.storefronts s WHERE s.id = orders.seller_storefront_id AND s.partner_id = auth.uid())
);

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Configuração no formato antigo (JSON dentro de asaas_platform_wallet_id), para testar a cópia da 20261006040000
INSERT INTO public.platform_settings (id, asaas_platform_wallet_id)
VALUES (1, '{"activationFee": 29.9, "freeQuota": 50, "support_config": {"mode": "auto", "whatsappNumber": "5591000000000"}}');
