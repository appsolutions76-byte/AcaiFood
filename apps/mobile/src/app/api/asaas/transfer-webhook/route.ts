import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidAsaasWebhook } from '@/lib/apiAuth';
import { reconcileWithdrawal } from '@/lib/withdrawalApproval';
import { reconcileSettlement } from '@/lib/orderSettlements';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Webhook de transferências do Asaas (eventos TRANSFER_*).
 *
 * O conteúdo do evento serve só como aviso: o estado real é sempre conferido na API do Asaas
 * (reconcileWithdrawal / reconcileSettlement). Este webhook NUNCA envia Pix nem transferência.
 * - Saque do parceiro: externalReference WD_<id da solicitação> (ou asaas_transfer_id gravado).
 * - Repasse Master → subconta: externalReference = id da linha em settlements.
 */
export async function POST(request: Request) {
  if (!isValidAsaasWebhook(request)) {
    return NextResponse.json({ error: 'Token de webhook não autorizado' }, { status: 401 });
  }

  try {
    const eventData = await request.json().catch(() => null);
    if (!eventData) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const event = String(eventData.event || '').toUpperCase();
    if (!event.startsWith('TRANSFER_')) {
      return NextResponse.json({ success: true, message: 'Evento ignorado (não é de transferência)' });
    }

    const transfer = eventData.transfer || {};
    const transferId = transfer?.id ? String(transfer.id) : '';
    const externalRef = transfer?.externalReference ? String(transfer.externalReference) : '';
    const adminSupabase = getSupabaseAdmin();

    // 1. Saque (Pix da subconta)
    let withdrawalId: string | null = null;
    if (externalRef.startsWith('WD_') && UUID_RE.test(externalRef.slice(3))) {
      withdrawalId = externalRef.slice(3);
    } else if (transferId) {
      const { data } = await adminSupabase
        .from('withdrawal_requests')
        .select('id')
        .eq('asaas_transfer_id', transferId)
        .limit(1);
      withdrawalId = data && data.length > 0 ? data[0].id : null;
    }

    if (withdrawalId) {
      const result = await reconcileWithdrawal(withdrawalId);
      return NextResponse.json({ success: true, kind: 'withdrawal', event, result });
    }

    // 2. Repasse Master → subconta
    let settlementId: string | null = null;
    if (UUID_RE.test(externalRef)) {
      const { data } = await adminSupabase.from('settlements').select('id').eq('id', externalRef).maybeSingle();
      settlementId = data?.id || null;
    }
    if (!settlementId && transferId) {
      const { data } = await adminSupabase.from('settlements').select('id').eq('asaas_transfer_id', transferId).maybeSingle();
      settlementId = data?.id || null;
    }

    if (settlementId) {
      const result = await reconcileSettlement(settlementId);
      return NextResponse.json({ success: true, kind: 'settlement', event, result });
    }

    return NextResponse.json({ success: true, message: 'Transferência sem saque ou repasse vinculado (ignorada)' });
  } catch (err: any) {
    console.error('[Asaas Transfer Webhook] Erro ao processar:', err?.message || err);
    return NextResponse.json({ error: 'Erro interno ao processar webhook' }, { status: 500 });
  }
}
