import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getOrderPaymentCtx, type AsaasCtx } from '@/lib/paymentAccount';

/**
 * Registro do estorno (R28): lê no Asaas os estornos da cobrança (GET /payments/{id}/refunds)
 * e grava no pedido e no histórico o valor, a data, o código Pix (endToEndIdentifier) e o link
 * do comprovante. Chamado depois do POST de estorno e quando chega o webhook PAYMENT_REFUNDED.
 * Idempotente: pode ser chamado quantas vezes for preciso.
 */

const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/** Datas do Asaas vêm como "AAAA-MM-DD HH:mm:ss" no horário de Brasília. */
function asaasDateToIso(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(s.replace(' ', 'T') + (s.length === 16 ? ':00' : '') + '-03:00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T12:00:00-03:00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export interface RefundSyncResult {
  state: 'NONE' | 'IN_PROGRESS' | 'DONE' | 'ERROR';
  refundedValue: number;
  receiptUrl: string | null;
  endToEndId: string | null;
  refundedAt: string | null;
  error?: string;
}

export async function syncOrderRefund(
  order: { id: string; pricing_snapshot?: any; asaas_payment_id?: string | null },
  opts?: { ctx?: AsaasCtx | null; paymentId?: string | null }
): Promise<RefundSyncResult> {
  const empty: RefundSyncResult = { state: 'NONE', refundedValue: 0, receiptUrl: null, endToEndId: null, refundedAt: null };
  const paymentId = String(opts?.paymentId || order?.asaas_payment_id || '').trim();
  if (!order?.id || !paymentId) return empty;

  const ctx = opts?.ctx || (await getOrderPaymentCtx(order));
  if (!ctx) return { ...empty, state: 'ERROR', error: 'Conta Asaas da cobrança não encontrada' };

  let list: any[] = [];
  try {
    const res = await fetch(`${ctx.baseUrl}/payments/${paymentId}/refunds`, {
      headers: { access_token: ctx.apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ...empty, state: 'ERROR', error: `Asaas HTTP ${res.status}` };
    list = Array.isArray(data?.data) ? data.data : [];
  } catch (e: any) {
    return { ...empty, state: 'ERROR', error: e?.message || 'Falha de rede' };
  }

  const valid = list.filter((r) => !['CANCELLED', 'CANCELED', 'FAILED'].includes(String(r?.status || '').toUpperCase()));
  if (valid.length === 0) return empty;

  const done = valid.filter((r) => String(r?.status || '').toUpperCase() === 'DONE');
  const pick = (done.length ? done : valid)
    .slice()
    .sort((a, b) => String(b?.effectiveDate || b?.dateCreated || '').localeCompare(String(a?.effectiveDate || a?.dateCreated || '')))[0];

  const refundedValue = round2((done.length ? done : valid).reduce((acc, r) => acc + Number(r?.value || 0), 0));
  const receiptUrl = pick?.transactionReceiptUrl ? String(pick.transactionReceiptUrl) : null;
  const endToEndId = pick?.endToEndIdentifier ? String(pick.endToEndIdentifier) : null;
  const refundedAt = asaasDateToIso(pick?.effectiveDate || pick?.dateCreated);
  const state: RefundSyncResult['state'] = done.length ? 'DONE' : 'IN_PROGRESS';

  const supabase = getSupabaseAdmin();

  // 1. Pedido
  const base: any = {
    asaas_refund_status: state === 'DONE' ? 'REFUNDED' : 'REFUND_IN_PROGRESS',
    asaas_refund_id: endToEndId
  };
  if (state === 'DONE') {
    base.status = 'REFUNDED';
    base.asaas_charge_status = 'REFUNDED';
  }
  const full = { ...base, refund_value: refundedValue, refunded_at: refundedAt, refund_receipt_url: receiptUrl, refund_e2e_id: endToEndId };
  const { error: upErr } = await supabase.from('orders').update(full).eq('id', order.id);
  if (upErr) {
    // Migration R28 ainda não aplicada: grava só o que já existe
    await supabase.from('orders').update(base).eq('id', order.id);
  }

  // 2. Histórico de estornos (uma linha por estorno do Asaas)
  try {
    const { data: rows } = await supabase.from('refund_history').select('*').eq('payment_id', paymentId);
    const existing: any[] = rows || [];
    for (const r of valid) {
      const e2e = r?.endToEndIdentifier ? String(r.endToEndIdentifier) : null;
      const rStatus = String(r?.status || '').toUpperCase() || 'PENDING';
      const extra = {
        end_to_end_id: e2e,
        receipt_url: r?.transactionReceiptUrl || null,
        refunded_at: asaasDateToIso(r?.effectiveDate || r?.dateCreated)
      };
      const match =
        existing.find((x) => e2e && (x.end_to_end_id === e2e || x.asaas_refund_id === e2e)) ||
        existing.find((x) => !x.end_to_end_id && !x._used && Math.abs(Number(x.requested_value || 0) - Number(r?.value || 0)) < 0.01);
      if (match) {
        match._used = true;
        const upd: any = { status: rStatus, asaas_refund_id: e2e || match.asaas_refund_id };
        const { error } = await supabase.from('refund_history').update({ ...upd, ...extra }).eq('id', match.id);
        if (error) await supabase.from('refund_history').update(upd).eq('id', match.id);
      } else if (Number(r?.value || 0) > 0) {
        const ins: any = { order_id: order.id, payment_id: paymentId, requested_value: round2(Number(r.value)), asaas_refund_id: e2e, status: rStatus, requested_by: null };
        const { error } = await supabase.from('refund_history').insert({ ...ins, ...extra });
        if (error) await supabase.from('refund_history').insert(ins);
      }
    }
  } catch (hisErr) {
    console.warn('[refundRecord] Aviso ao registrar histórico de estorno:', hisErr);
  }

  return { state, refundedValue, receiptUrl, endToEndId, refundedAt };
}
