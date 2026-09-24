import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
 * Obtém a chave do Asaas oficial com prioridade absoluta para a chave de PRODUÇÃO ($aact_prod_...)
 */
export async function getAsaasApiKey(): Promise<string> {
  // 1. Se já está no cache e é de produção
  if (cachedAsaasKey && cachedAsaasKey.startsWith('$aact_prod_')) {
    return cachedAsaasKey;
  }

  // 2. Se a variável de ambiente já possui a chave de produção
  const envKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
  if (envKey && envKey.startsWith('$aact_prod_')) {
    cachedAsaasKey = envKey;
    return envKey;
  }

  // 3. Busca no Supabase com Service Role (chave de produção configurada no banco)
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('platform_settings')
      .select('asaas_api_key')
      .limit(1)
      .maybeSingle();

    if (data?.asaas_api_key && data.asaas_api_key.trim().startsWith('$aact_prod_')) {
      cachedAsaasKey = data.asaas_api_key.trim();
      return cachedAsaasKey;
    }

    if (data?.asaas_api_key && data.asaas_api_key.trim()) {
      cachedAsaasKey = data.asaas_api_key.trim();
      return cachedAsaasKey;
    }
  } catch (err) {
    console.warn("Aviso ao buscar ASAAS_API_KEY no Supabase:", err);
  }

  // 4. Fallback para a chave de ambiente
  if (envKey) {
    cachedAsaasKey = envKey;
    return envKey;
  }

  return cachedAsaasKey || '';
}
