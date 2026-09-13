-- ==========================================================
-- AÇAÍFOOD — SECURE ORDER CREATION AND RATE VALIDATION (MIGRATION R2)
-- Timestamp: 20260912010000
-- Item P0 do PROMPT_CORRECOES_ANTIGRAVITY_R2.md
-- ==========================================================

-- Trigger BEFORE INSERT OR UPDATE ON public.orders para garantir que as taxas
-- e valores aplicados venham das configurações oficiais da plataforma (platform_settings)
-- usando JSONB extraction seguro sem quebrar caso a estrutura mude.

CREATE OR REPLACE FUNCTION public.validate_and_sanitize_order_fees()
RETURNS TRIGGER AS $$
DECLARE
  v_settings RECORD;
  v_json JSONB;
  v_order_type TEXT;
  v_plat_pct NUMERIC;
  v_fee_per_km NUMERIC;
  v_mot_plat_pct NUMERIC;
BEGIN
  -- Buscar taxas oficiais atuais da plataforma
  SELECT * INTO v_settings FROM public.platform_settings LIMIT 1;
  v_json := to_jsonb(v_settings);

  v_order_type := upper(COALESCE(NEW.order_type, 'B2C'));

  IF v_json IS NOT NULL THEN
    IF v_order_type = 'B2C' THEN
      v_plat_pct := NULLIF(v_json ->> 'b2c_fee_percentage', '')::numeric;
      v_fee_per_km := NULLIF(v_json ->> 'motoboy_fee_per_km', '')::numeric;
      v_mot_plat_pct := NULLIF(v_json ->> 'motoboy_platform_fee_percentage', '')::numeric;
    ELSIF v_order_type = 'COLETA' THEN
      v_plat_pct := NULLIF(v_json ->> 'col_fee_percentage', '')::numeric;
      v_fee_per_km := NULLIF(v_json ->> 'col_fee_per_km', '')::numeric;
      v_mot_plat_pct := NULLIF(v_json ->> 'col_platform_fee_percentage', '')::numeric;
    ELSE -- B2B
      v_plat_pct := NULLIF(v_json ->> 'b2b_fee_percentage', '')::numeric;
      v_fee_per_km := NULLIF(v_json ->> 'truck_fee_per_km', '')::numeric;
      v_mot_plat_pct := NULLIF(v_json ->> 'truck_platform_fee_percentage', '')::numeric;
    END IF;

    NEW.applied_platform_fee_percent := COALESCE(v_plat_pct, NEW.applied_platform_fee_percent, 10);
    NEW.applied_delivery_fee_per_km := COALESCE(v_fee_per_km, NEW.applied_delivery_fee_per_km, 2);
    NEW.applied_delivery_platform_fee_percent := COALESCE(v_mot_plat_pct, NEW.applied_delivery_platform_fee_percent, 10);
  ELSE
    NEW.applied_platform_fee_percent := COALESCE(NEW.applied_platform_fee_percent, 10);
    NEW.applied_delivery_fee_per_km := COALESCE(NEW.applied_delivery_fee_per_km, 2);
    NEW.applied_delivery_platform_fee_percent := COALESCE(NEW.applied_delivery_platform_fee_percent, 10);
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
