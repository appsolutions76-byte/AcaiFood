-- ==========================================
-- AçaíFood Supabase Initial Schema (Triple Split)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Users Table (Partners & Clients & Logistics)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('CLIENT', 'PARTNER', 'ADMIN', 'COURIER', 'SUPPLIER', 'TRANSPORTER')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  mp_access_token TEXT, -- Encrypted Mercado Pago Token
  mp_merchant_id TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('MOTO', 'TRUCK')), -- For Courier and Transporter
  license_plate TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Storefronts Table (For Partners / Batedeiras and Suppliers)
CREATE TABLE IF NOT EXISTS public.storefronts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  brand_color TEXT DEFAULT '#5b21b6',
  logo_url TEXT,
  banner_url TEXT,
  is_open BOOLEAN DEFAULT true,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Products Table (Catalog)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storefront_id UUID NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  promotional_price DECIMAL(10, 2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Platform Settings Table (Admin Configuration for Triple Split)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  b2c_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  b2b_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 3.00,
  motoboy_fee_per_km DECIMAL(10, 2) NOT NULL DEFAULT 1.50,
  truck_fee_per_km DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  motoboy_platform_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  truck_platform_fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.platform_settings (b2c_fee_percentage, b2b_fee_percentage, motoboy_fee_per_km, truck_fee_per_km, motoboy_platform_fee_percentage, truck_platform_fee_percentage) 
VALUES (5.00, 3.00, 1.50, 5.00, 10.00, 10.00);

-- 5. Create Orders Table (Triple Split architecture)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_type TEXT NOT NULL CHECK (order_type IN ('B2C', 'B2B')),
  
  -- Entities Involved
  buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Cliente Final ou Batedeira
  seller_storefront_id UUID NOT NULL REFERENCES public.storefronts(id), -- Loja da Batedeira ou Fornecedor
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Motoboy ou Caminhoneiro
  
  -- Frozen Rates (at the time of the order, avoiding historical corruption)
  applied_platform_fee_percent DECIMAL(5, 2) NOT NULL,
  applied_delivery_fee_per_km DECIMAL(10, 2) NOT NULL,
  applied_delivery_platform_fee_percent DECIMAL(5, 2) NOT NULL,
  
  -- Order Values
  products_subtotal DECIMAL(10, 2) NOT NULL,
  delivery_distance_km DECIMAL(10, 2) NOT NULL,
  
  -- Calculated Triple Split Fields
  total_delivery_fee DECIMAL(10, 2) GENERATED ALWAYS AS (delivery_distance_km * applied_delivery_fee_per_km) STORED,
  platform_sales_fee_amount DECIMAL(10, 2) GENERATED ALWAYS AS (products_subtotal * applied_platform_fee_percent / 100) STORED,
  platform_delivery_fee_amount DECIMAL(10, 2) GENERATED ALWAYS AS ((delivery_distance_km * applied_delivery_fee_per_km) * applied_delivery_platform_fee_percent / 100) STORED,
  
  seller_amount DECIMAL(10, 2) GENERATED ALWAYS AS (products_subtotal - (products_subtotal * applied_platform_fee_percent / 100)) STORED,
  driver_amount DECIMAL(10, 2) GENERATED ALWAYS AS ((delivery_distance_km * applied_delivery_fee_per_km) - ((delivery_distance_km * applied_delivery_fee_per_km) * applied_delivery_platform_fee_percent / 100)) STORED,
  total_platform_fee_amount DECIMAL(10, 2) GENERATED ALWAYS AS ((products_subtotal * applied_platform_fee_percent / 100) + ((delivery_distance_km * applied_delivery_fee_per_km) * applied_delivery_platform_fee_percent / 100)) STORED,
  
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (products_subtotal + (delivery_distance_km * applied_delivery_fee_per_km)) STORED,
  
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'PREPARING', 'DELIVERING', 'COMPLETED', 'CANCELLED')),
  mp_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Row Level Security (RLS) setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS: Platform Settings
CREATE POLICY "Platform settings are visible to everyone" 
ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update platform settings" 
ON public.platform_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
);

-- RLS: Users
CREATE POLICY "Users can read all public user profiles" 
ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can edit their own profile" 
ON public.users FOR UPDATE USING (auth.uid() = id);

-- RLS: Storefronts
CREATE POLICY "Storefronts are visible to everyone" 
ON public.storefronts FOR SELECT USING (true);
CREATE POLICY "Partners can manage their storefront" 
ON public.storefronts FOR ALL USING (auth.uid() = partner_id);

-- RLS: Products
CREATE POLICY "Products are visible to everyone" 
ON public.products FOR SELECT USING (true);
CREATE POLICY "Partners can manage their products" 
ON public.products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.storefronts 
    WHERE storefronts.id = products.storefront_id AND storefronts.partner_id = auth.uid()
  )
);

-- RLS: Orders (Visibilidade de Triplo Split)
CREATE POLICY "Buyers can view their orders" 
ON public.orders FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their orders" 
ON public.orders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.storefronts 
    WHERE storefronts.id = orders.seller_storefront_id AND storefronts.partner_id = auth.uid()
  )
);

CREATE POLICY "Drivers can view their delivery orders" 
ON public.orders FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Buyers can create orders" 
ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- 7. Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
