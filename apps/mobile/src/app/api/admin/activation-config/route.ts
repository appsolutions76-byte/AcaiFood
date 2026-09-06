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

    // Contar parceiros fundadores (todos os parceiros existentes na plataforma exceto cliente/admin)
    let subsidizedCount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    try {
      // Auto-regularizar parceiros existentes para is_founder_subsidized = true e activation_paid = true
      await supabase
        .from('users')
        .update({ is_founder_subsidized: true, activation_paid: true })
        .neq('role', 'cliente')
        .neq('role', 'admin')
        .neq('role', 'CUSTOMER')
        .neq('role', 'ADMIN');

      const { data: allUsers } = await supabase
        .from('users')
        .select('id, role, is_founder_subsidized, activation_paid, asaas_wallet_id, pix_key');

      if (allUsers && Array.isArray(allUsers)) {
        const partners = allUsers.filter(u => {
          const r = String(u.role || '').toLowerCase();
          return r !== 'cliente' && r !== 'admin' && r !== 'customer';
        });

        subsidizedCount = partners.filter(u => u.is_founder_subsidized !== false).length;
        paidCount = partners.filter(u => u.activation_paid === true && u.is_founder_subsidized === false).length;
        pendingCount = partners.filter(u => u.activation_paid === false && u.is_founder_subsidized === false).length;
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
