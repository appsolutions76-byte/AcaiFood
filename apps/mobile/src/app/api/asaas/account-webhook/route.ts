import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidAsaasWebhook } from '@/lib/apiAuth';
import { saveAccountStatus, AsaasAccountStatusDetail } from '@/lib/asaasAccountStatus';

export const dynamic = 'force-dynamic';

// Webhook de "situação da conta" das subcontas Asaas (eventos ACCOUNT_STATUS_*).
// Payload: { id, event, dateCreated, account: { id }, accountStatus: { commercialInfo,
// bankAccountInfo, documentation, general } }.
// A conta só é aprovada quando accountStatus.general === 'APPROVED'; eventos parciais
// (ex.: ACCOUNT_STATUS_DOCUMENT_APPROVED) apenas atualizam o detalhe.
export async function POST(request: Request) {
  // Mesmo token do webhook de pagamentos (ASAAS_WEBHOOK_TOKEN). Sem token válido: 401.
  if (!isValidAsaasWebhook(request)) {
    return NextResponse.json({ error: 'Token de webhook não autorizado' }, { status: 401 });
  }

  try {
    const eventData = await request.json().catch(() => null);
    if (!eventData) {
      return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
    }

    const event = String(eventData.event || '').toUpperCase();
    const accountId = eventData.account?.id ? String(eventData.account.id) : '';
    const detail: AsaasAccountStatusDetail | undefined = eventData.accountStatus;

    if (!event.startsWith('ACCOUNT_STATUS_')) {
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }

    if (!accountId || !detail) {
      console.warn(`[Asaas Account Webhook] ${event} sem account.id ou accountStatus`);
      return NextResponse.json({ success: true, message: 'Evento sem dados de conta (ignorado)' });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('asaas_account_id', accountId)
      .maybeSingle();

    if (!user) {
      console.warn(`[Asaas Account Webhook] ${event}: subconta sem usuário vinculado`);
      return NextResponse.json({ success: true, message: 'Conta de usuário não encontrada' });
    }

    const result = await saveAccountStatus(user.id, detail, `webhook:${event}`);
    console.log(`[Asaas Account Webhook] ${event} → status ${result.status || 'inalterado'}`);

    return NextResponse.json({ success: true, status: result.status || 'UNCHANGED' });

  } catch (error: any) {
    console.error('[Asaas Account Webhook] Erro ao processar evento:', error?.message);
    // 500 faz o Asaas reenviar o evento
    return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
  }
}
