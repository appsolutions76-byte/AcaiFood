import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getFounderQuotaStatus } from '@/lib/founderQuota';
import { logAdminAction } from '@/lib/adminAudit';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || undefined;

    const quota = await getFounderQuotaStatus({ city });

    return NextResponse.json({
      success: true,
      // Propriedades existentes (100% retrocompatíveis)
      activationFee: quota.activationFee,
      freeQuota: quota.freeQuota,
      activationEnabled: quota.activationEnabled,
      subsidizedCount: quota.subsidizedCount,
      paidCount: quota.paidCount,
      pendingCount: quota.pendingCount,
      freeSlotsRemaining: quota.freeSlotsRemaining,

      // Novas propriedades estruturadas
      stores: quota.stores,
      couriers: quota.couriers,
      cityBreakdown: quota.cityBreakdown || [],
      cityConfigs: quota.cityConfigs || {},
      targetCity: quota.targetCity || null
    });

  } catch (error: any) {
    console.error('Erro GET /api/admin/activation-config:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar configurações' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const {
      activationFee,
      freeQuota,
      activationEnabled,
      storeFreeQuota,
      storeActivationFee,
      courierFreeQuota,
      courierActivationFee,
      cityConfigs
    } = body;

    const supabase = getSupabaseAdmin();

    const { data: firstRow } = await supabase
      .from('platform_settings')
      .select('id, activation_fee_enabled')
      .limit(1)
      .maybeSingle();

    const currentCfg: any = (await getPlatformConfig('activation')) || {};

    const updatedCfg: any = {
      ...currentCfg,
      activationFee: activationFee !== undefined ? Number(activationFee) : (currentCfg.activationFee ?? 12.90),
      freeQuota: freeQuota !== undefined ? Number(freeQuota) : (currentCfg.freeQuota ?? 50),
      activationEnabled: activationEnabled !== undefined ? Boolean(activationEnabled) : (firstRow?.activation_fee_enabled ?? true),
      updatedAt: new Date().toISOString()
    };

    // Atualização de Lojas
    if (storeFreeQuota !== undefined) updatedCfg.storeFreeQuota = Math.max(0, Number(storeFreeQuota));
    else if (updatedCfg.storeFreeQuota === undefined) updatedCfg.storeFreeQuota = 20;

    if (storeActivationFee !== undefined) updatedCfg.storeActivationFee = Math.max(0, Number(storeActivationFee));
    else if (updatedCfg.storeActivationFee === undefined) updatedCfg.storeActivationFee = updatedCfg.activationFee;

    // Atualização de Motoboys
    if (courierFreeQuota !== undefined) updatedCfg.courierFreeQuota = Math.max(0, Number(courierFreeQuota));
    else if (updatedCfg.courierFreeQuota === undefined) updatedCfg.courierFreeQuota = 30;

    if (courierActivationFee !== undefined) updatedCfg.courierActivationFee = Math.max(0, Number(courierActivationFee));
    else if (updatedCfg.courierActivationFee === undefined) updatedCfg.courierActivationFee = updatedCfg.activationFee;

    // Se cityConfigs for fornecido
    if (cityConfigs !== undefined && typeof cityConfigs === 'object') {
      updatedCfg.cityConfigs = cityConfigs;
    }

    // Manter a cota global sincronizada (soma das cotas ou fallback)
    if (storeFreeQuota !== undefined || courierFreeQuota !== undefined) {
      updatedCfg.freeQuota = (updatedCfg.storeFreeQuota || 0) + (updatedCfg.courierFreeQuota || 0);
    }

    if (
      !Number.isFinite(updatedCfg.activationFee) || updatedCfg.activationFee < 0 ||
      !Number.isFinite(updatedCfg.freeQuota) || updatedCfg.freeQuota < 0 ||
      !Number.isFinite(updatedCfg.storeFreeQuota) || updatedCfg.storeFreeQuota < 0 ||
      !Number.isFinite(updatedCfg.courierFreeQuota) || updatedCfg.courierFreeQuota < 0
    ) {
      return NextResponse.json({ error: 'Valores numéricos inválidos para cotas ou taxas' }, { status: 400 });
    }

    const saved = await setPlatformConfig('activation', updatedCfg);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    // A flag que vale no banco legado é activation_fee_enabled
    if (firstRow?.id) {
      const { error: updErr } = await supabase
        .from('platform_settings')
        .update({ activation_fee_enabled: updatedCfg.activationEnabled })
        .eq('id', firstRow.id);
      if (updErr) throw updErr;
    }

    await logAdminAction({
      actorId: auth.user?.id || auth.profile?.id || null,
      action: 'ACTIVATION_CONFIG_UPDATED',
      targetType: 'PLATFORM_SETTINGS',
      targetId: firstRow?.id ? String(firstRow.id) : undefined,
      beforeState: { ...currentCfg, activation_fee_enabled: firstRow?.activation_fee_enabled },
      afterState: updatedCfg,
      request
    });

    return NextResponse.json({
      success: true,
      config: updatedCfg
    });

  } catch (error: any) {
    console.error('Erro POST /api/admin/activation-config:', error);
    return NextResponse.json({ error: error.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}
