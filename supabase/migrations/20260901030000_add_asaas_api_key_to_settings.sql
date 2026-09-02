-- Migration: 20260901030000_add_asaas_api_key_to_settings.sql
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS asaas_api_key TEXT DEFAULT NULL;

-- Criar registro padrao caso a tabela esteja vazia
INSERT INTO public.platform_settings (id, asaas_api_key)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;
