import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const targetPeriod = body.period || 'all'; // 'historical' | 'monthly' | 'daily' | 'all'

    if (!['historical', 'monthly', 'daily', 'all'].includes(targetPeriod)) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }

    const targetIds = targetPeriod === 'all' 
      ? ['historical', 'monthly', 'daily'] 
      : [targetPeriod];

    const zeroPayload = {
      total_orders: 0,
      total_volume: 0,
      app_revenue: 0,
      fornecedores_bruto: 0,
      fornecedores_liquido: 0,
      batedeiras_bruto: 0,
      batedeiras_liquido: 0,
      motoristas_bruto: 0,
      motoristas_liquido: 0,
      caminhoes_bruto: 0,
      caminhoes_liquido: 0,
      updated_at: new Date().toISOString()
    };

    const { data: before } = await supabase.from('admin_balances').select('*').in('id', targetIds);

    for (const bId of targetIds) {
      await supabase.from('admin_balances').upsert({ id: bId, ...zeroPayload });
    }

    await logAdminAction({
      actorId: auth.user?.id || auth.profile?.id || null,
      action: 'ADMIN_BALANCES_RESET',
      targetType: 'ADMIN_BALANCES',
      targetId: targetPeriod,
      beforeState: before || null,
      afterState: { zeroed: targetIds },
      request
    });

    return NextResponse.json({ 
      success: true, 
      message: `Balanço (${targetPeriod}) zerado com sucesso via Service Role.` 
    });
  } catch (err: any) {
    console.error("Exceção em /api/admin/reset-balances:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
