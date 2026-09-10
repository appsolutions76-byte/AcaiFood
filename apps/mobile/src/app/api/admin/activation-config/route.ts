import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
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

    // Contar parceiros fundadores (todos os parceiros existentes na plataforma exceto cliente/admin)
    let subsidizedCount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    try {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, role, asaas_wallet_id, pix_key');

      if (allUsers && Array.isArray(allUsers)) {
        const partners = allUsers.filter(u => {
          const r = String(u.role || '').toLowerCase();
          return r !== 'cliente' && r !== 'admin' && r !== 'customer' && r !== 'client';
        });

        subsidizedCount = partners.length;
        paidCount = partners.filter(u => Boolean(u.asaas_wallet_id)).length;
        pendingCount = partners.filter(u => !u.asaas_wallet_id).length;
      }
    } catch (_e) {}

    return NextResponse.json({
      success: true,
      activationFee,
      freeQuota,
      activationEnabled,
      subsidizedCount,
      paidCount,
      pendingCount,
      freeSlotsRemaining: Math.max(0, freeQuota - subsidizedCount)
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
