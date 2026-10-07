/**
 * Configurações da API Asaas.
 *
 * A chave vem SOMENTE da variável de ambiente ASAAS_API_KEY de cada ambiente
 * (Production na Vercel = chave de produção; Preview/Development = chave sandbox).
 * Não há fallback para o banco nem "preferência por produção": um preview nunca pode
 * usar a chave de produção (Anexo I, itens 4.1 e 5 do contrato BaaS).
 */

export function getAsaasBaseUrl(apiKey?: string): string {
  if (apiKey && (apiKey.startsWith('$aact_hmlg_') || apiKey.includes('hmlg'))) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

export function isSandboxKey(key?: string): boolean {
  return Boolean(key && (key.startsWith('$aact_hmlg_') || key.includes('hmlg')));
}

export async function getAsaasApiKey(): Promise<string> {
  const envKey = (process.env.ASAAS_API_KEY || '').trim();

  if (!envKey) {
    console.error('[AsaasConfig] ASAAS_API_KEY não configurada neste ambiente.');
    return '';
  }

  // Trava contra mistura de ambientes: em produção da Vercel não aceita chave sandbox
  // e fora de produção não aceita chave de produção.
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || '';
  if (vercelEnv === 'production' && process.env.VERCEL_ENV && isSandboxKey(envKey)) {
    console.error('[AsaasConfig] Chave SANDBOX configurada no ambiente de PRODUÇÃO. Corrija ASAAS_API_KEY.');
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' && !isSandboxKey(envKey)) {
    console.error('[AsaasConfig] Chave de PRODUÇÃO em ambiente de preview/desenvolvimento. Bloqueado.');
    return '';
  }

  return envKey;
}
