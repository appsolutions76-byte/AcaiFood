import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { getPlatformConfig } from '@/lib/platformConfig';

/**
 * Modelo de pagamento (docs/25):
 * - ROOT (antigo): a cobrança Pix é emitida pela conta raiz e os repasses saem dela depois do PIN.
 * - SELLER_SPLIT (novo): a cobrança é emitida na SUBCONTA DA LOJA, com split só da comissão
 *   para a conta raiz. A loja recebe venda + frete; depois do PIN o app transfere a corrida
 *   da subconta da loja para a subconta da moto. A plataforma não guarda dinheiro de terceiros.
 *
 * O modelo vale por pedido: cada pedido grava em pricing_snapshot.paymentModel o modelo com que
 * foi cobrado, e todas as operações seguintes (consulta, estorno, corrida) usam a conta certa.
 */
export type PaymentModel = 'ROOT' | 'SELLER_SPLIT';

export interface AsaasCtx {
  apiKey: string;
  baseUrl: string;
}

export interface OrderPaymentCtx extends AsaasCtx {
  model: PaymentModel;
  issuerPartnerId: string | null;
}

export async function getPaymentModel(): Promise<PaymentModel> {
  try {
    const cfg = await getPlatformConfig<{ model?: string }>('payment_model');
    const v = String(cfg?.model || '').toUpperCase();
    if (v === 'SELLER_SPLIT' || v === 'ROOT') return v as PaymentModel;
  } catch (_e) {}
  const env = String(process.env.PAYMENT_MODEL || '').toUpperCase();
  return env === 'SELLER_SPLIT' ? 'SELLER_SPLIT' : 'ROOT';
}

export async function getRootCtx(): Promise<AsaasCtx | null> {
  const apiKey = await getAsaasApiKey();
  if (!apiKey) return null;
  return { apiKey, baseUrl: getAsaasBaseUrl(apiKey) };
}

export async function getPartnerCtx(partnerId: string): Promise<AsaasCtx | null> {
  if (!partnerId) return null;
  const { data } = await getSupabaseAdmin()
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', partnerId)
    .maybeSingle();
  const apiKey = String(data?.asaas_account_api_key || '').trim();
  if (!apiKey) return null;
  return { apiKey, baseUrl: getAsaasBaseUrl(apiKey) };
}

export function snapshotModel(order: any): { model: PaymentModel; issuerPartnerId: string | null } {
  const snap = order?.pricing_snapshot || {};
  if (String(snap.paymentModel || '').toUpperCase() === 'SELLER_SPLIT' && snap.issuerPartnerId) {
    return { model: 'SELLER_SPLIT', issuerPartnerId: String(snap.issuerPartnerId) };
  }
  return { model: 'ROOT', issuerPartnerId: null };
}

/**
 * Conta Asaas que emitiu a cobrança do pedido (raiz ou subconta da loja).
 */
export async function getOrderPaymentCtx(order: any): Promise<OrderPaymentCtx | null> {
  const { model, issuerPartnerId } = snapshotModel(order);
  if (model === 'SELLER_SPLIT' && issuerPartnerId) {
    const ctx = await getPartnerCtx(issuerPartnerId);
    if (!ctx) return null;
    return { ...ctx, model, issuerPartnerId };
  }
  const root = await getRootCtx();
  if (!root) return null;
  return { ...root, model: 'ROOT', issuerPartnerId: null };
}

export async function getOrderPaymentCtxById(orderId: string): Promise<OrderPaymentCtx | null> {
  const { data: order } = await getSupabaseAdmin()
    .from('orders')
    .select('id, pricing_snapshot')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return getOrderPaymentCtx(null);
  return getOrderPaymentCtx(order);
}

let rootWalletCache: string | null = null;

/** walletId da conta raiz (destino da comissão no split). */
export async function getRootWalletId(): Promise<string | null> {
  const fromEnv = String(process.env.ASAAS_ROOT_WALLET_ID || '').trim();
  if (fromEnv) return fromEnv;
  if (rootWalletCache) return rootWalletCache;
  const root = await getRootCtx();
  if (!root) return null;
  try {
    const res = await fetch(`${root.baseUrl}/wallets`, {
      headers: { access_token: root.apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const id = Array.isArray(data?.data) && data.data[0]?.id ? String(data.data[0].id) : null;
    if (id) rootWalletCache = id;
    return id;
  } catch (_e) {
    return null;
  }
}

/**
 * Comissão da plataforma no split = o que a plataforma ficaria no modelo antigo:
 * taxa de venda + taxa sobre o frete − parte da tarifa Pix assumida pela plataforma.
 * Com isso, o que sobra na subconta da loja (valor pago − tarifa − comissão) é exatamente
 * o repasse da loja + a corrida da moto.
 */
export function platformCommissionFromPricing(p: any): number {
  const v = Number(p?.platformSalesFee || 0) + Number(p?.platformDeliveryFee || 0) - Number(p?.asaasFeePlatform || 0);
  return Number(Math.max(0, v).toFixed(2));
}

/**
 * Valor que a loja precisa ter na subconta para cobrir o pedido antes da entrega
 * (o que ela recebeu pelo split) e a corrida ainda não paga.
 */
export function sellerNetFromPricing(p: any): number {
  const buyer = Number(p?.buyerTotal || 0);
  const fee = Number(p?.asaasPixFeeFixed || 0);
  return Number(Math.max(0, buyer - fee - platformCommissionFromPricing(p)).toFixed(2));
}

const receivingReady = new Map<string, number>();

function appBaseUrl(): string {
  const fromEnv = String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  return vercel ? `https://${vercel}` : '';
}

/**
 * Garante que a subconta consegue receber cobranças Pix e que o app é avisado:
 * 1. chave Pix aleatória (EVP) ativa na subconta (consentimento já coletado no cadastro);
 * 2. webhook de cobranças/transferências da subconta apontando para /api/asaas/status.
 * Idempotente: consulta antes de criar. Resultado guardado em memória por 1 hora.
 */
export async function ensureSubaccountReceiving(partnerId: string): Promise<{ ok: boolean; error?: string }> {
  const last = receivingReady.get(partnerId);
  if (last && Date.now() - last < 60 * 60 * 1000) return { ok: true };

  const ctx = await getPartnerCtx(partnerId);
  if (!ctx) return { ok: false, error: 'Subconta sem chave de API guardada' };
  const headers = { access_token: ctx.apiKey, 'Content-Type': 'application/json' };

  // 1. Chave Pix
  try {
    const listRes = await fetch(`${ctx.baseUrl}/pix/addressKeys?status=ACTIVE`, { headers, cache: 'no-store' });
    const list = listRes.ok ? await listRes.json() : null;
    const hasKey = Array.isArray(list?.data) && list.data.length > 0;
    if (!hasKey) {
      const createRes = await fetch(`${ctx.baseUrl}/pix/addressKeys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'EVP' })
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null);
        const msg = err?.errors?.[0]?.description || `HTTP ${createRes.status}`;
        console.warn(`[paymentAccount] Não foi possível criar chave Pix da subconta: ${msg}`);
      }
    }
  } catch (e: any) {
    console.warn('[paymentAccount] Falha ao verificar chave Pix da subconta:', e?.message);
  }

  // 2. Webhook de cobranças
  const token = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
  const email = String(process.env.ASAAS_WEBHOOK_EMAIL || '').trim();
  const base = appBaseUrl();
  if (token && email && base) {
    const url = `${base}/api/asaas/status`;
    try {
      const whRes = await fetch(`${ctx.baseUrl}/webhooks`, { headers, cache: 'no-store' });
      const wh = whRes.ok ? await whRes.json() : null;
      const exists = Array.isArray(wh?.data) && wh.data.some((w: any) => String(w?.url || '') === url);
      if (!exists) {
        const createWh = await fetch(`${ctx.baseUrl}/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'AcaiFood - cobrancas e transferencias',
            url,
            email,
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            authToken: token,
            sendType: 'SEQUENTIALLY',
            events: [
              'PAYMENT_RECEIVED',
              'PAYMENT_CONFIRMED',
              'PAYMENT_REFUNDED',
              'PAYMENT_REFUND_IN_PROGRESS',
              'PAYMENT_DELETED',
              'TRANSFER_DONE',
              'TRANSFER_FAILED',
              'TRANSFER_CANCELLED'
            ]
          })
        });
        if (!createWh.ok) {
          const err = await createWh.json().catch(() => null);
          console.warn(`[paymentAccount] Não foi possível criar webhook da subconta: ${err?.errors?.[0]?.description || createWh.status}`);
        }
      }
    } catch (e: any) {
      console.warn('[paymentAccount] Falha ao verificar webhook da subconta:', e?.message);
    }
  } else {
    console.warn('[paymentAccount] ASAAS_WEBHOOK_TOKEN/ASAAS_WEBHOOK_EMAIL/APP_BASE_URL ausentes: webhook da subconta não verificado (a consulta de status cobre).');
  }

  receivingReady.set(partnerId, Date.now());
  return { ok: true };
}
