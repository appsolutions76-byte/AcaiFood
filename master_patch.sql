-- ==========================================================
-- MASTER PATCH - AÇAÍFOOD
-- Roda este script no SQL Editor para garantir que TODAS as
-- colunas, triggers e seguranças estão aplicadas e recarregar o cache.
-- ==========================================================

-- 1. Garante que todas as colunas de controle e histórico existem
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(4),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS provided_pin text,
ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_charge_status TEXT,
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'B2C_ORDER',
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 2. Garante que as colunas do Asaas e Pix existem na tabela users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS cpf_cnpj text,
ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_account_status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN DEFAULT TRUE;

-- 3. Colunas de Modalidades Logísticas no platform_settings
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS courier_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS courier_fixed_fee DECIMAL(10,2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS transporter_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS transporter_fixed_fee DECIMAL(10,2) DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS ecopoint_payment_mode TEXT DEFAULT 'KM',
ADD COLUMN IF NOT EXISTS ecopoint_fixed_fee DECIMAL(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS asaas_platform_wallet_id TEXT DEFAULT 'wallet_master_acaifood';

-- 3. Trigger de Segurança Financeira (Garante que ninguém altere o preço do frete)
CREATE OR REPLACE FUNCTION public.protect_order_financials()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    IF (NEW.products_subtotal IS DISTINCT FROM OLD.products_subtotal) OR
       (NEW.delivery_distance_km IS DISTINCT FROM OLD.delivery_distance_km) OR
       (NEW.applied_platform_fee_percent IS DISTINCT FROM OLD.applied_platform_fee_percent) OR
       (NEW.applied_delivery_fee_per_km IS DISTINCT FROM OLD.applied_delivery_fee_per_km) OR
       (NEW.applied_delivery_platform_fee_percent IS DISTINCT FROM OLD.applied_delivery_platform_fee_percent) THEN
       
       RAISE EXCEPTION 'Acesso negado: Tentativa de fraude nos valores da corrida.';
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

-- 4. Trigger de Validação Rigorosa do PIN
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
      IF NEW.provided_pin IS NULL OR NEW.provided_pin IS DISTINCT FROM OLD.delivery_pin THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança inválido ou ausente.';
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

-- 5. Atualiza Constraints de Status
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'RECEIVED', 'COMPLETED', 'CANCELLED'));

-- 6. Habilitar o sistema de Realtime para as tabelas no Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 7. Recarregar o Schema Cache da API REST (Extremamente Importante)
NOTIFY pgrst, 'reload schema';
