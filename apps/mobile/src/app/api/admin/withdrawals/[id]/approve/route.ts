import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';

export const dynamic = 'force-dynamic';

async function authorizeAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const adminSupabase = getSupabaseAdmin();
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: dbUser } = await adminSupabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!dbUser || String(dbUser.role).toUpperCase() !== 'ADMIN') {
    return null;
  }

  return dbUser;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authorizeAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

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
