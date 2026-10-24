import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateOrderPricing } from '@/lib/pricingEngine';
import { snapshotModel, sellerNetFromPricing } from '@/lib/paymentAccount';

export interface PartnerBalanceResult {
  totalDisponivel: number;
  orderIds: string[];
  quantidadePedidos: number;
  mirroredFromAsaas?: boolean;
  subaccountBalance?: number;
  internalOrderBalance?: number;
  reservedBalance?: number;
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

    const ORDER_BALANCE_COLS = 'id, status, driver_id, seller_storefront_id, order_type, products_subtotal, delivery_distance_km, driver_amount, seller_amount, seller_payout_amount, driver_payout_amount, platform_fee_amount, delivery_fee_amount, payout_seller_done, payout_driver_done, pricing_snapshot';

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
          // Modelo novo: a loja já recebeu na própria subconta; não há repasse "a caminho"
          if (snapshotModel(order).model === 'SELLER_SPLIT') continue;
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

  // Repasses na fila em settlements (o gatilho do banco marca payout_*_done ao criar a linha,
  // então a consulta por flag acima não enxerga esses pedidos)
  try {
    const { data: pendRows } = await adminSupabase
      .from('settlements')
      .select('order_id, role, amount')
      .eq('partner_id', partnerId)
      .in('status', ['PENDING', 'FAILED', 'WAITING_ACCOUNT', 'PROCESSING'])
      .limit(200);
    const rows = (pendRows || []).filter((r: any) => !orderIds.includes(r.order_id));
    let splitIds = new Set<string>();
    if (rows.length > 0 && !isDriver) {
      const { data: os } = await adminSupabase.from('orders').select('id, pricing_snapshot').in('id', rows.map((r: any) => r.order_id));
      splitIds = new Set((os || []).filter((o: any) => snapshotModel(o).model === 'SELLER_SPLIT').map((o: any) => o.id));
    }
    for (const r of rows) {
      if (r.role === 'seller' && splitIds.has(r.order_id)) continue; // modelo novo: loja já recebeu
      const amt = Number(r.amount || 0);
      if (amt > 0) {
        totalDisponivel += amt;
        orderIds.push(r.order_id);
      }
    }
  } catch (pendErr) {
    console.warn('[partnerBalance] Aviso ao somar repasses na fila:', pendErr);
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

  // Reserva da loja no modelo novo (cobrança na subconta da loja):
  // - pedido pago e ainda não entregue: o valor recebido pelo split (pode ser estornado);
  // - pedido entregue com a corrida da moto ainda não paga: o valor da corrida.
  let reservedBalance = 0;
  if (!isDriver) {
    try {
      const { data: sfs } = await adminSupabase.from('storefronts').select('id').eq('partner_id', partnerId);
      const sfIds = (sfs || []).map((x: any) => x.id);
      if (sfIds.length > 0) {
        const notPaidOrClosed = ['PENDING', 'pendente', 'aguardando_pagamento', 'AWAITING_PAYMENT', 'CANCELLED', 'CANCELADO', 'REFUNDED', 'RECUSADO'];
        const deliveredStatuses = ['RECEIVED', 'received', 'entregue', 'arquivado', 'concluido', 'CONCLUIDO', 'ARQUIVADO', 'COMPLETED', 'completed'];
        const { data: splitOrders } = await adminSupabase
          .from('orders')
          .select('id, status, driver_id, driver_payout_amount, pricing_snapshot')
          .in('seller_storefront_id', sfIds)
          .eq('pricing_snapshot->>paymentModel', 'SELLER_SPLIT')
          .not('status', 'in', `(${notPaidOrClosed.map(x => `"${x}"`).join(',')})`)
          .limit(500);

        // Corrida só deixa de ser reservada quando o repasse da moto está DONE em settlements
        // (a flag payout_driver_done é marcada pelo gatilho do banco antes da transferência).
        const deliveredIds = (splitOrders || [])
          .filter((o: any) => deliveredStatuses.includes(String(o.status || '').trim()) && o.driver_id)
          .map((o: any) => o.id);
        const rideDone = new Set<string>();
        if (deliveredIds.length > 0) {
          const { data: rideRows } = await adminSupabase
            .from('settlements')
            .select('order_id, status')
            .in('order_id', deliveredIds)
            .eq('role', 'driver')
            .eq('status', 'DONE');
          for (const r of rideRows || []) rideDone.add(r.order_id);
        }

        for (const o of splitOrders || []) {
          const st = String(o.status || '').trim();
          if (deliveredStatuses.includes(st)) {
            if (o.driver_id && !rideDone.has(o.id)) reservedBalance += Math.max(0, Number(o.driver_payout_amount || 0));
          } else {
            const snap: any = o.pricing_snapshot || {};
            const net = snap.sellerSplitNet !== null && snap.sellerSplitNet !== undefined
              ? Number(snap.sellerSplitNet)
              : sellerNetFromPricing(snap);
            reservedBalance += Math.max(0, net);
          }
        }
      }
    } catch (resErr) {
      console.warn('[partnerBalance] Aviso ao calcular reserva da loja:', resErr);
    }
  }
  reservedBalance = Number(reservedBalance.toFixed(2));

  // Saldo disponível para saque = SOMENTE o saldo real da subconta Asaas (de onde o Pix sai),
  // menos a reserva dos pedidos em andamento (modelo novo).
  // Pedidos entregues ainda não repassados (internalOrderBalance) aparecem como "a caminho",
  // mas não entram no saque: só depois que o repasse Master -> subconta é confirmado.
  totalDisponivel = mirroredFromAsaas && subaccountBalance !== null ? Math.max(0, subaccountBalance - reservedBalance) : 0;

  return {
    totalDisponivel: Number(totalDisponivel.toFixed(2)),
    orderIds,
    quantidadePedidos: orderIds.length,
    mirroredFromAsaas,
    subaccountBalance: subaccountBalance !== null ? Number(subaccountBalance.toFixed(2)) : undefined,
    internalOrderBalance,
    reservedBalance
  };
}

export async function reconcilePartnerWithdrawals(partnerId?: string, _role?: string): Promise<void> {
  // Confirma no Asaas os saques em processamento. Não envia Pix e não mexe nos pedidos:
  // o repasse de cada pedido é controlado por settlements (payout_*_done).
  const adminSupabase = getSupabaseAdmin();
  try {
    let query = adminSupabase
      .from('withdrawal_requests')
      .select('id')
      .eq('status', 'PROCESSING');
    if (partnerId) query = query.eq('partner_id', partnerId);

    const { data: requests } = await query.limit(50);
    if (!requests || requests.length === 0) return;

    const { reconcileWithdrawal } = await import('@/lib/withdrawalApproval');
    for (const req of requests) {
      try {
        await reconcileWithdrawal(req.id);
      } catch (recErr) {
        console.warn(`[reconcilePartnerWithdrawals] Aviso ao confirmar saque #${req.id}:`, recErr);
      }
    }
  } catch (err) {
    console.warn('[reconcilePartnerWithdrawals] Aviso ao reconciliar saques:', err);
  }
}
