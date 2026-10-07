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
    const quota = await getFounderQuotaStatus();

    return NextResponse.json({
      success: true,
      activationFee: quota.activationFee,
      freeQuota: quota.freeQuota,
      activationEnabled: quota.activationEnabled,
      subsidizedCount: quota.subsidizedCount,
      paidCount: quota.paidCount,
      pendingCount: quota.pendingCount,
      freeSlotsRemaining: quota.freeSlotsRemaining
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
    const { activationFee, freeQuota, activationEnabled } = body;

    const supabase = getSupabaseAdmin();

    const { data: firstRow } = await supabase
      .from('platform_settings')
      .select('id, activation_fee_enabled')
      .limit(1)
      .maybeSingle();

    const currentCfg: any = (await getPlatformConfig('activation')) || {};

    const updatedCfg = {
      activationFee: activationFee !== undefined ? Number(activationFee) : (currentCfg.activationFee ?? 12.90),
      freeQuota: freeQuota !== undefined ? Number(freeQuota) : (currentCfg.freeQuota ?? 50),
      activationEnabled: activationEnabled !== undefined ? Boolean(activationEnabled) : (firstRow?.activation_fee_enabled ?? true),
      updatedAt: new Date().toISOString()
    };

    if (!Number.isFinite(updatedCfg.activationFee) || updatedCfg.activationFee < 0 || !Number.isFinite(updatedCfg.freeQuota) || updatedCfg.freeQuota < 0) {
      return NextResponse.json({ error: 'Valores inválidos' }, { status: 400 });
    }

    const saved = await setPlatformConfig('activation', { activationFee: updatedCfg.activationFee, freeQuota: updatedCfg.freeQuota });
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    // A flag que vale é a COLUNA activation_fee_enabled (lida por founderQuota/activation)
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
