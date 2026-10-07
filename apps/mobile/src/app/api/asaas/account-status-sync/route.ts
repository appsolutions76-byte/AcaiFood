import { NextResponse } from 'next/server';
import { authorizeRequest, isAuthorizedRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAndSaveAccountStatus } from '@/lib/asaasAccountStatus';

export const dynamic = 'force-dynamic';

// Reserva do webhook de situação da conta: consulta GET /v3/myAccount/status
// de cada subconta ainda não aprovada e grava o resultado.
// - GET  (cron da Vercel, Bearer CRON_SECRET): todas as subcontas pendentes
// - POST { userId }: o próprio parceiro (botão "Reconsultar") ou o admin
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized) return unauthorizedResponse(auth.error);
  }

  const supabase = getSupabaseAdmin();
  const { data: pending, error } = await supabase
    .from('users')
    .select('id')
    .not('asaas_account_id', 'is', null)
    .or('asaas_account_status.is.null,asaas_account_status.neq.APPROVED')
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Erro ao listar subcontas pendentes' }, { status: 500 });
  }

  const results: Record<string, number> = {};
  for (const row of pending || []) {
    const r = await fetchAndSaveAccountStatus(row.id, 'cron:account-status-sync');
    const key = r.status || (r.error ? 'ERRO' : 'SEM_STATUS');
    results[key] = (results[key] || 0) + 1;
  }

  return NextResponse.json({ success: true, checked: (pending || []).length, results });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const callerId = auth.user?.id || auth.profile?.id;
  const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin' || auth.profile?.is_admin === true;
  const targetUserId = String(body?.userId || callerId || '');

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
  }
  if (!isAdmin && targetUserId !== callerId) {
    return NextResponse.json({ error: 'Você só pode consultar a sua própria conta.' }, { status: 403 });
  }

  const r = await fetchAndSaveAccountStatus(targetUserId, isAdmin ? 'admin:reconsultar' : 'parceiro:reconsultar');
  if (r.error && !r.status) {
    return NextResponse.json({ success: false, error: r.error }, { status: 200 });
  }
  return NextResponse.json({ success: true, status: r.status, detail: r.detail || null });
}
