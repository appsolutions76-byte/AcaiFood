import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { orderIds, role, partnerId } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Lista de orderIds é obrigatória' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const updatePayload: any = role === 'seller' ? { payout_seller_done: true } : { payout_driver_done: true };

    const { error: ordErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .in('id', orderIds);

    if (ordErr) {
      return NextResponse.json({ error: ordErr.message }, { status: 500 });
    }

    if (partnerId) {
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'PAGO',
          failure_reason: null,
          paid_at: new Date().toISOString()
        })
        .in('status', ['PENDENTE', 'APROVADO', 'FALHOU'])
        .eq('partner_id', partnerId);
    }

    return NextResponse.json({ success: true, count: orderIds.length });
  } catch (error: any) {
    console.error('Erro na rota /api/admin/payout/mark-done:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
