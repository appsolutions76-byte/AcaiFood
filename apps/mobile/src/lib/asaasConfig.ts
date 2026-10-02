/**
 * Configurações oficiais da API Asaas
 * As credenciais são lidas exclusivamente de variáveis de ambiente do servidor (Anexo I, Item 4)
 */

export function getAsaasBaseUrl(apiKey?: string): string {
  if (apiKey && apiKey.startsWith('$aact_hmlg_')) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

/**
 * Obtém a chave do Asaas oficial exclusivamente de process.env.ASAAS_API_KEY
 */
export async function getAsaasApiKey(): Promise<string> {
  const envKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
  return envKey;
}
