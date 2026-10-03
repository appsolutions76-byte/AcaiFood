/**
 * Configurações oficiais da API Asaas
 * Suporta leitura por variáveis de ambiente e fallback para o banco de dados Supabase (platform_settings / Vault)
 * Prioriza estritamente chaves de PRODUÇÃO sobre chaves de HOMOLOGAÇÃO/SANDBOX.
 */

import { getSupabaseAdmin } from './supabaseAdmin';

export function getAsaasBaseUrl(apiKey?: string): string {
  if (apiKey && (apiKey.startsWith('$aact_hmlg_') || apiKey.includes('hmlg'))) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

function isProdKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.startsWith('$aact_hmlg_') || trimmed.includes('hmlg')) return false;
  return true;
}

/**
 * Obtém a chave do Asaas oficial.
 * 1. Lê de process.env.ASAAS_API_KEY
 * 2. Lê de Supabase (get_platform_asaas_key RPC e platform_settings.asaas_api_key)
 * 3. Se houver chave de produção em qualquer uma das fontes, descarta chaves de teste (sandbox/hmlg) e prioriza a de produção!
 */
export async function getAsaasApiKey(): Promise<string> {
  const envKey = (process.env.ASAAS_API_KEY || '').trim();

  let dbKey = '';
  try {
    const supabase = getSupabaseAdmin();
    // 1. Tentar RPC get_platform_asaas_key
    const { data: rpcKey } = await supabase.rpc('get_platform_asaas_key');
    if (rpcKey && typeof rpcKey === 'string' && rpcKey.trim()) {
      dbKey = rpcKey.trim();
    }

    // 2. Fallback direto para tabela platform_settings se RPC não retornou
    if (!dbKey) {
      const { data: settingData } = await supabase
        .from('platform_settings')
        .select('asaas_api_key')
        .not('asaas_api_key', 'is', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (settingData?.asaas_api_key && typeof settingData.asaas_api_key === 'string') {
        dbKey = settingData.asaas_api_key.trim();
      }
    }
  } catch (err) {
    console.warn('[AsaasConfig] Aviso ao buscar chave no Supabase:', err);
  }

  // Priorização de Produção:
  // Se envKey for Produção, usa envKey.
  // Se envKey for Sandbox/vazia mas dbKey for Produção, usa dbKey!
  let selectedKey = '';
  let source = '';

  if (isProdKey(envKey)) {
    selectedKey = envKey;
    source = 'ENV (Produção)';
  } else if (isProdKey(dbKey)) {
    selectedKey = dbKey;
    source = 'Supabase DB (Produção)';
  } else if (envKey) {
    selectedKey = envKey;
    source = 'ENV (Sandbox/Teste)';
  } else if (dbKey) {
    selectedKey = dbKey;
    source = 'Supabase DB (Sandbox/Teste)';
  }

  const masked = selectedKey
    ? `${selectedKey.substring(0, 10)}...${selectedKey.substring(selectedKey.length - 4)}`
    : 'NENHUMA';

  console.log(`[AsaasConfig] Resolvida chave Asaas | Origem: ${source} | Ambiente: ${isProdKey(selectedKey) ? 'PRODUÇÃO' : 'SANDBOX'} | Chave: ${masked}`);

  return selectedKey;
}
