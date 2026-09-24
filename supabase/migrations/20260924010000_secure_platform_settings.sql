-- Migration: 20260924010000_secure_platform_settings.sql
-- Description: Hotfix R9 Item 3 - Secure platform settings & add charged_amount to orders

-- 1. Adicionar charged_amount na tabela orders para conferência antifraude em webhooks
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS charged_amount numeric(10,2);

-- 2. Limpar chave Asaas residual da tabela platform_settings (chave agora reside exclusivamente no Vault / Env)
UPDATE public.platform_settings 
SET asaas_api_key = NULL 
WHERE asaas_api_key IS NOT NULL;

-- 3. Revogar permissão ampla de SELECT em platform_settings de roles públicas
REVOKE SELECT ON public.platform_settings FROM anon, authenticated;

-- 4. Conceder SELECT apenas para colunas públicas de taxas de entrega e plataforma
GRANT SELECT (
  id,
  b2c_fee_percentage,
  motoboy_fee_per_km,
  motoboy_platform_fee_percentage,
  b2b_fee_percentage,
  truck_fee_per_km,
  truck_platform_fee_percentage,
  col_fee_percentage,
  col_fee_per_km,
  col_platform_fee_percentage,
  col_fixed_price,
  payout_time,
  courier_payment_mode,
  courier_fixed_fee,
  transporter_payment_mode,
  transporter_fixed_fee,
  ecopoint_payment_mode,
  ecopoint_fixed_fee,
  asaas_fee_split_actors,
  asaas_pix_fee_fixed,
  created_at,
  updated_at
) ON public.platform_settings TO anon, authenticated;
