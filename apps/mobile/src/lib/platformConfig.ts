import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Configurações da plataforma em public.platform_config (key → value jsonb).
// Substitui o JSON que ficava dentro de platform_settings.asaas_platform_wallet_id.
// Enquanto a migration 20261006040000 não rodar, lê o JSON antigo como reserva.

export type PlatformConfigKey = 'activation' | 'support';

async function readLegacyJson(): Promise<any> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('platform_settings')
      .select('asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();
    const raw = data?.asaas_platform_wallet_id;
    if (raw && typeof raw === 'string' && raw.trim().startsWith('{')) {
      return JSON.parse(raw) || {};
    }
  } catch (_e) {}
  return {};
}

export async function getPlatformConfig<T = any>(key: PlatformConfigKey): Promise<T | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('platform_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (!error) {
      return (data?.value as T) ?? null;
    }
  } catch (_e) {}

  // Reserva: formato antigo
  const legacy = await readLegacyJson();
  if (key === 'support') return (legacy?.support_config as T) ?? null;
  if (key === 'activation') {
    const v: any = {};
    if (legacy?.activationFee !== undefined) v.activationFee = legacy.activationFee;
    if (legacy?.freeQuota !== undefined) v.freeQuota = legacy.freeQuota;
    return Object.keys(v).length ? (v as T) : null;
  }
  return null;
}

export async function setPlatformConfig(key: PlatformConfigKey, value: any): Promise<{ ok: boolean; error?: string }> {
  const { error } = await getSupabaseAdmin()
    .from('platform_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return { ok: false, error: 'Tabela platform_config indisponível (rode a migration 20261006040000).' };
  return { ok: true };
}
