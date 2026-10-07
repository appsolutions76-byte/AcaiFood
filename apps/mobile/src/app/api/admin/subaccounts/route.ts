import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

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

// Situação manual da subconta (admin com MFA), para subcontas antigas cuja chave
// não foi guardada e que o app não consegue consultar no Asaas.
// O admin confere no painel do Asaas (Subcontas) e registra aqui, com justificativa.
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const userId = String(body?.userId || '');
  const action = String(body?.action || '');
  const note = String(body?.note || '').trim().slice(0, 300);

  if (!userId || !['mark_approved', 'mark_pending'].includes(action)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }
  if (note.length < 10) {
    return NextResponse.json({ error: 'Escreva como conferiu no Asaas (mínimo 10 caracteres).' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('id, asaas_account_id, asaas_wallet_id, asaas_account_status')
    .eq('id', userId)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  if (action === 'mark_approved' && (!user.asaas_account_id || !user.asaas_wallet_id)) {
    return NextResponse.json({ error: 'Parceiro sem subconta/walletId: não pode ser marcado como aprovado.' }, { status: 400 });
  }

  const newStatus = action === 'mark_approved' ? 'APPROVED' : 'AWAITING_APPROVAL';
  const { error } = await supabase
    .from('users')
    .update({ asaas_account_status: newStatus, split_enabled: newStatus === 'APPROVED' })
    .eq('id', userId);
  if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: action === 'mark_approved' ? 'ASAAS_ACCOUNT_MARKED_APPROVED' : 'ASAAS_ACCOUNT_MARKED_PENDING',
    targetType: 'USER',
    targetId: userId,
    beforeState: { status: user.asaas_account_status },
    afterState: { status: newStatus, note },
    request
  });

  return NextResponse.json({ success: true, status: newStatus });
}
