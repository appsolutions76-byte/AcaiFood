import { createClient } from '@supabase/supabase-js';

let cachedAsaasKey: string | null = null;

export async function getAsaasApiKey(): Promise<string> {
  // 1. Tenta pegar de process.env.ASAAS_API_KEY
  if (process.env.ASAAS_API_KEY) {
    return process.env.ASAAS_API_KEY;
  }

  // 2. Se já estiver no cache em memória
  if (cachedAsaasKey) {
    return cachedAsaasKey;
  }

  // 3. Fallback seguro buscando no banco Supabase via Service Role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data } = await supabase
        .from('platform_settings')
        .select('asaas_api_key')
        .limit(1)
        .maybeSingle();

      if (data && data.asaas_api_key) {
        cachedAsaasKey = data.asaas_api_key;
        return data.asaas_api_key;
      }
    } catch (e) {
      console.warn("Aviso ao buscar ASAAS_API_KEY no Supabase:", e);
    }
  }

  return '';
}
