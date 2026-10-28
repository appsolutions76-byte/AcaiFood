import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// R34: parceiros com saque suspenso por troca de chave Pix / CPF / CNPJ, e liberação pelo admin.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, name, email, phone, role, pix_key, pix_key_type, cpf_cnpj, payout_hold_reason, payout_hold_at')
    .eq('payout_hold', true)
    .order('payout_hold_at', { ascending: false });
  if (error) return NextResponse.json({ success: true, holds: [], tableReady: false });
  return NextResponse.json({ success: true, holds: data || [], tableReady: true });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const userId = String(body?.userId || '');
  const note = String(body?.note || '').trim().slice(0, 300);
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'Parceiro inválido.' }, { status: 400 });
  if (note.length < 5) {
    return NextResponse.json({ error: 'Informe como a troca foi confirmada (ex.: "e-mail do parceiro em 28/10").' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase
    .from('users')
    .select('id, name, pix_key, pix_key_type, cpf_cnpj, payout_hold, payout_hold_reason, payout_hold_at')
    .eq('id', userId)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 });
  if (before.payout_hold !== true) return NextResponse.json({ success: true, message: 'Os saques deste parceiro já estavam liberados.' });

  const actorId = auth.user?.id || auth.profile?.id || null;
  const { error } = await supabase
    .from('users')
    .update({
      payout_hold: false,
      payout_hold_released_at: new Date().toISOString(),
      payout_hold_released_by: actorId,
      payout_hold_release_note: note
    })
    .eq('id', userId);
  if (error) return NextResponse.json({ error: 'Não foi possível liberar agora.' }, { status: 500 });

  await logAdminAction({
    actorId,
    action: 'PAYOUT_HOLD_RELEASED',
    targetType: 'USER',
    targetId: userId,
    beforeState: before,
    afterState: { payout_hold: false, note },
    request
  });

  return NextResponse.json({ success: true, message: `Saques de ${before.name || 'parceiro'} liberados.` });
}
