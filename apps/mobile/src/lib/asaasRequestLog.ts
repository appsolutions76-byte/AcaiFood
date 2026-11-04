import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * R47 — Guarda o que o app enviou ao Asaas e o que voltou (para mandar ao suporte do Asaas).
 * NUNCA grava chaves: apiKey da subconta, authToken de webhook e access_token são removidos.
 * Falha ao registrar nunca interrompe a operação.
 */
const SECRET_KEYS = ['apikey', 'authtoken', 'access_token', 'accesstoken', 'password', 'token'];

export function redactSecrets(value: any, depth = 0): any {
  if (value === null || value === undefined || depth > 6) return value;
  if (Array.isArray(value)) return value.map(v => redactSecrets(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.includes(k.toLowerCase()) ? '[removido]' : redactSecrets(v, depth + 1);
    }
    return out;
  }
  return value;
}

export async function logAsaasRequest(entry: {
  userId?: string | null;
  action: string;
  method?: string;
  endpoint?: string;
  requestBody?: any;
  responseStatus?: number | null;
  responseBody?: any;
  error?: string | null;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from('asaas_request_log').insert({
      user_id: entry.userId || null,
      action: entry.action,
      method: entry.method || null,
      endpoint: entry.endpoint || null,
      request_body: entry.requestBody !== undefined ? redactSecrets(entry.requestBody) : null,
      response_status: entry.responseStatus ?? null,
      response_body: entry.responseBody !== undefined ? redactSecrets(entry.responseBody) : null,
      error: entry.error || null,
    });
  } catch (_e) {
    /* registro é auxiliar: nunca derruba a operação */
  }
}
