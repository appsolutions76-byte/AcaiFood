import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';
import { authorizeRequest } from '@/lib/apiAuth';

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

    const result = await processWithdrawalApproval(id, admin.id);

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
