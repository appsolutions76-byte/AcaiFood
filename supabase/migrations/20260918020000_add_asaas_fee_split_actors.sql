-- AÇAÍFOOD — MIGRATION: ADD ASAAS FEE SPLIT ACTORS AND ASAAS ESTIMATED PIX FEE TO PLATFORM_SETTINGS
-- Allows Admin to configure whether Asaas gateway fees are absorbed by 1 (Platform), 2 (Platform + Store), or 3 actors (Platform + Store + Courier).

ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS asaas_fee_split_actors INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS asaas_pix_fee_fixed NUMERIC(10,2) DEFAULT 0.99;

COMMENT ON COLUMN public.platform_settings.asaas_fee_split_actors IS 'Quantidade de atores para dividir a taxa do Asaas: 1 (100% Plataforma), 2 (Plataforma + Loja) ou 3 (Plataforma + Loja + Motoboy).';
COMMENT ON COLUMN public.platform_settings.asaas_pix_fee_fixed IS 'Valor estimado da taxa do Asaas por Pix (ex: 0.99) usado no cálculo do rateio.';
