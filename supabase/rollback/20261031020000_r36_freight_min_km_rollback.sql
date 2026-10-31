-- Reversão do R36 (frete Mínima + km). Antes de rodar, volte as cidades/padrão para Fixo ou Por KM.
ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS courier_min_fee, DROP COLUMN IF EXISTS courier_min_km, DROP COLUMN IF EXISTS courier_extra_km_fee,
  DROP COLUMN IF EXISTS transporter_min_fee, DROP COLUMN IF EXISTS transporter_min_km, DROP COLUMN IF EXISTS transporter_extra_km_fee,
  DROP COLUMN IF EXISTS ecopoint_min_fee, DROP COLUMN IF EXISTS ecopoint_min_km, DROP COLUMN IF EXISTS ecopoint_extra_km_fee;
NOTIFY pgrst, 'reload schema';
