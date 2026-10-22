import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateOrderPricing } from '@/lib/pricingEngine';

export interface PartnerBalanceResult {
  totalDisponivel: number;
  orderIds: string[];
  quantidadePedidos: number;
  mirroredFromAsaas?: boolean;
  subaccountBalance?: number;
  internalOrderBalance?: number;
}

export async function getPartnerAvailableBalance(partnerId: string, role: string): Promise<PartnerBalanceResult> {
  const adminSupabase = getSupabaseAdmin();
  const normalizedRole = String(role || '').toLowerCase().trim();
  const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(normalizedRole);

  let orderIds: string[] = [];
  let totalDisponivel = 0;

  try {
    const invalidStatuses = ['CANCELLED', 'CANCELADO', 'REFUNDED', 'RECUSADO', 'PIN_LOCKED', 'aguardando_pagamento', 'PENDING', 'pendente', 'PAID', 'paid', 'CONFIRMED', 'confirmed', 'PREPARING', 'preparing', 'preparo', 'pronto', 'PRONTO'];
    // Saldo para saque é liberado ESTRITAMENTE após a entrega concluída via validação de PIN (RECEIVED)
    const validStatuses = [
      'RECEIVED', 'received', 'entregue', 'arquivado', 'concluido', 'CONCLUIDO', 'ARQUIVADO'
    ];

    const matchedOrdersMap = new Map<string, any>();

    const ORDER_BALANCE_COLS = 'id, status, driver_id, seller_storefront_id, order_type, products_subtotal, delivery_distance_km, driver_amount, seller_amount, seller_payout_amount, driver_payout_amount, platform_fee_amount, delivery_fee_amount, payout_seller_done, payout_driver_done';

    if (isDriver) {
      // 1. Motorista / Motoboy / Caminhão: consultar orders por driver_id
      const { data: driverOrders, error: dErr } = await adminSupabase
        .from('orders')
        .select(ORDER_BALANCE_COLS)
        .eq('driver_id', partnerId)
        .or('payout_driver_done.eq.false,payout_driver_done.is.null')
        .in('status', validStatuses);

      if (dErr) {
        console.warn('[partnerBalance] Aviso ao consultar pedidos do motorista:', dErr);
      }

      if (driverOrders && driverOrders.length > 0) {
        for (const order of driverOrders) {
          const st = String(order.status || '').trim();
          if (validStatuses.includes(st) && !order.payout_driver_done) {
            matchedOrdersMap.set(order.id, order);
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        let netDriver = 0;
        // Prioridade 1: valor líquido gravado diretamente no pedido
        const savedAmount = o.driver_payout_amount !== null && o.driver_payout_amount !== undefined
          ? Number(o.driver_payout_amount)
          : (o.driver_amount !== null && o.driver_amount !== undefined ? Number(o.driver_amount) : null);

        if (savedAmount !== null && savedAmount > 0) {
          netDriver = savedAmount;
        } else {
          // Fallback: cálculo pelo motor de precificação
          const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
          const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
          const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

          try {
            const pricing = await calculateOrderPricing({
              orderType: o.order_type || (o as any).type || 'B2C',
              distanceKm,
              cityName,
              productsSubtotal,
              sellerStorefrontId: o.seller_storefront_id
            }, adminSupabase);
            netDriver = pricing.netDriverPayout;
          } catch (_pErr) {
            netDriver = Number(o.driver_payout_amount || (o as any).driver_amount || (o as any).driver_payout || 0);
          }
        }

        if (netDriver > 0) {
          totalDisponivel += netDriver;
          orderIds.push(o.id);
        }
      }
    } else {
      // 2. Loja / Batedeira / Fornecedor: buscar storefront_id vinculado ao partner_id
      const { data: storefronts } = await adminSupabase
        .from('storefronts')
        .select('id')
        .eq('partner_id', partnerId);

      const sfIds = storefronts ? storefronts.map(s => s.id) : [];
      const validIds = Array.from(new Set([...sfIds, partnerId]));

      const { data: storeOrders, error: sErr } = await adminSupabase
        .from('orders')
        .select(ORDER_BALANCE_COLS)
        .in('seller_storefront_id', validIds)
        .or('payout_seller_done.eq.false,payout_seller_done.is.null')
        .in('status', validStatuses);

      if (sErr) {
        console.warn('[partnerBalance] Aviso ao consultar pedidos da loja/fornecedor:', sErr);
      }

      if (storeOrders && storeOrders.length > 0) {
        for (const order of storeOrders) {
          const st = String(order.status || '').trim();
          if (validStatuses.includes(st) && !order.payout_seller_done) {
            matchedOrdersMap.set(order.id, order);
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        let netSeller = 0;
        // Prioridade 1: valor líquido gravado diretamente no pedido
        const savedAmount = o.seller_payout_amount !== null && o.seller_payout_amount !== undefined
          ? Number(o.seller_payout_amount)
          : (o.seller_amount !== null && o.seller_amount !== undefined ? Number(o.seller_amount) : null);

        if (savedAmount !== null && savedAmount > 0) {
          netSeller = savedAmount;
        } else {
          // Fallback: cálculo pelo motor de precificação
          const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
          const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
          const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

          try {
            const pricing = await calculateOrderPricing({
              orderType: o.order_type || (o as any).type || 'B2C',
              distanceKm,
              cityName,
              productsSubtotal,
              sellerStorefrontId: o.seller_storefront_id
            }, adminSupabase);
            netSeller = pricing.netSellerPayout;
          } catch (_pErr) {
            netSeller = Number(o.seller_payout_amount || (o as any).seller_amount || (o as any).seller_payout || 0);
          }
        }

        if (netSeller > 0) {
          totalDisponivel += netSeller;
          orderIds.push(o.id);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao calcular saldo disponível do parceiro:", err);
  }

  const internalOrderBalance = Number(totalDisponivel.toFixed(2));
  let mirroredFromAsaas = false;
  let subaccountBalance: number | null = null;

  // 3. Espelhamento do saldo real da subconta Asaas (BaaS Cláusula 6.4)
  try {
    const { data: secretRow } = await adminSupabase
      .from('partner_secrets')
      .select('asaas_account_api_key')
      .eq('user_id', partnerId)
      .maybeSingle();

    const subApiKey = secretRow?.asaas_account_api_key;
    if (subApiKey) {
      const { getAsaasBaseUrl } = await import('@/lib/asaasConfig');
      const asaasUrl = getAsaasBaseUrl(subApiKey);
      const balRes = await fetch(`${asaasUrl}/finance/balance`, {
        headers: {
          'access_token': subApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (balRes.ok) {
        const balData = await balRes.json();
        if (typeof balData?.balance === 'number') {
          subaccountBalance = Number(balData.balance);
          mirroredFromAsaas = true;
        }
      } else {
        console.warn(`[partnerBalance] Resposta HTTP ${balRes.status} do Asaas ao consultar saldo da subconta.`);
      }
    }
  } catch (asaasErr) {
    console.warn(`[partnerBalance] Não foi possível consultar saldo Asaas em tempo real para parceiro ${partnerId}:`, asaasErr);
  }

  // Regra de espelhamento integrado:
  // Se a subconta Asaas existe e retornou saldo com sucesso:
  // O saldo disponível na carteira considera o saldo da subconta Asaas + pedidos concluídos ainda não liquidados nela
  if (mirroredFromAsaas && subaccountBalance !== null) {
    const effectiveSubBal = Math.max(0, subaccountBalance);
    totalDisponivel = Number((effectiveSubBal + internalOrderBalance).toFixed(2));
  } else {
    totalDisponivel = internalOrderBalance;
  }

  return {
    totalDisponivel: Number(totalDisponivel.toFixed(2)),
    orderIds,
    quantidadePedidos: orderIds.length,
    mirroredFromAsaas,
    subaccountBalance: subaccountBalance !== null ? Number(subaccountBalance.toFixed(2)) : undefined,
    internalOrderBalance
  };
}

export async function reconcilePartnerWithdrawals(partnerId?: string, role?: string): Promise<void> {
  const adminSupabase = getSupabaseAdmin();
  try {
    const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
    const asaasApiKey = await getAsaasApiKey();
    const asaasUrl = getAsaasBaseUrl(asaasApiKey);

    let query = adminSupabase
      .from('withdrawal_requests')
      .select('id, partner_id, role, status, order_ids, asaas_transfer_id, created_at')
      .in('status', ['PENDENTE', 'APROVADO', 'PROCESSING', 'FALHOU']);

    if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }

    const { data: requests } = await query.limit(50);
    if (!requests || requests.length === 0) return;

    for (const req of requests) {
      const normalizedRole = String(req.role || role || '').toLowerCase().trim();
      const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(normalizedRole);
      let updatedStatus: string | null = null;
      let failureReason: string | null = null;

      // 1. Se estiver em PROCESSING com asaas_transfer_id:
      // O saque passou pelo Tempo 1 (Master -> Subconta). Checar se liquidou no Asaas e disparar o Tempo 2 (Pix da Subconta).
      if (req.status === 'PROCESSING' && req.asaas_transfer_id) {
        try {
          const { executeSubaccountPixPayout } = await import('@/lib/withdrawalApproval');
          const pixExecRes = await executeSubaccountPixPayout(req.id);
          if (pixExecRes.status === 'PAGO') {
            continue; // Já finalizado pelo helper
          }
          if (pixExecRes.status === 'FALHOU') {
            continue;
          }
        } catch (subPixErr) {
          console.warn(`[reconcilePartnerWithdrawals] Erro ao tentar liquidar Pix da subconta para saque #${req.id}:`, subPixErr);
        }
      }

      // 1.1 Se possui asaas_transfer_id e status não é PROCESSING, consultar status na API do Asaas
      if (req.status !== 'PROCESSING' && req.asaas_transfer_id && asaasApiKey) {
        try {
          const tRes = await fetch(`${asaasUrl}/transfers/${req.asaas_transfer_id}`, {
            headers: { 'access_token': asaasApiKey }
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            const tStatus = String(tData.status || '').toUpperCase();
            if (['DONE', 'COMPLETED', 'CONFIRMED'].includes(tStatus)) {
              updatedStatus = 'PAGO';
            } else if (['FAILED', 'CANCELLED', 'REJECTED', 'REFUSED'].includes(tStatus)) {
              updatedStatus = 'FALHOU';
              failureReason = tData.failReason || tData.description || `Transferência ${tStatus.toLowerCase()} no Asaas`;
            }
          }
        } catch (tErr) {
          console.warn(`[reconcilePartnerWithdrawals] Aviso ao consultar transferência Asaas ${req.asaas_transfer_id}:`, tErr);
        }
      }

      // 2. Não antecipar status PAGO sem confirmação real da API do Asaas

      // (Removido fechamento prematuro sem autorização do Asaas)

      if (updatedStatus && updatedStatus !== req.status) {
        const nowIso = new Date().toISOString();
        const updatePayload: any = {
          status: updatedStatus,
          reviewed_at: nowIso
        };

        if (updatedStatus === 'PAGO') {
          updatePayload.paid_at = nowIso;
          updatePayload.failure_reason = null;
        } else if (updatedStatus === 'FALHOU') {
          updatePayload.failure_reason = failureReason || 'Transferência cancelada ou recusada no Asaas';
        }

        await adminSupabase
          .from('withdrawal_requests')
          .update(updatePayload)
          .eq('id', req.id);

        if (updatedStatus === 'PAGO' && Array.isArray(req.order_ids) && req.order_ids.length > 0) {
          const updateField = isDriver ? { payout_driver_done: true } : { payout_seller_done: true };
          await adminSupabase.from('orders').update(updateField).in('id', req.order_ids);
        }
      }
    }
  } catch (err) {
    console.warn("[reconcilePartnerWithdrawals] Aviso ao reconciliar saques:", err);
  }
}
