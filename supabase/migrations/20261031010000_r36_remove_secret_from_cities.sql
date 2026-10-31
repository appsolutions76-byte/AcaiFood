-- ==============================================================================
-- AÇAÍFOOD R36 (URGENTE) — Remove a chave de API do Asaas gravada por engano em cities.rates
-- Timestamp: 20261031010000
-- A tela de taxas do admin salvava o objeto de taxas inteiro (com asaas_api_key) dentro de
-- cities.rates, e a tabela cities é lida pelo app (inclusive na tela de cadastro). Nenhum
-- código usa essa chave a partir de cities: o servidor lê a chave da variável de ambiente.
-- 1. Apaga a chave de todas as cidades.
-- 2. Gatilho impede que qualquer chave/segredo volte a ser gravado em cities.rates.
-- Reversão: não há (devolver um segredo para tabela pública não é uma reversão segura).
-- ==============================================================================
UPDATE public.cities
   SET rates = rates - 'asaas_api_key' - 'asaasApiKey' - 'api_key' - 'apiKey' - 'access_token' - 'asaas_account_api_key'
 WHERE rates IS NOT NULL
   AND (rates ?| ARRAY['asaas_api_key', 'asaasApiKey', 'api_key', 'apiKey', 'access_token', 'asaas_account_api_key']);

CREATE OR REPLACE FUNCTION public.cities_strip_secrets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rates IS NOT NULL AND jsonb_typeof(NEW.rates) = 'object' THEN
    NEW.rates := NEW.rates - 'asaas_api_key' - 'asaasApiKey' - 'api_key' - 'apiKey' - 'access_token' - 'asaas_account_api_key';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cities_strip_secrets ON public.cities;
CREATE TRIGGER trg_cities_strip_secrets
  BEFORE INSERT OR UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.cities_strip_secrets();
