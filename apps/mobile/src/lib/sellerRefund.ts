import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRootCtx, type AsaasCtx } from '@/lib/paymentAccount';
import { findTransferByExternalRef, describeAsaasError } from '@/lib/asaasTransferLookup';

/**
 * Estorno de cobrança emitida na subconta da loja (modelo SELLER_SPLIT).
 *
 * Problema (R23): um POST /payments/{id}/refund sem `splitRefunds` cobra o valor TOTAL da
 * subconta da loja. A loja só recebeu (valor − tarifa Pix − comissão do split), então o Asaas
 * respondia "Saldo insuficiente." e o cliente ficava sem o estorno.
 *
 * Correção:
 * 1. `splitRefunds`: a comissão já repassada à conta raiz volta a partir da própria raiz
 *    (o Asaas debita cada participante do split pelo valor indicado; o restante sai da loja).
 * 2. A tarifa Pix não é devolvida pelo Asaas no estorno. Se faltar só essa diferença na loja,
 *    a conta raiz cobre (transferência interna, limitada à tarifa Pix do pedido), com
 *    externalReference REFUNDFEE_<pedido> para nunca cobrir duas vezes.
 */

const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SellerRefundResult {
  ok: boolean;
  httpStatus: number;
  data: any;
  error?: string;
  refundedValue: number;
  splitRefunded: number;
  feeCovered: number;
}

async function getBalance(ctx: AsaasCtx): Promise<number | null> {
  try {
    const res = await fetch(`${ctx.baseUrl}/finance/balance`, {
      headers: { access_token: ctx.apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b = Number(data?.balance);
    return Number.isFinite(b) ? b : null;
  } catch (_e) {
    return null;
  }
}

/** Splits já efetivados da cobrança, para devolver a partir de quem os recebeu. */
export function buildSplitRefunds(payObj: any): { splitRefunds: { id: string; value: number }[]; splitSum: number } {
  const list: any[] = Array.isArray(payObj?.split) ? payObj.split : [];
  const splitRefunds = list
    .filter((s) => s?.id && String(s?.status || '').toUpperCase() === 'DONE')
    .map((s) => ({ id: String(s.id), value: round2(Number(s.totalValue ?? s.fixedValue ?? 0)) }))
    .filter((s) => s.value > 0);
  const splitSum = round2(splitRefunds.reduce((acc, s) => acc + s.value, 0));
  return { splitRefunds, splitSum };
}

/**
 * Cobre, a partir da conta raiz, a diferença que falta na loja para o estorno — no máximo `feeCap`
 * (a tarifa Pix do pedido). Idempotente por externalReference.
 */
async function coverFeeShortfall(params: {
  orderId: string;
  sellerCtx: AsaasCtx;
  issuerPartnerId: string;
  needFromSeller: number;
  feeCap: number;
}): Promise<number> {
  const { orderId, sellerCtx, issuerPartnerId, needFromSeller, feeCap } = params;
  const balance = await getBalance(sellerCtx);
  if (balance === null) return 0;
  const shortfall = round2(needFromSeller - balance);
  if (shortfall <= 0) return 0;
  if (shortfall > round2(feeCap) + 0.01) {
    console.warn(`[SellerRefund] Loja sem saldo para o estorno do pedido ${orderId}: faltam R$ ${shortfall.toFixed(2)} (acima da tarifa Pix).`);
    return 0;
  }

  const root = await getRootCtx();
  if (!root) return 0;
  const { data: seller } = await getSupabaseAdmin()
    .from('users')
    .select('asaas_wallet_id')
    .eq('id', issuerPartnerId)
    .maybeSingle();
  const walletId = String(seller?.asaas_wallet_id || '').trim();
  if (!walletId) return 0;

  const ref = `REFUNDFEE_${orderId}`;
  const existing = await findTransferByExternalRef(root.baseUrl, root.apiKey, ref);
  if (existing.ok && existing.transfer) {
    return 0; // já coberto antes; não transferir de novo
  }

  try {
    const res = await fetch(`${root.baseUrl}/transfers`, {
      method: 'POST',
      headers: { access_token: root.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: shortfall,
        walletId,
        externalReference: ref,
        description: `AçaíFood: cobertura da tarifa Pix para estorno do pedido #${orderId.substring(0, 8)}`
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.errors) {
      console.warn('[SellerRefund] Falha ao cobrir tarifa do estorno:', describeAsaasError(data, res.status));
      return 0;
    }
  } catch (err) {
    console.warn('[SellerRefund] Erro de rede ao cobrir tarifa do estorno:', err);
    return 0;
  }

  // Transferência interna costuma cair na hora; aguarda o saldo aparecer na loja
  for (let i = 0; i < 4; i++) {
    await sleep(1000);
    const b = await getBalance(sellerCtx);
    if (b !== null && b >= needFromSeller - 0.001) break;
  }
  return shortfall;
}

/**
 * Executa o estorno integral de uma cobrança paga emitida na subconta da loja.
 */
export async function refundSellerSplitPayment(params: {
  order: any;
  paymentId: string;
  sellerCtx: AsaasCtx;
  issuerPartnerId: string;
  description: string;
}): Promise<SellerRefundResult> {
  const { order, paymentId, sellerCtx, issuerPartnerId, description } = params;
  const orderId = String(order?.id || '');

  let payObj: any = null;
  try {
    const payRes = await fetch(`${sellerCtx.baseUrl}/payments/${paymentId}`, {
      headers: { access_token: sellerCtx.apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    payObj = await payRes.json().catch(() => null);
  } catch (_e) {}

  const value = round2(Number(payObj?.value || order?.charged_amount || 0));
  const { splitRefunds, splitSum } = buildSplitRefunds(payObj);
  const needFromSeller = round2(value - splitSum);
  const feeCap = Number(order?.pricing_snapshot?.asaasPixFeeFixed ?? 0.99);

  let feeCovered = 0;
  if (orderId && issuerPartnerId && value > 0) {
    feeCovered = await coverFeeShortfall({ orderId, sellerCtx, issuerPartnerId, needFromSeller, feeCap });
  }

  const body: any = { description };
  if (splitRefunds.length > 0 && value > 0) {
    body.value = value;
    body.splitRefunds = splitRefunds;
  }
  // Sem split efetivado: estorno integral sem "value" (comportamento anterior)

  const res = await fetch(`${sellerCtx.baseUrl}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { access_token: sellerCtx.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && !data?.errors;
  return {
    ok,
    httpStatus: res.status,
    data,
    error: ok ? undefined : describeAsaasError(data, res.status),
    refundedValue: value,
    splitRefunded: splitSum,
    feeCovered
  };
}
