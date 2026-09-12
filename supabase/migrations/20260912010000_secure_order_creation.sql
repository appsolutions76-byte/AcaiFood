-- ==========================================================
-- AÇAÍFOOD — SECURE ORDER CREATION AND RATE VALIDATION (MIGRATION)
-- Timestamp: 20260912010000
-- Item P1.4 do PROMPT_CORRECOES_ANTIGRAVITY.md
-- ==========================================================

-- Trigger BEFORE INSERT OR UPDATE ON public.orders para garantir que as taxas
-- e valores aplicados venham das configurações oficiais da plataforma (platform_settings)
-- e não possam ser reduzidos/bypassados pelo comprador no cliente.

CREATE OR REPLACE FUNCTION public.validate_and_sanitize_order_fees()
RETURNS TRIGGER AS $$
DECLARE
  v_settings RECORD;
  v_order_type TEXT;
BEGIN
  -- Buscar taxas oficiais atuais da plataforma
  SELECT * INTO v_settings FROM public.platform_settings LIMIT 1;

  v_order_type := upper(COALESCE(NEW.order_type, 'B2C'));

  IF v_settings IS NOT NULL THEN
    IF v_order_type = 'B2C' THEN
      NEW.applied_platform_fee_percent := COALESCE(v_settings.b2c_platform_fee_percent, 10);
      NEW.applied_delivery_fee_per_km := COALESCE(v_settings.b2c_delivery_fee_per_km, 2);
      NEW.applied_delivery_platform_fee_percent := COALESCE(v_settings.b2c_delivery_platform_fee_percent, 10);
    ELSIF v_order_type = 'COLETA' THEN
      NEW.applied_platform_fee_percent := COALESCE(v_settings.ecopoint_platform_fee_percent, 10);
      NEW.applied_delivery_fee_per_km := COALESCE(v_settings.ecopoint_delivery_fee_per_km, 2);
      NEW.applied_delivery_platform_fee_percent := COALESCE(v_settings.ecopoint_delivery_platform_fee_percent, 10);
    ELSE -- B2B
      NEW.applied_platform_fee_percent := COALESCE(v_settings.b2b_platform_fee_percent, 10);
      NEW.applied_delivery_fee_per_km := COALESCE(v_settings.b2b_delivery_fee_per_km, 2);
      NEW.applied_delivery_platform_fee_percent := COALESCE(v_settings.b2b_delivery_platform_fee_percent, 10);
    END IF;
  END IF;

  -- Impedir produtos com subtotal negativo
  IF NEW.products_subtotal < 0 THEN
    NEW.products_subtotal := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_order_fees ON public.orders;
CREATE TRIGGER trg_validate_order_fees
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_and_sanitize_order_fees();

NOTIFY pgrst, 'reload schema';
