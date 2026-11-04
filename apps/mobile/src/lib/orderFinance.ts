/**
 * R44 — Valores financeiros de um pedido a partir do que foi gravado no pagamento.
 * Usa o pricing_snapshot (valores congelados pelo servidor, já com a tarifa Pix do Asaas rateada).
 * Pedidos antigos sem snapshot: estimativa pelos percentuais gravados no próprio pedido.
 * Usado pelo fechamento mensal e pelos números da Visão Geral do admin.
 */

export const ORDER_FINANCE_FIELDS =
  'id, order_type, status, created_at, received_at, products_subtotal, delivery_fee_amount, platform_fee_amount, seller_payout_amount, driver_payout_amount, asaas_fee_amount, pricing_snapshot, applied_platform_fee_percent, applied_delivery_platform_fee_percent, seller_storefront_id, buyer_id, driver_id';

const num = (v: any) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export type OrderFinance = {
  type: string;
  produtos: number;
  frete: number;
  comissaoVenda: number;
  comissaoFrete: number;
  asaasTotal: number;
  asaasVendedor: number;
  asaasEntregador: number;
  asaasPlataforma: number;
  freteLoja: number;
  repasseVendedor: number;
  repasseEntregador: number;
  receitaLiquida: number;
  estimado: boolean;
};

export function orderFinance(o: any): OrderFinance {
  const type = String(o?.order_type || 'B2C').toUpperCase();
  const ps = o?.pricing_snapshot && typeof o.pricing_snapshot === 'object' ? o.pricing_snapshot : null;
  const hasSnap = !!ps && num(ps.netSellerPayout) !== null && num(ps.netDriverPayout) !== null;
  const produtos = type === 'COLETA' ? 0 : (num(o?.products_subtotal) ?? 0);

  let frete: number, comissaoVenda: number, comissaoFrete: number, asaasVendedor: number, asaasEntregador: number, asaasPlataforma: number, freteLoja: number;
  if (hasSnap) {
    frete = num(ps.deliveryTotal) ?? num(o.delivery_fee_amount) ?? 0;
    comissaoVenda = num(ps.platformSalesFee) ?? 0;
    comissaoFrete = num(ps.platformDeliveryFee) ?? 0;
    asaasVendedor = num(ps.asaasFeeSeller) ?? 0;
    asaasEntregador = num(ps.asaasFeeDriver) ?? 0;
    asaasPlataforma = num(ps.asaasFeePlatform) ?? 0;
    freteLoja = num(ps.storeDeliveryFee) ?? 0;
  } else {
    frete = num(o?.delivery_fee_amount) ?? 0;
    comissaoVenda = r2(produtos * (num(o?.applied_platform_fee_percent) ?? 0) / 100);
    comissaoFrete = r2(frete * (num(o?.applied_delivery_platform_fee_percent) ?? 0) / 100);
    asaasVendedor = 0; asaasEntregador = 0; asaasPlataforma = 0; freteLoja = 0;
  }
  const asaasTotal = num(o?.asaas_fee_amount) ?? (hasSnap ? (num(ps.asaasPixFeeFixed) ?? 0) : 0);
  const repasseVendedor = type === 'COLETA' ? 0 : (num(o?.seller_payout_amount) ?? (hasSnap ? (num(ps.netSellerPayout) ?? 0) : r2(produtos - comissaoVenda)));
  const repasseEntregador = num(o?.driver_payout_amount) ?? (hasSnap ? (num(ps.netDriverPayout) ?? 0) : r2(frete - comissaoFrete));

  return {
    type, produtos, frete, comissaoVenda, comissaoFrete, asaasTotal, asaasVendedor, asaasEntregador, asaasPlataforma,
    freteLoja, repasseVendedor, repasseEntregador,
    receitaLiquida: r2(comissaoVenda + comissaoFrete - asaasPlataforma),
    estimado: !hasSnap,
  };
}

/** Início do dia/mês no horário de Belém (UTC-3), em ISO UTC */
export function belemPeriodStart(period: 'daily' | 'monthly'): string {
  const nowBelem = new Date(Date.now() - 3 * 3600 * 1000);
  const y = nowBelem.getUTCFullYear();
  const m = nowBelem.getUTCMonth();
  const d = period === 'daily' ? nowBelem.getUTCDate() : 1;
  return new Date(Date.UTC(y, m, d, 3, 0, 0)).toISOString();
}
