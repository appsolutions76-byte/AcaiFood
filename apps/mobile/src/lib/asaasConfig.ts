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
 * Obtém a chave do Asaas oficial com prioridade para chaves de PRODUÇÃO ($aact_prod_...)
 */
export async function getAsaasApiKey(): Promise<string> {
  // 1. Se já está no cache e é de produção
  if (cachedAsaasKey && cachedAsaasKey.startsWith('$aact_prod_')) {
    return cachedAsaasKey;
  }

  // 2. Tenta buscar no banco Supabase primeiro (onde está a chave de produção configurada no painel)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);

      // 2.1 Tenta ler via platform_settings
      const { data } = await supabase
        .from('platform_settings')
        .select('asaas_api_key')
        .limit(1)
        .maybeSingle();

      if (data && data.asaas_api_key && data.asaas_api_key.trim()) {
        const dbKey = data.asaas_api_key.trim();
        // Se a chave do banco for de produção, usa com prioridade máxima
        if (dbKey.startsWith('$aact_prod_')) {
          cachedAsaasKey = dbKey;
          return dbKey;
        }
      }

      // 2.2 Tenta ler via RPC segura
      try {
        const { data: rpcKey } = await supabase.rpc('get_platform_asaas_key');
        if (rpcKey && typeof rpcKey === 'string' && rpcKey.startsWith('$aact_prod_')) {
          cachedAsaasKey = rpcKey;
          return rpcKey;
        }
      } catch (_rpcErr) {}

      // Se achou alguma chave no banco mesmo que não comece com $aact_prod_
      if (data?.asaas_api_key) {
        cachedAsaasKey = data.asaas_api_key.trim();
        return cachedAsaasKey;
      }
    } catch (e) {
      console.warn("Aviso ao buscar ASAAS_API_KEY no Supabase:", e);
    }
  }

  // 3. Fallback para process.env.ASAAS_API_KEY
  if (process.env.ASAAS_API_KEY) {
    cachedAsaasKey = process.env.ASAAS_API_KEY.trim();
    return cachedAsaasKey;
  }

  return cachedAsaasKey || '';
}
