import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function maskDoc(doc: string | null | undefined): string {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return d ? '***' : '';
}

// Lista de subcontas Asaas dos parceiros (admin com MFA). CPF/CNPJ mascarado.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, cpf_cnpj, asaas_account_id, asaas_wallet_id, asaas_account_status, asaas_account_status_detail, created_at')
    .not('asaas_account_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar subcontas' }, { status: 500 });
  }

  const { data: secrets } = await supabase.from('partner_secrets').select('user_id');
  const withKey = new Set((secrets || []).map((s: any) => s.user_id));

  const rows = (data || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    document: maskDoc(u.cpf_cnpj),
    accountId: u.asaas_account_id,
    hasWallet: Boolean(u.asaas_wallet_id),
    hasApiKey: withKey.has(u.id),
    status: u.asaas_account_status || 'PENDING_DOCUMENTS',
    detail: u.asaas_account_status_detail || null,
    createdAt: u.created_at
  }));

  return NextResponse.json({ success: true, subaccounts: rows });
}
