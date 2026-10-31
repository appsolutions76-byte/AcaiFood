-- ==============================================================================
-- AÇAÍFOOD R36 — Frete "Mínima + km" (taxa mínima cobre os primeiros km; acima soma o
-- valor por km excedente). Só ADICIONA colunas; nada existente muda.
-- Timestamp: 20261031020000
-- Reversão: supabase/rollback/20261031020000_r36_freight_min_km_rollback.sql
-- ==============================================================================
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS courier_min_fee numeric,
  ADD COLUMN IF NOT EXISTS courier_min_km numeric,
  ADD COLUMN IF NOT EXISTS courier_extra_km_fee numeric,
  ADD COLUMN IF NOT EXISTS transporter_min_fee numeric,
  ADD COLUMN IF NOT EXISTS transporter_min_km numeric,
  ADD COLUMN IF NOT EXISTS transporter_extra_km_fee numeric,
  ADD COLUMN IF NOT EXISTS ecopoint_min_fee numeric,
  ADD COLUMN IF NOT EXISTS ecopoint_min_km numeric,
  ADD COLUMN IF NOT EXISTS ecopoint_extra_km_fee numeric;

-- Leitura pública só destas colunas de taxa (mesmo padrão da migration 20260924010000)
GRANT SELECT (
  courier_min_fee, courier_min_km, courier_extra_km_fee,
  transporter_min_fee, transporter_min_km, transporter_extra_km_fee,
  ecopoint_min_fee, ecopoint_min_km, ecopoint_extra_km_fee
) ON public.platform_settings TO anon, authenticated;

-- O admin grava pelo app: as colunas novas seguem a mesma permissão de UPDATE de courier_fixed_fee
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.platform_settings', 'courier_fixed_fee', 'UPDATE') THEN
    EXECUTE 'GRANT UPDATE (courier_min_fee, courier_min_km, courier_extra_km_fee, transporter_min_fee, transporter_min_km, transporter_extra_km_fee, ecopoint_min_fee, ecopoint_min_km, ecopoint_extra_km_fee) ON public.platform_settings TO authenticated';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
