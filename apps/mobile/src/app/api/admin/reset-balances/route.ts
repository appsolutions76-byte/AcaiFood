import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const targetPeriod = body.period || 'all'; // 'historical' | 'monthly' | 'daily' | 'all'

    const targetIds = targetPeriod === 'all' 
      ? ['historical', 'monthly', 'daily'] 
      : [targetPeriod];

    const { error: balancesErr } = await supabase.from('admin_balances').update({
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
    }).in('id', targetIds);

    if (balancesErr) {
      console.error("Erro ao zerar admin_balances:", balancesErr);
      return NextResponse.json({ error: balancesErr.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Balanço (${targetPeriod}) zerado com sucesso via Service Role.` 
    });
  } catch (err: any) {
    console.error("Exceção em /api/admin/reset-balances:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
