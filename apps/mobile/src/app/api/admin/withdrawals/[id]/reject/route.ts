import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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
    const body = await request.json();
    const { reason } = body;

    if (!id || !reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'O motivo da rejeição é obrigatório.' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();

    const { data: reqRow } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!reqRow) {
      return NextResponse.json({ error: 'Solicitação de saque não encontrada.' }, { status: 404 });
    }

    if (reqRow.status !== 'PENDENTE') {
      return NextResponse.json({ error: `Apenas solicitações com status PENDENTE podem ser rejeitadas. Status atual: ${reqRow.status}` }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { error: updErr } = await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'REJEITADO',
        rejection_reason: reason.trim(),
        reviewed_by: admin.id,
        reviewed_at: nowIso
      })
      .eq('id', id);

    if (updErr) {
      console.error('Erro ao rejeitar solicitação:', updErr);
      return NextResponse.json({ error: 'Erro ao atualizar o banco de dados.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitação de saque rejeitada com sucesso.'
    });
  } catch (err: any) {
    console.error('[API /api/admin/withdrawals/[id]/reject POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao rejeitar saque.' }, { status: 500 });
  }
}
