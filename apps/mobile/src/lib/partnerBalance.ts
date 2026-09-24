import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateOrderPricing } from '@/lib/pricingEngine';

export interface PartnerBalanceResult {
  totalDisponivel: number;
  orderIds: string[];
  quantidadePedidos: number;
}

export async function getPartnerAvailableBalance(partnerId: string, role: string): Promise<PartnerBalanceResult> {
  const adminSupabase = getSupabaseAdmin();
  const normalizedRole = String(role || '').toLowerCase().trim();
  const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(normalizedRole);

  let orderIds: string[] = [];
  let totalDisponivel = 0;

  try {
    const invalidStatuses = ['CANCELLED', 'CANCELADO', 'REFUNDED', 'RECUSADO', 'PIN_LOCKED', 'aguardando_pagamento', 'PENDING', 'pendente', 'PAID', 'paid', 'CONFIRMED', 'confirmed', 'PREPARING', 'preparing', 'preparo', 'pronto', 'PRONTO'];
    // Saldo para saque é liberado ESTRITAMENTE após a entrega concluída via validação de PIN
    const validStatuses = [
      'DELIVERED', 'COMPLETED', 'RECEIVED', 'entregue', 'arquivado', 'concluido', 'CONCLUIDO', 'ARQUIVADO',
      'received', 'delivered', 'completed'
    ];

    const matchedOrdersMap = new Map<string, any>();

    if (isDriver) {
      // 1. Motorista / Motoboy / Caminhão: consultar orders por driver_id ou motorista_id
      const queries = [
        adminSupabase.from('orders').select('*').eq('driver_id', partnerId).or('payout_driver_done.eq.false,payout_driver_done.is.null').in('status', validStatuses),
        adminSupabase.from('orders').select('*').eq('motorista_id', partnerId).or('payout_driver_done.eq.false,payout_driver_done.is.null').in('status', validStatuses),
      ];

      const results = await Promise.allSettled(queries);
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.data) {
          for (const order of res.value.data) {
            const st = String(order.status || '').trim();
            if (validStatuses.includes(st) && !order.payout_driver_done) {
              matchedOrdersMap.set(order.id, order);
            }
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
        const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
        const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

        let netDriver = 0;
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
          netDriver = Number((o as any).driver_amount || (o as any).driver_payout || 0);
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

      const queries = [
        adminSupabase.from('orders').select('*').in('seller_storefront_id', validIds).or('payout_seller_done.eq.false,payout_seller_done.is.null').in('status', validStatuses),
        adminSupabase.from('orders').select('*').in('loja_id', validIds).or('payout_seller_done.eq.false,payout_seller_done.is.null').in('status', validStatuses),
        adminSupabase.from('orders').select('*').in('fornecedor_id', validIds).or('payout_seller_done.eq.false,payout_seller_done.is.null').in('status', validStatuses),
        adminSupabase.from('orders').select('*').in('origem_id', validIds).or('payout_seller_done.eq.false,payout_seller_done.is.null').in('status', validStatuses),
      ];

      const results = await Promise.allSettled(queries);
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.data) {
          for (const order of res.value.data) {
            const st = String(order.status || '').trim();
            if (validStatuses.includes(st) && !order.payout_seller_done) {
              matchedOrdersMap.set(order.id, order);
            }
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
        const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
        const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

        let netSeller = 0;
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
          netSeller = Number((o as any).seller_amount || (o as any).seller_payout || 0);
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

  totalDisponivel = Number(totalDisponivel.toFixed(2));
  return {
    totalDisponivel,
    orderIds,
    quantidadePedidos: orderIds.length
  };
}

export async function reconcilePartnerWithdrawals(partnerId: string, role: string): Promise<void> {
  const adminSupabase = getSupabaseAdmin();
  try {
    const normalizedRole = String(role || '').toLowerCase().trim();
    const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(normalizedRole);

    const { data: requests } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, status, order_ids, created_at')
      .eq('partner_id', partnerId)
      .in('status', ['FALHOU', 'PENDENTE']);

    if (!requests || requests.length === 0) return;

    for (const req of requests) {
      if (Array.isArray(req.order_ids) && req.order_ids.length > 0) {
        const { data: checkOrders } = await adminSupabase
          .from('orders')
          .select('id, payout_seller_done, payout_driver_done')
          .in('id', req.order_ids);

        if (checkOrders && checkOrders.length > 0) {
          const allPaid = checkOrders.every((o: any) => isDriver ? o.payout_driver_done : o.payout_seller_done);
          if (allPaid) {
            await adminSupabase
              .from('withdrawal_requests')
              .update({
                status: 'PAGO',
                failure_reason: null,
                paid_at: new Date().toISOString()
              })
              .eq('id', req.id);
          }
        }
      } else {
        const bal = await getPartnerAvailableBalance(partnerId, role);
        if (bal.totalDisponivel === 0) {
          await adminSupabase
            .from('withdrawal_requests')
            .update({
              status: 'PAGO',
              failure_reason: null,
              paid_at: new Date().toISOString()
            })
            .eq('id', req.id);
        }
      }
    }
  } catch (err) {
    console.warn("[reconcilePartnerWithdrawals] Aviso ao reconciliar saques:", err);
  }
}
