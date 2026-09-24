import { createClient } from '@supabase/supabase-js';

let cachedAsaasKey: string = '';

/**
 * Retorna a URL base correta do Asaas conforme o tipo da chave (Sandbox ou Produção)
 */
export function getAsaasBaseUrl(apiKey?: string): string {
  if (apiKey && apiKey.startsWith('$aact_hmlg_')) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

/**
 * Obtém a chave do Asaas oficial exclusivamente das variáveis de ambiente do servidor (process.env.ASAAS_API_KEY)
 */
export async function getAsaasApiKey(): Promise<string> {
  const envKey = process.env.ASAAS_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}
