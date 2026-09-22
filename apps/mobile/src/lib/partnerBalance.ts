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
    const invalidStatuses = ['CANCELLED', 'CANCELADO', 'REFUNDED', 'RECUSADO', 'PIN_LOCKED', 'aguardando_pagamento'];
    const validStatuses = [
      'DELIVERED', 'COMPLETED', 'RECEIVED', 'entregue', 'arquivado', 'concluido', 'CONCLUIDO', 'ARQUIVADO',
      'received', 'delivered', 'completed', 'aguardando_cliente', 'PAID', 'CONFIRMED', 'PREPARING', 'PREPARANDO',
      'preparo', 'pronto', 'PRONTO', 'em_transito', 'em_trânsito', 'aguardando_retirada', 'aguardando_loja',
      'aguardando_motorista', 'aguardando_coleta', 'PENDING', 'pendente', 'paid', 'confirmed', 'preparing'
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
            if (!invalidStatuses.includes(st) && !order.payout_driver_done) {
              matchedOrdersMap.set(order.id, order);
            }
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        let netDriver = Number((o as any).driver_amount || (o as any).driver_payout || 0);
        if (netDriver <= 0) {
          const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
          const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
          const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

          const pricing = await calculateOrderPricing({
            orderType: o.order_type || (o as any).type || 'B2C',
            distanceKm,
            cityName,
            productsSubtotal,
            sellerStorefrontId: o.seller_storefront_id
          }, adminSupabase);

          netDriver = pricing.netDriverPayout;
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
            if (!invalidStatuses.includes(st) && !order.payout_seller_done) {
              matchedOrdersMap.set(order.id, order);
            }
          }
        }
      }

      for (const o of matchedOrdersMap.values()) {
        let netSeller = Number((o as any).seller_amount || (o as any).seller_payout || 0);
        if (netSeller <= 0) {
          const productsSubtotal = Number((o as any).products_subtotal ?? (o as any).valor ?? (o as any).total_value ?? (o as any).subtotal ?? (o as any).price ?? 0);
          const distanceKm = Number((o as any).delivery_distance_km ?? (o as any).distancia ?? (o as any).distance ?? 0);
          const cityName = (o as any).cidade_origem || (o as any).cidade || (o as any).delivery_city || (o as any).city || null;

          const pricing = await calculateOrderPricing({
            orderType: o.order_type || (o as any).type || 'B2C',
            distanceKm,
            cityName,
            productsSubtotal,
            sellerStorefrontId: o.seller_storefront_id
          }, adminSupabase);

          netSeller = pricing.netSellerPayout;
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
