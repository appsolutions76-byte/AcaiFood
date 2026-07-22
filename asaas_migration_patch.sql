-- ==========================================================
-- ASAAS & LOGÍSTICA PATCH - AÇAÍFOOD V1
-- Roda este script no SQL Editor do Supabase para adicionar
-- as colunas do Asaas, Wallet IDs e modalidades de frete (KM vs Fixo).
-- ==========================================================

-- 1. Colunas do Asaas na tabela users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- 2. Colunas de Modalidades Logísticas no platform_settings
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS courier_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS courier_fixed_fee DECIMAL(10,2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS transporter_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS transporter_fixed_fee DECIMAL(10,2) DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS ecopoint_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS ecopoint_fixed_fee DECIMAL(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS asaas_platform_wallet_id TEXT DEFAULT 'wallet_master_acaifood';

-- 3. Colunas de rastreamento do Asaas e Operações em orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_charge_status TEXT,
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'B2C_ORDER',
ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(4),
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 4. Recarregar o Cache do REST Schema do Supabase
NOTIFY pgrst, 'reload schema';
