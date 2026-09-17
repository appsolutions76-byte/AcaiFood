import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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

export async function GET(request: Request) {
  try {
    const admin = await authorizeAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso não autorizado. Apenas administradores podem acessar.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDENTE';

    const adminSupabase = getSupabaseAdmin();

    let query = adminSupabase
      .from('withdrawal_requests')
      .select('*, partner:partner_id(id, name, email, phone, role, pix_key, cpf_cnpj, asaas_wallet_id)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Erro ao listar solicitações de saque:', error);
      return NextResponse.json({ error: 'Erro ao buscar solicitações no banco.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requests: requests || []
    });
  } catch (err: any) {
    console.error('[API /api/admin/withdrawals GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao listar saques.' }, { status: 500 });
  }
}
