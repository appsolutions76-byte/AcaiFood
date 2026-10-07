import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';
import { authorizeRequest } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const admin = auth.profile;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID da solicitação de saque é obrigatório.' }, { status: 400 });
    }

    // Estado anterior apenas para o log (a aprovação em si é toda de processWithdrawalApproval)
    const { data: before } = await getSupabaseAdmin()
      .from('withdrawal_requests')
      .select('id, partner_id, status, requested_amount')
      .eq('id', id)
      .maybeSingle();

    const result = await processWithdrawalApproval(id, admin.id);

    await logAdminAction({
      actorId: admin.id,
      action: 'WITHDRAWAL_APPROVE',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: id,
      beforeState: before
        ? { status: before.status, requested_amount: before.requested_amount, partner_id: before.partner_id }
        : null,
      afterState: {
        status: result.status,
        success: result.success,
        amount: result.amount ?? null,
        transferId: result.transferId ?? null,
        error: result.error ?? null
      },
      request
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Falha ao aprovar e transferir o saque.',
        status: result.status
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      transferId: result.transferId,
      amount: result.amount
    });
  } catch (err: any) {
    console.error('[API /api/admin/withdrawals/[id]/approve POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao aprovar saque.' }, { status: 500 });
  }
}
