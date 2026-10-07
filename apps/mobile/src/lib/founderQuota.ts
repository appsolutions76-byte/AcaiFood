import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlatformConfig } from '@/lib/platformConfig';

export interface FounderQuotaStatus {
  activationFee: number;
  freeQuota: number;
  activationEnabled: boolean;
  subsidizedCount: number;
  paidCount: number;
  pendingCount: number;
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
    // A flag que vale é a coluna activation_fee_enabled; taxa e cota ficam em platform_config
    const { data: row } = await supabase
      .from('platform_settings')
      .select('activation_fee_enabled')
      .limit(1)
      .maybeSingle();

    if (row?.activation_fee_enabled !== undefined && row.activation_fee_enabled !== null) {
      activationEnabled = Boolean(row.activation_fee_enabled);
    }

    const cfg: any = await getPlatformConfig('activation');
    if (cfg?.activationFee !== undefined) activationFee = Number(cfg.activationFee);
    if (cfg?.freeQuota !== undefined) freeQuota = Number(cfg.freeQuota);
  } catch (_e) {}

  let subsidizedCount = 0;
  let paidCount = 0;
  let pendingCount = 0;
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
      paidCount = partners.filter(u => u.status === 'active' || Boolean(u.asaas_wallet_id)).length;
      pendingCount = partners.filter(u => u.status !== 'active' && !u.asaas_wallet_id).length;

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
    paidCount,
    pendingCount,
    freeSlotsRemaining,
    isUserAlreadyFounder,
    isFree
  };
}
