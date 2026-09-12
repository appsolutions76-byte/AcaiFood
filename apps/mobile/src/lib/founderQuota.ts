import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface FounderQuotaStatus {
  activationFee: number;
  freeQuota: number;
  activationEnabled: boolean;
  subsidizedCount: number;
  freeSlotsRemaining: number;
  isUserAlreadyFounder: boolean;
  isFree: boolean;
}

export async function getFounderQuotaStatus(userId?: string): Promise<FounderQuotaStatus> {
  const supabase = getSupabaseAdmin();

  let activationFee = 12.90;
  let freeQuota = 50;
  let activationEnabled = true;

  try {
    const { data: row } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (row?.asaas_platform_wallet_id) {
      try {
        const parsed = JSON.parse(row.asaas_platform_wallet_id);
        if (parsed && typeof parsed === 'object') {
          if (parsed.activationFee !== undefined) activationFee = Number(parsed.activationFee);
          if (parsed.freeQuota !== undefined) freeQuota = Number(parsed.freeQuota);
          if (parsed.activationEnabled !== undefined) activationEnabled = Boolean(parsed.activationEnabled);
        }
      } catch (_e) {}
    }
  } catch (_e) {}

  let subsidizedCount = 0;
  let isUserAlreadyFounder = false;

  try {
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, role, created_at, asaas_wallet_id, pix_key, status')
      .order('created_at', { ascending: true });

    if (allUsers && Array.isArray(allUsers)) {
      const partners = allUsers.filter(u => {
        const r = String(u.role || '').toLowerCase();
        return r !== 'cliente' && r !== 'admin' && r !== 'customer' && r !== 'client';
      });

      const founderPartners = partners.slice(0, freeQuota);
      subsidizedCount = founderPartners.length;

      if (userId) {
        isUserAlreadyFounder = founderPartners.some(p => p.id === userId);
      }
    }
  } catch (_e) {}

  const freeSlotsRemaining = Math.max(0, freeQuota - subsidizedCount);
  const isFree = !activationEnabled || (userId ? isUserAlreadyFounder : freeSlotsRemaining > 0);

  return {
    activationFee,
    freeQuota,
    activationEnabled,
    subsidizedCount,
    freeSlotsRemaining,
    isUserAlreadyFounder,
    isFree
  };
}
