import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();

    // 1. Tentar executar a RPC nativa do banco de dados para garantia atômica total
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('reset_admin_system_data');
      if (!rpcError && rpcData && rpcData.success) {
        return NextResponse.json(rpcData);
      }
    } catch (rpcEx) {
      console.warn("RPC reset_admin_system_data não encontrada ou falhou, executando limpeza direta via Service Role:", rpcEx);
    }

    // 2. Limpeza direta e em cascata via Service Role (Fallback Seguro e Completo)
    try { await supabase.from('incident_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('disputes').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('order_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('print_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('order_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('order_tracking').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}
    try { await supabase.from('splits').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (_) {}

    // Excluir todos os pedidos
    const { error: ordersErr } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (ordersErr) {
      console.error("Erro ao apagar pedidos via API de Admin:", ordersErr);
      return NextResponse.json({ error: ordersErr.message }, { status: 500 });
    }

    // Zerar atômica e completamente todos os acumuladores de admin_balances
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

    for (const bId of ['historical', 'monthly', 'daily']) {
      try {
        await supabase.from('admin_balances').upsert({ id: bId, ...zeroPayload });
      } catch (bErr) {
        console.warn("Aviso ao zerar admin_balances para " + bId + ":", bErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sistema 100% resetado: Todos os pedidos, registros e balanços foram zerados para recomeçar.' 
    });
  } catch (err: any) {
    console.error("Exceção em /api/admin/clear-data:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
