import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import {
  findTransferByExternalRef,
  getTransferById,
  isTransferDone,
  isTransferFailed,
  describeAsaasError
} from '@/lib/asaasTransferLookup';

/**
 * Repasses pós-entrega (modelo BaaS):
 * - O cliente paga 100% na conta Master.
 * - Com o PIN de entrega validado (pedido RECEIVED), a parte da loja e a parte da moto
 *   saem da Master para a subconta de cada um por transferência interna (POST /transfers + walletId).
 * - Cada repasse é uma linha em `settlements` (única por pedido + papel). O id dessa linha é a
 *   externalReference da transferência no Asaas, o que impede enviar o mesmo repasse duas vezes.
 * - `orders.payout_seller_done` / `payout_driver_done` só viram true quando o Asaas confirma o repasse.
 */

export const DELIVERED_STATUSES = ['RECEIVED', 'received', 'entregue', 'concluido', 'CONCLUIDO', 'ARQUIVADO', 'arquivado'];
const MAX_ATTEMPTS = 5;
// Repasse "PROCESSING" sem id do Asaas e sem transferência localizada volta para a fila depois disso
const STALE_PROCESSING_MS = 15 * 60 * 1000;

type Role = 'seller' | 'driver';

export interface SettleOrderResult {
  orderId: string;
  sellerTransferred?: boolean;
  sellerAmount?: number;
  sellerTransferId?: string;
  sellerError?: string;
  driverTransferred?: boolean;
  driverAmount?: number;
  driverTransferId?: string;
  driverError?: string;
}

export interface SettlementExecResult {
  settlementId: string;
  status: 'DONE' | 'PROCESSING' | 'PENDING' | 'FAILED' | 'WAITING_ACCOUNT' | 'SKIPPED';
  transferId?: string;
  error?: string;
}

interface AsaasCtx {
  apiKey: string;
  baseUrl: string;
}

async function getMasterCtx(): Promise<AsaasCtx | null> {
  const apiKey = await getAsaasApiKey();
  if (!apiKey) return null;
  return { apiKey, baseUrl: getAsaasBaseUrl(apiKey) };
}

export async function isSettlementsEnabled(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('platform_settings').select('settlements_enabled').limit(1).maybeSingle();
  return data?.settlements_enabled !== false;
}

function roleFlag(role: Role) {
  return role === 'driver' ? 'payout_driver_done' : 'payout_seller_done';
}

async function markOrderRoleDone(orderId: string, role: Role) {
  const supabase = getSupabaseAdmin();
  await supabase.from('orders').update({ [roleFlag(role)]: true }).eq('id', orderId);
}

async function loadPartnerAccount(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('id, asaas_wallet_id, asaas_account_status')
    .eq('id', partnerId)
    .maybeSingle();
  const walletId = String(data?.asaas_wallet_id || '').trim();
  const approved = data?.asaas_account_status === 'APPROVED';
  return { walletId, approved };
}

/**
 * Executa (ou confirma) a transferência de UMA linha de settlements.
 * Nunca envia sem antes travar a linha e procurar no Asaas uma transferência com a mesma referência.
 */
export async function executeSettlementTransfer(settlementId: string, ctxIn?: AsaasCtx | null): Promise<SettlementExecResult> {
  const supabase = getSupabaseAdmin();
  const ctx = ctxIn || (await getMasterCtx());
  if (!ctx) return { settlementId, status: 'PENDING', error: 'ASAAS_API_KEY não configurada' };

  // 1. Trava atômica: só uma execução por vez pega a linha
  const { data: row, error: lockErr } = await supabase
    .from('settlements')
    .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
    .eq('id', settlementId)
    .in('status', ['PENDING', 'FAILED', 'WAITING_ACCOUNT'])
    .lt('attempts', MAX_ATTEMPTS)
    .select('id, order_id, partner_id, role, amount, attempts, created_at')
    .maybeSingle();

  if (lockErr || !row) {
    const { data: current } = await supabase.from('settlements').select('status, asaas_transfer_id').eq('id', settlementId).maybeSingle();
    return {
      settlementId,
      status: (current?.status as any) || 'SKIPPED',
      transferId: current?.asaas_transfer_id || undefined,
      error: lockErr?.message
    };
  }

  const role = row.role as Role;
  const amount = Number(row.amount || 0);
  const attempts = Number(row.attempts || 0);

  if (!(amount > 0)) {
    await supabase.from('settlements').update({ status: 'DONE', last_error: 'Valor zero dispensado', updated_at: new Date().toISOString() }).eq('id', settlementId);
    await markOrderRoleDone(row.order_id, role);
    return { settlementId, status: 'DONE' };
  }

  // 2. Conta do parceiro precisa estar aprovada no Asaas
  const acct = await loadPartnerAccount(row.partner_id);
  if (!acct.walletId || !acct.approved) {
    const reason = !acct.walletId ? 'Parceiro sem subconta Asaas vinculada' : 'Subconta Asaas aguardando aprovação (status deve ser APPROVED)';
    await supabase.from('settlements').update({ status: 'WAITING_ACCOUNT', last_error: reason, updated_at: new Date().toISOString() }).eq('id', settlementId);
    return { settlementId, status: 'WAITING_ACCOUNT', error: reason };
  }

  // 3. Idempotência: a referência é o id da linha
  const lookup = await findTransferByExternalRef(ctx.baseUrl, ctx.apiKey, settlementId, row.created_at);
  if (!lookup.ok) {
    // Não dá para garantir que não houve envio anterior: devolve para a fila sem gastar tentativa
    await supabase.from('settlements').update({ status: 'PENDING', last_error: `Verificação no Asaas indisponível: ${lookup.error}`, updated_at: new Date().toISOString() }).eq('id', settlementId);
    return { settlementId, status: 'PENDING', error: lookup.error };
  }

  let transfer = lookup.transfer;

  // 4. Enviar somente se não existir transferência ativa com essa referência
  if (!transfer) {
    let res: Response;
    let data: any = null;
    try {
      res = await fetch(`${ctx.baseUrl}/transfers`, {
        method: 'POST',
        headers: { access_token: ctx.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: amount,
          walletId: acct.walletId,
          externalReference: settlementId,
          description: `Repasse AçaíFood Pedido #${String(row.order_id).substring(0, 8)} (${role === 'driver' ? 'Moto' : 'Loja'})`
        })
      });
      data = await res.json().catch(() => null);
    } catch (netErr: any) {
      // Resposta perdida: o Asaas pode ter aceitado. Fica PROCESSING e a reconciliação confirma pela referência.
      await supabase.from('settlements').update({
        status: 'PROCESSING',
        wallet_id: acct.walletId,
        last_error: `A confirmar no Asaas: ${netErr?.message || 'falha de rede'}`,
        updated_at: new Date().toISOString()
      }).eq('id', settlementId);
      return { settlementId, status: 'PROCESSING', error: netErr?.message };
    }

    if (!res.ok || !data?.id) {
      const errMsg = describeAsaasError(data, res.status);
      const next = attempts + 1;
      const nextStatus = next >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';
      await supabase.from('settlements').update({
        status: nextStatus,
        attempts: next,
        last_error: errMsg,
        updated_at: new Date().toISOString()
      }).eq('id', settlementId);
      return { settlementId, status: nextStatus, error: errMsg };
    }
    transfer = data;
  }

  return applyTransferState(settlementId, row.order_id, role, transfer, acct.walletId);
}

async function applyTransferState(
  settlementId: string,
  orderId: string,
  role: Role,
  transfer: any,
  walletId?: string
): Promise<SettlementExecResult> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const transferId = String(transfer?.id || '');

  if (isTransferDone(transfer?.status)) {
    await supabase.from('settlements').update({
      status: 'DONE',
      asaas_transfer_id: transferId,
      ...(walletId ? { wallet_id: walletId } : {}),
      transferred_at: nowIso,
      last_error: null,
      updated_at: nowIso
    }).eq('id', settlementId);
    await markOrderRoleDone(orderId, role);
    return { settlementId, status: 'DONE', transferId };
  }

  if (isTransferFailed(transfer?.status)) {
    const { data: cur } = await supabase.from('settlements').select('attempts').eq('id', settlementId).maybeSingle();
    const next = Number(cur?.attempts || 0) + 1;
    const nextStatus = next >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';
    const reason = transfer?.failReason || `Transferência ${String(transfer?.status).toLowerCase()} no Asaas`;
    await supabase.from('settlements').update({
      status: nextStatus,
      attempts: next,
      asaas_transfer_id: null,
      last_error: reason,
      updated_at: nowIso
    }).eq('id', settlementId);
    return { settlementId, status: nextStatus, error: reason };
  }

  // Aceita pelo Asaas mas ainda não concluída
  await supabase.from('settlements').update({
    status: 'PROCESSING',
    asaas_transfer_id: transferId || null,
    ...(walletId ? { wallet_id: walletId } : {}),
    last_error: null,
    updated_at: nowIso
  }).eq('id', settlementId);
  return { settlementId, status: 'PROCESSING', transferId };
}

/**
 * Confirma no Asaas um repasse que está em PROCESSING.
 */
export async function reconcileSettlement(settlementId: string, ctxIn?: AsaasCtx | null): Promise<SettlementExecResult> {
  const supabase = getSupabaseAdmin();
  const ctx = ctxIn || (await getMasterCtx());
  if (!ctx) return { settlementId, status: 'PROCESSING', error: 'ASAAS_API_KEY não configurada' };

  const { data: row } = await supabase
    .from('settlements')
    .select('id, order_id, role, status, asaas_transfer_id, created_at, updated_at')
    .eq('id', settlementId)
    .maybeSingle();
  if (!row) return { settlementId, status: 'SKIPPED', error: 'Repasse não encontrado' };
  if (row.status !== 'PROCESSING') return { settlementId, status: row.status as any, transferId: row.asaas_transfer_id || undefined };

  const role = row.role as Role;

  if (row.asaas_transfer_id) {
    const res = await getTransferById(ctx.baseUrl, ctx.apiKey, row.asaas_transfer_id);
    if (!res.ok || !res.transfer) return { settlementId, status: 'PROCESSING', error: res.error };
    return applyTransferState(settlementId, row.order_id, role, res.transfer);
  }

  const lookup = await findTransferByExternalRef(ctx.baseUrl, ctx.apiKey, settlementId, row.created_at);
  if (!lookup.ok) return { settlementId, status: 'PROCESSING', error: lookup.error };
  if (lookup.transfer) return applyTransferState(settlementId, row.order_id, role, lookup.transfer);

  // Nenhuma transferência com essa referência: só devolve para a fila depois de um tempo,
  // para não competir com uma execução que ainda esteja em andamento.
  const updatedAt = new Date(row.updated_at || row.created_at || 0).getTime();
  if (Date.now() - updatedAt > STALE_PROCESSING_MS) {
    await supabase.from('settlements').update({
      status: 'PENDING',
      last_error: 'Transferência não localizada no Asaas; reenfileirado',
      updated_at: new Date().toISOString()
    }).eq('id', settlementId).eq('status', 'PROCESSING');
    return { settlementId, status: 'PENDING' };
  }
  return { settlementId, status: 'PROCESSING' };
}

/**
 * Valor líquido do papel no pedido. Nunca usa o subtotal bruto como fallback
 * (isso pagaria a taxa da plataforma ao parceiro).
 */
function resolveRoleAmount(order: any, role: Role): number | null {
  const direct = role === 'driver' ? order.driver_payout_amount : order.seller_payout_amount;
  if (direct !== null && direct !== undefined && !isNaN(Number(direct))) return Number(direct);
  const snap = order.pricing_snapshot || {};
  const fromSnap = role === 'driver' ? snap.netDriverPayout : snap.netSellerPayout;
  if (fromSnap !== null && fromSnap !== undefined && !isNaN(Number(fromSnap))) return Number(fromSnap);
  return null;
}

async function ensureSettlementRow(orderId: string, partnerId: string, role: Role, amount: number) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('settlements')
    .select('id, status, asaas_transfer_id')
    .eq('order_id', orderId)
    .eq('role', role)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await supabase
    .from('settlements')
    .insert({ order_id: orderId, partner_id: partnerId, role, amount, status: 'PENDING' })
    .select('id, status, asaas_transfer_id')
    .maybeSingle();
  if (created) return created;

  // Outra execução criou a linha ao mesmo tempo (UNIQUE order_id + role)
  const { data: again } = await supabase
    .from('settlements')
    .select('id, status, asaas_transfer_id')
    .eq('order_id', orderId)
    .eq('role', role)
    .maybeSingle();
  return again || null;
}

async function settleRole(order: any, role: Role, partnerId: string, ctx: AsaasCtx): Promise<{ done: boolean; amount?: number; transferId?: string; error?: string }> {
  const amount = resolveRoleAmount(order, role);
  if (amount === null) return { done: false, error: 'Pedido sem valor de repasse calculado' };
  if (amount <= 0) {
    await markOrderRoleDone(order.id, role);
    return { done: true, amount: 0 };
  }

  const row = await ensureSettlementRow(order.id, partnerId, role, amount);
  if (!row) return { done: false, error: 'Não foi possível registrar o repasse' };

  if (row.status === 'DONE') {
    await markOrderRoleDone(order.id, role);
    return { done: true, amount, transferId: row.asaas_transfer_id || undefined };
  }

  const res = row.status === 'PROCESSING'
    ? await reconcileSettlement(row.id, ctx)
    : await executeSettlementTransfer(row.id, ctx);

  return {
    done: res.status === 'DONE',
    amount,
    transferId: res.transferId,
    error: res.status === 'DONE' ? undefined : (res.error || `Repasse em ${res.status}`)
  };
}

/**
 * Liquida a parte da loja e da moto de um pedido entregue.
 */
export async function settleOrderPayouts(orderId: string): Promise<SettleOrderResult> {
  const supabase = getSupabaseAdmin();
  const result: SettleOrderResult = { orderId };

  try {
    const ctx = await getMasterCtx();
    if (!ctx) return { orderId, sellerError: 'ASAAS_API_KEY não configurada' };

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, status, seller_storefront_id, driver_id, seller_payout_amount, driver_payout_amount, pricing_snapshot, payout_seller_done, payout_driver_done')
      .eq('id', orderId)
      .maybeSingle();

    if (oErr || !order) return { orderId, sellerError: 'Pedido não encontrado' };

    if (!DELIVERED_STATUSES.includes(String(order.status || '').trim())) {
      return result; // Ainda não entregue: repasse só após o PIN de entrega
    }

    // Loja / Batedeira / Fornecedor
    if (!order.payout_seller_done && order.seller_storefront_id) {
      const { data: sf } = await supabase.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).maybeSingle();
      const sellerId = sf?.partner_id || null;
      if (sellerId) {
        const r = await settleRole(order, 'seller', sellerId, ctx);
        result.sellerTransferred = r.done;
        result.sellerAmount = r.amount;
        result.sellerTransferId = r.transferId;
        result.sellerError = r.error;
      } else {
        result.sellerError = 'Loja do pedido sem parceiro vinculado';
      }
    }

    // Moto / Motorista
    if (!order.payout_driver_done && order.driver_id) {
      const r = await settleRole(order, 'driver', order.driver_id, ctx);
      result.driverTransferred = r.done;
      result.driverAmount = r.amount;
      result.driverTransferId = r.transferId;
      result.driverError = r.error;
    }

    return result;
  } catch (error: any) {
    console.error(`[orderSettlements] Exceção ao liquidar pedido ${orderId}:`, error);
    return { orderId, sellerError: error?.message || 'Erro interno' };
  }
}

/**
 * Antes de um saque: empurra para a subconta os pedidos entregues deste parceiro que ainda não foram repassados.
 */
export async function settlePendingOrdersForPartner(partnerId: string, isDriver: boolean): Promise<SettleOrderResult[]> {
  const supabase = getSupabaseAdmin();
  const results: SettleOrderResult[] = [];
  try {
    if (!(await isSettlementsEnabled())) return results;

    let orderIds: string[] = [];
    if (isDriver) {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('driver_id', partnerId)
        .in('status', DELIVERED_STATUSES)
        .or('payout_driver_done.eq.false,payout_driver_done.is.null')
        .limit(30);
      orderIds = (data || []).map((o: any) => o.id);
    } else {
      const { data: sfs } = await supabase.from('storefronts').select('id').eq('partner_id', partnerId);
      const sfIds = (sfs || []).map((s: any) => s.id);
      if (sfIds.length > 0) {
        const { data } = await supabase
          .from('orders')
          .select('id')
          .in('seller_storefront_id', sfIds)
          .in('status', DELIVERED_STATUSES)
          .or('payout_seller_done.eq.false,payout_seller_done.is.null')
          .limit(30);
        orderIds = (data || []).map((o: any) => o.id);
      }
    }

    for (const id of orderIds) {
      results.push(await settleOrderPayouts(id));
    }
  } catch (err) {
    console.warn('[orderSettlements] Aviso ao liquidar pendências do parceiro:', err);
  }
  return results;
}

/**
 * Rotina completa (cron / admin):
 * 1. pedidos entregues sem repasse → cria/executa repasses
 * 2. repasses na fila (PENDING / FAILED com tentativas / WAITING_ACCOUNT) → executa
 * 3. repasses PROCESSING → confirma no Asaas
 */
export async function syncAndProcessPendingSettlements(): Promise<{ processed: number; results: any[] }> {
  const supabase = getSupabaseAdmin();
  const results: any[] = [];
  const ctx = await getMasterCtx();
  if (!ctx) return { processed: 0, results: [{ error: 'ASAAS_API_KEY não configurada' }] };

  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id')
    .in('status', DELIVERED_STATUSES)
    .or('payout_seller_done.eq.false,payout_seller_done.is.null,payout_driver_done.eq.false,payout_driver_done.is.null')
    .order('created_at', { ascending: false })
    .limit(30);

  for (const o of pendingOrders || []) {
    results.push(await settleOrderPayouts(o.id));
  }

  const { data: queued } = await supabase
    .from('settlements')
    .select('id')
    .in('status', ['PENDING', 'FAILED', 'WAITING_ACCOUNT'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(50);

  for (const s of queued || []) {
    results.push(await executeSettlementTransfer(s.id, ctx));
  }

  const { data: processing } = await supabase
    .from('settlements')
    .select('id')
    .eq('status', 'PROCESSING')
    .order('updated_at', { ascending: true })
    .limit(50);

  for (const s of processing || []) {
    results.push(await reconcileSettlement(s.id, ctx));
  }

  return { processed: results.length, results };
}
