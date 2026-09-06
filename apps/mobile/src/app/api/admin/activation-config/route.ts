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
      const { data: cfg } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'activation_config')
        .maybeSingle();

      if (cfg) {
        if (cfg.activation_fee !== undefined) activationFee = Number(cfg.activation_fee);
        if (cfg.free_quota !== undefined) freeQuota = Number(cfg.free_quota);
        if (cfg.activation_enabled !== undefined) activationEnabled = Boolean(cfg.activation_enabled);
      }
    } catch (_e) {}

    // Estatísticas
    let subsidizedCount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    try {
      const { count: subCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_founder_subsidized', true);
      if (subCount !== null) subsidizedCount = subCount;

      const { count: pCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('activation_paid', true)
        .eq('is_founder_subsidized', false);
      if (pCount !== null) paidCount = pCount;

      const { count: pendCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .neq('role', 'cliente')
        .neq('role', 'admin')
        .or('activation_paid.is.null,activation_paid.eq.false')
        .or('is_founder_subsidized.is.null,is_founder_subsidized.eq.false');
      if (pendCount !== null) pendingCount = pendCount;
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

    const payload: any = {
      id: 'activation_config',
      updated_at: new Date().toISOString()
    };
    if (activationFee !== undefined) payload.activation_fee = Number(activationFee);
    if (freeQuota !== undefined) payload.free_quota = Number(freeQuota);
    if (activationEnabled !== undefined) payload.activation_enabled = Boolean(activationEnabled);

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      config: data
    });

  } catch (error: any) {
    console.error('Erro POST /api/admin/activation-config:', error);
    return NextResponse.json({ error: error.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}
