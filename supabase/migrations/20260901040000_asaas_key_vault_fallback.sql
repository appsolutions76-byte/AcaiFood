-- Migration: 20260901040000_asaas_key_vault_fallback.sql
-- Funcao de seguranca para buscar a chave Asaas via service_role

CREATE OR REPLACE FUNCTION public.get_platform_asaas_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS \$\$
DECLARE
  v_key TEXT := NULL;
BEGIN
  -- 1. Tentar ler de platform_settings
  SELECT asaas_api_key INTO v_key FROM public.platform_settings WHERE asaas_api_key IS NOT NULL AND asaas_api_key != '' LIMIT 1;
  IF v_key IS NOT NULL THEN
    RETURN v_key;
  END IF;

  -- 2. Tentar ler do Supabase Vault se disponivel
  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'ASAAS_API_KEY' LIMIT 1;
    IF v_key IS NOT NULL THEN
      RETURN v_key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NULL;
END;
\$\$;

REVOKE ALL ON FUNCTION public.get_platform_asaas_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_asaas_key() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_asaas_key() TO service_role;
