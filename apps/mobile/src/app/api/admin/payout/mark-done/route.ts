import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const adminId: string | null = auth.user?.id || auth.profile?.id || null;

  try {
    const body = await request.json();
    const { orderIds, role, partnerId } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Lista de orderIds é obrigatória' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const payoutField = role === 'seller' ? 'payout_seller_done' : 'payout_driver_done';
    const updatePayload = { [payoutField]: true };

    // Estado anterior (para o log de auditoria)
    const { data: ordersBefore } = await supabase
      .from('orders')
      .select(`id, ${payoutField}`)
      .in('id', orderIds);

    const withdrawalsBefore = partnerId
      ? (await supabase
          .from('withdrawal_requests')
          .select('id, status, requested_amount')
          .in('status', ['PENDENTE', 'APROVADO', 'FALHOU'])
          .eq('partner_id', partnerId)).data || []
      : [];

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

    await logAdminAction({
      actorId: adminId,
      action: 'PAYOUT_MARK_DONE',
      targetType: partnerId ? 'PARTNER' : 'ORDERS',
      targetId: partnerId ? String(partnerId) : undefined,
      beforeState: {
        field: payoutField,
        orders: ordersBefore || [],
        withdrawals: withdrawalsBefore
      },
      afterState: {
        field: payoutField,
        orderIds,
        value: true,
        withdrawalsMarkedPaid: withdrawalsBefore.map((w: { id: string }) => w.id)
      },
      request
    });

    return NextResponse.json({ success: true, count: orderIds.length });
  } catch (error: any) {
    console.error('Erro na rota /api/admin/payout/mark-done:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
