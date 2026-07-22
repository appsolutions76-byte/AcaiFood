ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS col_fixed_price numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS col_fee_percentage numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS col_fee_per_km numeric DEFAULT 8,
ADD COLUMN IF NOT EXISTS col_platform_fee_percentage numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS payout_time text DEFAULT '22:00';
