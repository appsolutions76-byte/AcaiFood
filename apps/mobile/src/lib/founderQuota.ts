import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlatformConfig } from '@/lib/platformConfig';

export interface CategoryQuota {
  freeQuota: number;
  activationFee: number;
  subsidizedCount: number;
  paidCount: number;
  pendingCount: number;
  freeSlotsRemaining: number;
}

export interface CityBreakdownItem {
  city: string;
  normalizedCity: string;
  isCustom: boolean;
  storesSubsidized: number;
  storesPaid: number;
  storesFreeQuota: number;
  storesActivationFee: number;
  storesFreeSlotsRemaining: number;
  couriersSubsidized: number;
  couriersPaid: number;
  couriersFreeQuota: number;
  couriersActivationFee: number;
  couriersFreeSlotsRemaining: number;
}

export interface FounderQuotaStatus {
  // Campos existentes mantidos para compatibilidade retroativa
  activationFee: number;
  freeQuota: number;
  activationEnabled: boolean;
  subsidizedCount: number;
  paidCount: number;
  pendingCount: number;
  freeSlotsRemaining: number;
  isUserAlreadyFounder: boolean;
  isFree: boolean;

  // Novos campos detalhados por papel (Lojas vs Motoboys) e Cidade
  targetRole?: 'store' | 'courier' | 'all';
  targetCity?: string;
  stores: CategoryQuota;
  couriers: CategoryQuota;
  cityBreakdown?: CityBreakdownItem[];
  cityConfigs?: Record<string, {
    storeFreeQuota?: number;
    storeActivationFee?: number;
    courierFreeQuota?: number;
    courierActivationFee?: number;
  }>;
}

export interface FounderQuotaQueryOptions {
  userId?: string;
  role?: string;
  city?: string;
}

export function isStoreRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return (
    r === 'loja' ||
    r === 'partner' ||
    r === 'batedeira' ||
    r === 'fornecedor' ||
    r === 'supplier'
  );
}

export function isCourierRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return (
    r === 'motorista' ||
    r === 'courier' ||
    r === 'motoboy' ||
    r === 'caminhao' ||
    r === 'driver'
  );
}

export function normalizeCity(cityName?: string | null): string {
  if (!cityName) return '';
  return String(cityName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export async function getFounderQuotaStatus(
  userIdOrOptions?: string | FounderQuotaQueryOptions
): Promise<FounderQuotaStatus> {
  const supabase = getSupabaseAdmin();

  // Desestruturar opções mantendo compatibilidade se for passado apenas userId (string)
  let userId: string | undefined;
  let targetRoleStr: string | undefined;
  let targetCityStr: string | undefined;

  if (typeof userIdOrOptions === 'string') {
    userId = userIdOrOptions;
  } else if (userIdOrOptions && typeof userIdOrOptions === 'object') {
    userId = userIdOrOptions.userId;
    targetRoleStr = userIdOrOptions.role;
    targetCityStr = userIdOrOptions.city;
  }

  // Valores padrão globais
  let activationFee = 15.0;
  let freeQuota = 60;
  let activationEnabled = true;

  let storeFreeQuota = 30;
  let storeActivationFee = 15.0;
  let courierFreeQuota = 30;
  let courierActivationFee = 15.0;
  let cityConfigs: Record<string, any> = {};

  try {
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

    // Novos parâmetros específicos de lojas e motoboys
    if (cfg?.storeFreeQuota !== undefined) storeFreeQuota = Number(cfg.storeFreeQuota);
    else storeFreeQuota = Math.round(freeQuota * 0.5);

    if (cfg?.storeActivationFee !== undefined) storeActivationFee = Number(cfg.storeActivationFee);
    else storeActivationFee = activationFee;

    if (cfg?.courierFreeQuota !== undefined) courierFreeQuota = Number(cfg.courierFreeQuota);
    else courierFreeQuota = Math.max(0, freeQuota - storeFreeQuota);

    if (cfg?.courierActivationFee !== undefined) courierActivationFee = Number(cfg.courierActivationFee);
    else courierActivationFee = activationFee;

    if (cfg?.cityConfigs && typeof cfg.cityConfigs === 'object') {
      cityConfigs = cfg.cityConfigs;
    }
  } catch (_e) {}

  let subsidizedCount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let isUserAlreadyFounder = false;

  let storesSubsidizedCount = 0;
  let storesPaidCount = 0;
  let storesPendingCount = 0;

  let couriersSubsidizedCount = 0;
  let couriersPaidCount = 0;
  let couriersPendingCount = 0;

  const cityMap = new Map<string, {
    originalCity: string;
    storesSubsidized: number;
    storesPaid: number;
    couriersSubsidized: number;
    couriersPaid: number;
  }>();

  try {
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, role, cidade, created_at, asaas_wallet_id, asaas_account_id, pix_key, status')
      .order('created_at', { ascending: true });

    if (allUsers && Array.isArray(allUsers)) {
      // Se tivermos um userId, buscar os dados desse usuário para auto-preencher role e cidade caso não passados
      if (userId) {
        const currentUserData = allUsers.find(u => u.id === userId);
        if (currentUserData) {
          if (!targetRoleStr && currentUserData.role) targetRoleStr = currentUserData.role;
          if (!targetCityStr && currentUserData.cidade) targetCityStr = currentUserData.cidade;
        }
      }

      const partners = allUsers.filter(u => {
        const r = String(u.role || '').toLowerCase();
        return r !== 'cliente' && r !== 'admin' && r !== 'customer' && r !== 'client';
      });

      // Mapeamento geral compatível
      const founderPartners = partners.slice(0, freeQuota);
      subsidizedCount = founderPartners.length;
      paidCount = partners.filter(u => u.status === 'active' || Boolean(u.asaas_wallet_id)).length;
      pendingCount = partners.filter(u => u.status !== 'active' && !u.asaas_wallet_id).length;

      // Agrupar por papéis: Lojas e Motoboys
      const storePartners = partners.filter(p => isStoreRole(p.role));
      const courierPartners = partners.filter(p => isCourierRole(p.role));

      // Configuração para a cidade alvo (se aplicável)
      const targetNormCity = normalizeCity(targetCityStr);
      let effectiveStoreQuota = storeFreeQuota;
      let effectiveStoreFee = storeActivationFee;
      let effectiveCourierQuota = courierFreeQuota;
      let effectiveCourierFee = courierActivationFee;

      if (targetNormCity && cityConfigs[targetNormCity]) {
        const cCfg = cityConfigs[targetNormCity];
        if (cCfg.storeFreeQuota !== undefined) effectiveStoreQuota = Number(cCfg.storeFreeQuota);
        if (cCfg.storeActivationFee !== undefined) effectiveStoreFee = Number(cCfg.storeActivationFee);
        if (cCfg.courierFreeQuota !== undefined) effectiveCourierQuota = Number(cCfg.courierFreeQuota);
        if (cCfg.courierActivationFee !== undefined) effectiveCourierFee = Number(cCfg.courierActivationFee);
      }

      // Lojas: se houver cidade alvo, calcula dentro da cidade alvo
      const relevantStores = targetNormCity
        ? storePartners.filter(p => normalizeCity(p.cidade) === targetNormCity)
        : storePartners;

      const founderStores = relevantStores.slice(0, effectiveStoreQuota);
      storesSubsidizedCount = founderStores.length;
      storesPaidCount = relevantStores.filter(u => u.status === 'active' || Boolean(u.asaas_wallet_id)).length;
      storesPendingCount = relevantStores.filter(u => u.status !== 'active' && !u.asaas_wallet_id).length;

      // Motoboys: se houver cidade alvo, calcula dentro da cidade alvo
      const relevantCouriers = targetNormCity
        ? courierPartners.filter(p => normalizeCity(p.cidade) === targetNormCity)
        : courierPartners;

      const founderCouriers = relevantCouriers.slice(0, effectiveCourierQuota);
      couriersSubsidizedCount = founderCouriers.length;
      couriersPaidCount = relevantCouriers.filter(u => u.status === 'active' || Boolean(u.asaas_wallet_id)).length;
      couriersPendingCount = relevantCouriers.filter(u => u.status !== 'active' && !u.asaas_wallet_id).length;

      // Montar quebra por cidades para o Painel do Admin
      partners.forEach(p => {
        const rawCity = String(p.cidade || '').trim();
        const norm = normalizeCity(rawCity) || 'sem-cidade';
        const displayCity = rawCity || 'Sem cidade definida';

        if (!cityMap.has(norm)) {
          cityMap.set(norm, {
            originalCity: displayCity,
            storesSubsidized: 0,
            storesPaid: 0,
            couriersSubsidized: 0,
            couriersPaid: 0
          });
        }

        const entry = cityMap.get(norm)!;
        const isPaid = p.status === 'active' || Boolean(p.asaas_wallet_id);

        if (isStoreRole(p.role)) {
          if (isPaid) entry.storesPaid++;
          entry.storesSubsidized++;
        } else if (isCourierRole(p.role)) {
          if (isPaid) entry.couriersPaid++;
          entry.couriersSubsidized++;
        }
      });

      // Avaliação se o usuário já é fundador
      if (userId) {
        if (isStoreRole(targetRoleStr)) {
          isUserAlreadyFounder = founderStores.some(p => p.id === userId);
        } else if (isCourierRole(targetRoleStr)) {
          isUserAlreadyFounder = founderCouriers.some(p => p.id === userId);
        } else {
          isUserAlreadyFounder = founderPartners.some(p => p.id === userId);
        }
      }
    }
  } catch (_e) {}

  // Configuração efetiva para o escopo atual
  const targetNormCity = normalizeCity(targetCityStr);
  let effectiveStoreQuota = storeFreeQuota;
  let effectiveStoreFee = storeActivationFee;
  let effectiveCourierQuota = courierFreeQuota;
  let effectiveCourierFee = courierActivationFee;

  if (targetNormCity && cityConfigs[targetNormCity]) {
    const cCfg = cityConfigs[targetNormCity];
    if (cCfg.storeFreeQuota !== undefined) effectiveStoreQuota = Number(cCfg.storeFreeQuota);
    if (cCfg.storeActivationFee !== undefined) effectiveStoreFee = Number(cCfg.storeActivationFee);
    if (cCfg.courierFreeQuota !== undefined) effectiveCourierQuota = Number(cCfg.courierFreeQuota);
    if (cCfg.courierActivationFee !== undefined) effectiveCourierFee = Number(cCfg.courierActivationFee);
  }

  // Cálculo de vagas restantes usando as cotas efetivas
  const storeSlotsLeft = Math.max(0, effectiveStoreQuota - storesSubsidizedCount);
  const courierSlotsLeft = Math.max(0, effectiveCourierQuota - couriersSubsidizedCount);
  const freeSlotsRemaining = Math.max(0, freeQuota - subsidizedCount);

  // Determinar se para o usuário ou target atual é gratuito
  const isTargetStore = isStoreRole(targetRoleStr);
  const isTargetCourier = isCourierRole(targetRoleStr);

  let isFree = !activationEnabled;
  let relevantFee = activationFee;

  if (activationEnabled) {
    if (userId) {
      isFree = isUserAlreadyFounder;
    } else if (isTargetStore) {
      isFree = storeSlotsLeft > 0;
      relevantFee = effectiveStoreFee;
    } else if (isTargetCourier) {
      isFree = courierSlotsLeft > 0;
      relevantFee = effectiveCourierFee;
    } else {
      isFree = freeSlotsRemaining > 0;
    }
  }

  if (isTargetStore) relevantFee = effectiveStoreFee;
  if (isTargetCourier) relevantFee = effectiveCourierFee;

  // Montar array de cidades para o Admin
  const cityBreakdown: CityBreakdownItem[] = Array.from(cityMap.entries()).map(([norm, val]) => {
    const cCfg = cityConfigs[norm] || {};
    const hasCustom = Boolean(cityConfigs[norm]);
    const cStoreQuota = cCfg.storeFreeQuota !== undefined ? Number(cCfg.storeFreeQuota) : storeFreeQuota;
    const cStoreFee = cCfg.storeActivationFee !== undefined ? Number(cCfg.storeActivationFee) : storeActivationFee;
    const cCourierQuota = cCfg.courierFreeQuota !== undefined ? Number(cCfg.courierFreeQuota) : courierFreeQuota;
    const cCourierFee = cCfg.courierActivationFee !== undefined ? Number(cCfg.courierActivationFee) : courierActivationFee;

    return {
      city: val.originalCity,
      normalizedCity: norm,
      isCustom: hasCustom,
      storesSubsidized: val.storesSubsidized,
      storesPaid: val.storesPaid,
      storesFreeQuota: cStoreQuota,
      storesActivationFee: cStoreFee,
      storesFreeSlotsRemaining: Math.max(0, cStoreQuota - val.storesSubsidized),
      couriersSubsidized: val.couriersSubsidized,
      couriersPaid: val.couriersPaid,
      couriersFreeQuota: cCourierQuota,
      couriersActivationFee: cCourierFee,
      couriersFreeSlotsRemaining: Math.max(0, cCourierQuota - val.couriersSubsidized),
    };
  });

  return {
    activationFee: relevantFee,
    freeQuota,
    activationEnabled,
    subsidizedCount,
    paidCount,
    pendingCount,
    freeSlotsRemaining,
    isUserAlreadyFounder,
    isFree,

    targetRole: isTargetStore ? 'store' : isTargetCourier ? 'courier' : 'all',
    targetCity: targetCityStr,

    stores: {
      freeQuota: effectiveStoreQuota,
      activationFee: effectiveStoreFee,
      subsidizedCount: storesSubsidizedCount,
      paidCount: storesPaidCount,
      pendingCount: storesPendingCount,
      freeSlotsRemaining: storeSlotsLeft
    },

    couriers: {
      freeQuota: effectiveCourierQuota,
      activationFee: effectiveCourierFee,
      subsidizedCount: couriersSubsidizedCount,
      paidCount: couriersPaidCount,
      pendingCount: couriersPendingCount,
      freeSlotsRemaining: courierSlotsLeft
    },

    cityBreakdown,
    cityConfigs
  };
}
