-- ==============================================================================
-- AÇAÍFOOD R37 (segurança) — Remove os lugares antigos onde a chave do Asaas podia ficar no banco
-- Timestamp: 20261101010000
--
-- O app lê a chave do Asaas SOMENTE da variável de ambiente ASAAS_API_KEY (lib/asaasConfig.ts).
-- Nenhum código, rota, gatilho ou função usa os itens abaixo (conferido em 01/11/2026):
--   1. função public.get_platform_asaas_key()   (criada em 20260901040000, sem uso)
--   2. coluna  public.platform_settings.asaas_api_key (vazia desde o R9; foi daqui que a chave
--      chegou ao estado do admin e acabou gravada em cities.rates — ver R36)
--   3. segredo 'ASAAS_API_KEY' no Supabase Vault (fallback da função 1; sem uso)
--
-- NÃO mexe em public.partner_secrets (chaves das subcontas — necessárias e só para service_role).
-- Reversão: não há. Devolver um lugar para guardar segredo no banco não é reversão segura.
-- ==============================================================================

-- 1. Função antiga que lia a chave do banco/Vault
DROP FUNCTION IF EXISTS public.get_platform_asaas_key();

-- 2. Coluna antiga da chave em platform_settings
ALTER TABLE public.platform_settings DROP COLUMN IF EXISTS asaas_api_key;

-- 3. Cópia da chave no Vault (se existir). Ignora se o Vault não estiver disponível.
DO $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'ASAAS_API_KEY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Vault indisponível ou sem permissão: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
