import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getFounderQuotaStatus } from '@/lib/founderQuota';

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

    // Ler linha existente de platform_settings
    const { data: firstRow } = await supabase
      .from('platform_settings')
      .select('id, asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    let currentCfg: any = {};
    if (firstRow?.asaas_platform_wallet_id) {
      try {
        currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
      } catch (_e) {}
    }

    const updatedCfg = {
      ...currentCfg,
      activationFee: activationFee !== undefined ? Number(activationFee) : (currentCfg.activationFee ?? 12.90),
      freeQuota: freeQuota !== undefined ? Number(freeQuota) : (currentCfg.freeQuota ?? 50),
      activationEnabled: activationEnabled !== undefined ? Boolean(activationEnabled) : (currentCfg.activationEnabled ?? true),
      updatedAt: new Date().toISOString()
    };

    const serializedCfg = JSON.stringify(updatedCfg);

    if (firstRow?.id) {
      const { error: updErr } = await supabase
        .from('platform_settings')
        .update({ asaas_platform_wallet_id: serializedCfg })
        .eq('id', firstRow.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from('platform_settings')
        .insert({ asaas_platform_wallet_id: serializedCfg });
      if (insErr) throw insErr;
    }

    return NextResponse.json({
      success: true,
      config: updatedCfg
    });

  } catch (error: any) {
    console.error('Erro POST /api/admin/activation-config:', error);
    return NextResponse.json({ error: error.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}
