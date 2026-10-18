import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidAsaasWebhook } from '@/lib/apiAuth';
import { executeSubaccountPixPayout } from '@/lib/withdrawalApproval';

export const dynamic = 'force-dynamic';

/**
 * Webhook de Transferências do Asaas (Eventos TRANSFER_*).
 * Utilizado para a liquidação assíncrona do Tempo 2 (Opção 2 - Asaas BaaS):
 * Quando o Asaas notifica TRANSFER_DONE da conta Master para a Subconta,
 * este webhook executa a transferência Pix da Subconta para a conta bancária do parceiro.
 */
export async function POST(request: Request) {
  // Autenticação pelo token configurado em ASAAS_WEBHOOK_TOKEN
  if (!isValidAsaasWebhook(request)) {
    return NextResponse.json({ error: 'Token de webhook não autorizado' }, { status: 401 });
  }

  try {
    const eventData = await request.json().catch(() => null);
    if (!eventData) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const event = String(eventData.event || '').toUpperCase();
    const transfer = eventData.transfer;
    const transferId = transfer?.id ? String(transfer.id) : '';
    const externalRef = transfer?.externalReference ? String(transfer.externalReference) : '';

    console.log(`[Asaas Transfer Webhook] Recebido evento ${event} | Transfer ID: ${transferId} | Ref: ${externalRef}`);

    if (!event.startsWith('TRANSFER_')) {
      return NextResponse.json({ success: true, message: 'Evento ignorado (não é de transferência)' });
    }

    if (!transferId && !externalRef) {
      return NextResponse.json({ success: true, message: 'Evento sem identificador de transferência (ignorado)' });
    }

    const adminSupabase = getSupabaseAdmin();

    // Localizar solicitação de saque vinculada a esta transferência
    let query = adminSupabase
      .from('withdrawal_requests')
      .select('id, status, asaas_transfer_id, transfer_attempt_id, partner_id, requested_amount');

    if (transferId) {
      query = query.or(`asaas_transfer_id.eq.${transferId},transfer_attempt_id.eq.${externalRef}`);
    } else {
      query = query.eq('transfer_attempt_id', externalRef);
    }

    const { data: matchedRows } = await query.limit(1);
    const withdrawalRow = matchedRows && matchedRows.length > 0 ? matchedRows[0] : null;

    if (!withdrawalRow) {
      console.log(`[Asaas Transfer Webhook] Nenhuma solicitação encontrada para Transfer ${transferId} / Ref ${externalRef}`);
      return NextResponse.json({ success: true, message: 'Solicitação de saque não encontrada para esta transferência' });
    }

    // 1. Evento de Liquidação Concluída: TRANSFER_DONE / TRANSFER_CONFIRMED
    if (['TRANSFER_DONE', 'TRANSFER_CONFIRMED', 'TRANSFER_COMPLETED'].includes(event)) {
      if (withdrawalRow.status === 'PROCESSING') {
        console.log(`[Asaas Transfer Webhook] Transferência interna concluída para saque #${withdrawalRow.id}. Disparando Tempo 2 (Pix da subconta)...`);
        const pixResult = await executeSubaccountPixPayout(withdrawalRow.id);
        console.log(`[Asaas Transfer Webhook] Resultado do Tempo 2 para #${withdrawalRow.id}:`, pixResult);
        return NextResponse.json({
          success: true,
          action: 'PIX_DISPATCHED',
          result: pixResult
        });
      }

      return NextResponse.json({
        success: true,
        message: `Solicitação #${withdrawalRow.id} já estava com status ${withdrawalRow.status}`
      });
    }

    // 2. Evento de Falha ou Cancelamento: TRANSFER_FAILED / TRANSFER_CANCELLED / TRANSFER_BLOCKED
    if (['TRANSFER_FAILED', 'TRANSFER_CANCELLED', 'TRANSFER_BLOCKED'].includes(event)) {
      const failReason = transfer?.failReason || transfer?.description || `Transferência ${event.toLowerCase()} no Asaas`;
      await adminSupabase
        .from('withdrawal_requests')
        .update({
          status: 'FALHOU',
          failure_reason: failReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', withdrawalRow.id);

      console.warn(`[Asaas Transfer Webhook] Saque #${withdrawalRow.id} marcado como FALHOU: ${failReason}`);
      return NextResponse.json({
        success: true,
        action: 'MARKED_FAILED',
        reason: failReason
      });
    }

    return NextResponse.json({ success: true, message: `Evento ${event} recebido e registrado.` });

  } catch (err: any) {
    console.error('[Asaas Transfer Webhook] Erro ao processar:', err?.message || err);
    return NextResponse.json({ error: 'Erro interno ao processar webhook' }, { status: 500 });
  }
}
