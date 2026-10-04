import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { orderIds, partnerId, role } = body;

    const supabase = getSupabaseAdmin();

    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const updatePayload: any = {};
      if (role === 'seller') {
        updatePayload.payout_seller_done = false;
      } else if (role === 'driver') {
        updatePayload.payout_driver_done = false;
      } else {
        updatePayload.payout_seller_done = false;
        updatePayload.payout_driver_done = false;
      }

      await supabase
        .from('orders')
        .update(updatePayload)
        .in('id', orderIds);
    }

    if (partnerId) {
      // Reabre pedidos do parceiro
      const isDriver = role === 'driver' || role === 'motorista';
      if (isDriver) {
        await supabase
          .from('orders')
          .update({ payout_driver_done: false })
          .or(`driver_id.eq.${partnerId},courier_id.eq.${partnerId}`);
      } else {
        await supabase
          .from('orders')
          .update({ payout_seller_done: false })
          .or(`seller_storefront_id.eq.${partnerId},loja_id.eq.${partnerId},fornecedor_id.eq.${partnerId},origem_id.eq.${partnerId}`);
      }

      // Reabre solicitações de saque pendentes ou marcadas como pagas sem transferência
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'PENDENTE',
          failure_reason: null,
          paid_at: null,
          asaas_transfer_id: null
        })
        .eq('partner_id', partnerId);
    }

    return NextResponse.json({
      success: true,
      message: 'Repasse reaberto com sucesso. O valor já voltou para a Carteira Digital do parceiro e para a fila de liquidação do painel admin.'
    });
  } catch (error: any) {
    console.error('Erro na rota /api/admin/payout/reopen:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao reabrir repasse' }, { status: 500 });
  }
}
