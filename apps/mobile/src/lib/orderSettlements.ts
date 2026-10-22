import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

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

/**
 * Liquidação dos repasses de um pedido diretamente para as subcontas Asaas da Batedeira e da Moto:
 * 1. Identifica a subconta Asaas (walletId) da loja/batedeira e do entregador.
 * 2. Transfere da Master para as respectivas subcontas via POST /transfers (Transferência Interna Gratuita).
 * 3. Registra na tabela settlements e atualiza payout_seller_done / payout_driver_done em orders.
 */
export async function settleOrderPayouts(orderId: string): Promise<SettleOrderResult> {
  const supabase = getSupabaseAdmin();
  const result: SettleOrderResult = { orderId };

  try {
    const apiKey = await getAsaasApiKey();
    if (!apiKey) {
      return { orderId, sellerError: 'ASAAS_API_KEY não configurada' };
    }
    const asaasUrl = getAsaasBaseUrl(apiKey);

    // 1. Buscar o pedido
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, status, seller_storefront_id, driver_id, products_subtotal, seller_payout_amount, driver_payout_amount, payout_seller_done, payout_driver_done')
      .eq('id', orderId)
      .maybeSingle();

    if (oErr || !order) {
      return { orderId, sellerError: 'Pedido não encontrado' };
    }

    const validStatuses = ['RECEIVED', 'received', 'entregue', 'concluido', 'CONCLUIDO', 'ARQUIVADO'];
    if (!validStatuses.includes(String(order.status || '').trim())) {
      console.log(`[orderSettlements] Pedido ${orderId} com status '${order.status}' ainda não entregue. Liquidação aguardando RECEIVED.`);
      return result;
    }

    // 2. Liquidar parte da Loja / Batedeira
    const sellerAmount = Number(order.seller_payout_amount || order.products_subtotal || 0);
    if (sellerAmount > 0 && !order.payout_seller_done && order.seller_storefront_id) {
      let partnerUserId: string | null = null;
      const { data: sf } = await supabase
        .from('storefronts')
        .select('partner_id')
        .eq('id', order.seller_storefront_id)
        .maybeSingle();

      partnerUserId = sf?.partner_id || order.seller_storefront_id;

      if (partnerUserId) {
        const { data: partnerUser } = await supabase
          .from('users')
          .select('id, name, asaas_wallet_id, asaas_account_status')
          .eq('id', partnerUserId)
          .maybeSingle();

        const sellerWalletId = partnerUser?.asaas_wallet_id?.trim();
        const sellerKyc = partnerUser?.asaas_account_status === 'APPROVED';

        if (sellerWalletId && sellerKyc) {
          // Garantir linha em settlements
          let settlementId: string | null = null;
          const { data: existingSettle } = await supabase
            .from('settlements')
            .select('id, status, asaas_transfer_id')
            .eq('order_id', orderId)
            .eq('role', 'seller')
            .maybeSingle();

          if (existingSettle) {
            settlementId = existingSettle.id;
          } else {
            const { data: newSettle } = await supabase
              .from('settlements')
              .insert({
                order_id: orderId,
                partner_id: partnerUserId,
                role: 'seller',
                amount: sellerAmount,
                wallet_id: sellerWalletId,
                status: 'PENDING'
              })
              .select('id')
              .single();
            settlementId = newSettle?.id || null;
          }

          if (settlementId) {
            const externalRef = settlementId;
            // Checar se já transferiu no Asaas com essa externalReference
            let existingTransferId: string | null = null;
            try {
              const chkRes = await fetch(`${asaasUrl}/transfers?externalReference=${encodeURIComponent(externalRef)}`, {
                headers: { 'access_token': apiKey }
              });
              if (chkRes.ok) {
                const chkData = await chkRes.json();
                if (Array.isArray(chkData?.data)) {
                  const match = chkData.data.find((t: any) => t.externalReference === externalRef);
                  if (match && ['DONE', 'COMPLETED', 'CONFIRMED', 'PENDING'].includes(match.status)) {
                    existingTransferId = match.id;
                  }
                }
              }
            } catch (_chkErr) {}

            let transferId = existingTransferId;

            if (!transferId) {
              const transferBody = {
                value: sellerAmount,
                walletId: sellerWalletId,
                externalReference: externalRef,
                description: `Repasse AçaíFood Pedido #${orderId.substring(0, 8)} (Batedeira)`
              };

              const tRes = await fetch(`${asaasUrl}/transfers`, {
                method: 'POST',
                headers: {
                  'access_token': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferBody)
              });

              const tData = await tRes.json().catch(() => null);
              if (tRes.ok && tData?.id) {
                transferId = tData.id;
                console.log(`[orderSettlements] ✅ Repasse Batedeira transferido para subconta: ID ${tData.id} | R$ ${sellerAmount}`);
              } else {
                const errMsg = tData?.errors?.[0]?.description || tData?.message || `Erro HTTP ${tRes.status} no Asaas`;
                result.sellerError = errMsg;
                console.warn(`[orderSettlements] Falha ao transferir repasse da batedeira:`, errMsg);
                await supabase.from('settlements').update({ status: 'FAILED', last_error: errMsg }).eq('id', settlementId);
              }
            }

            if (transferId) {
              result.sellerTransferred = true;
              result.sellerAmount = sellerAmount;
              result.sellerTransferId = transferId;
              const nowIso = new Date().toISOString();

              await supabase.from('settlements').update({
                status: 'DONE',
                asaas_transfer_id: transferId,
                transferred_at: nowIso,
                last_error: null
              }).eq('id', settlementId);

              await supabase.from('orders').update({
                payout_seller_done: true
              }).eq('id', orderId);
            }
          }
        } else {
          result.sellerError = !sellerWalletId ? 'Batedeira sem subconta Asaas' : 'Subconta da Batedeira não aprovada';
        }
      }
    }

    // 3. Liquidar parte do Entregador / Motorista
    const driverAmount = Number(order.driver_payout_amount || 0);
    if (driverAmount > 0 && !order.payout_driver_done && order.driver_id) {
      const { data: driverUser } = await supabase
        .from('users')
        .select('id, name, asaas_wallet_id, asaas_account_status')
        .eq('id', order.driver_id)
        .maybeSingle();

      const driverWalletId = driverUser?.asaas_wallet_id?.trim();
      const driverKyc = driverUser?.asaas_account_status === 'APPROVED';

      if (driverWalletId && driverKyc) {
        let settlementId: string | null = null;
        const { data: existingSettle } = await supabase
          .from('settlements')
          .select('id, status, asaas_transfer_id')
          .eq('order_id', orderId)
          .eq('role', 'driver')
          .maybeSingle();

        if (existingSettle) {
          settlementId = existingSettle.id;
        } else {
          const { data: newSettle } = await supabase
            .from('settlements')
            .insert({
              order_id: orderId,
              partner_id: order.driver_id,
              role: 'driver',
              amount: driverAmount,
              wallet_id: driverWalletId,
              status: 'PENDING'
            })
            .select('id')
            .single();
          settlementId = newSettle?.id || null;
        }

        if (settlementId) {
          const externalRef = settlementId;
          let existingTransferId: string | null = null;
          try {
            const chkRes = await fetch(`${asaasUrl}/transfers?externalReference=${encodeURIComponent(externalRef)}`, {
              headers: { 'access_token': apiKey }
            });
            if (chkRes.ok) {
              const chkData = await chkRes.json();
              if (Array.isArray(chkData?.data)) {
                const match = chkData.data.find((t: any) => t.externalReference === externalRef);
                if (match && ['DONE', 'COMPLETED', 'CONFIRMED', 'PENDING'].includes(match.status)) {
                  existingTransferId = match.id;
                }
              }
            }
          } catch (_chkErr) {}

          let transferId = existingTransferId;

          if (!transferId) {
            const transferBody = {
              value: driverAmount,
              walletId: driverWalletId,
              externalReference: externalRef,
              description: `Repasse AçaíFood Pedido #${orderId.substring(0, 8)} (Moto)`
            };

            const tRes = await fetch(`${asaasUrl}/transfers`, {
              method: 'POST',
              headers: {
                'access_token': apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(transferBody)
            });

            const tData = await tRes.json().catch(() => null);
            if (tRes.ok && tData?.id) {
              transferId = tData.id;
              console.log(`[orderSettlements] ✅ Repasse Moto transferido para subconta: ID ${tData.id} | R$ ${driverAmount}`);
            } else {
              const errMsg = tData?.errors?.[0]?.description || tData?.message || `Erro HTTP ${tRes.status} no Asaas`;
              result.driverError = errMsg;
              console.warn(`[orderSettlements] Falha ao transferir repasse da moto:`, errMsg);
              await supabase.from('settlements').update({ status: 'FAILED', last_error: errMsg }).eq('id', settlementId);
            }
          }

          if (transferId) {
            result.driverTransferred = true;
            result.driverAmount = driverAmount;
            result.driverTransferId = transferId;
            const nowIso = new Date().toISOString();

            await supabase.from('settlements').update({
              status: 'DONE',
              asaas_transfer_id: transferId,
              transferred_at: nowIso,
              last_error: null
            }).eq('id', settlementId);

            await supabase.from('orders').update({
              payout_driver_done: true
            }).eq('id', orderId);
          }
        }
      } else {
        result.driverError = !driverWalletId ? 'Motorista sem subconta Asaas' : 'Subconta do motorista não aprovada';
      }
    }

    return result;
  } catch (error: any) {
    console.error(`[orderSettlements] Exceção ao liquidar pedido ${orderId}:`, error);
    return { orderId, sellerError: error.message };
  }
}

/**
 * Varre e liquida todos os pedidos entregues (RECEIVED) pendentes de repasse para subconta
 */
export async function syncAndProcessPendingSettlements(): Promise<{ processed: number; results: SettleOrderResult[] }> {
  const supabase = getSupabaseAdmin();
  const validStatuses = ['RECEIVED', 'received', 'entregue', 'concluido', 'CONCLUIDO', 'ARQUIVADO'];

  const { data: pendingOrders, error } = await supabase
    .from('orders')
    .select('id')
    .in('status', validStatuses)
    .or('payout_seller_done.eq.false,payout_driver_done.eq.false')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !pendingOrders || pendingOrders.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: SettleOrderResult[] = [];
  for (const o of pendingOrders) {
    const res = await settleOrderPayouts(o.id);
    results.push(res);
  }

  return { processed: results.length, results };
}
