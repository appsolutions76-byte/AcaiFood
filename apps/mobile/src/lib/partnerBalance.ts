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
  const isDriver = normalizedRole === 'motorista' || normalizedRole === 'motoboy' || normalizedRole === 'caminhao' || normalizedRole === 'courier';

  let orderIds: string[] = [];
  let totalDisponivel = 0;

  try {
    const validStatuses = ['DELIVERED', 'COMPLETED', 'RECEIVED', 'entregue', 'arquivado', 'concluido', 'CONCLUIDO', 'ARQUIVADO', 'received', 'delivered', 'completed', 'aguardando_cliente'];

    // 1. Se for motorista, busca em orders onde driver_id = partnerId e payout_driver_done = false ou null
    if (isDriver) {
      const { data: driverOrders, error: dErr } = await adminSupabase
        .from('orders')
        .select('id, order_type, products_subtotal, delivery_distance_km, seller_storefront_id, status, driver_amount, cidade_origem, payout_driver_done')
        .eq('driver_id', partnerId)
        .or('payout_driver_done.eq.false,payout_driver_done.is.null')
        .in('status', validStatuses);

      if (!dErr && driverOrders) {
        for (const o of driverOrders) {
          let netDriver = Number((o as any).driver_amount || 0);
          if (netDriver <= 0) {
            const pricing = await calculateOrderPricing({
              orderType: o.order_type,
              distanceKm: o.delivery_distance_km,
              cityName: (o as any).cidade_origem,
              productsSubtotal: o.products_subtotal,
              sellerStorefrontId: o.seller_storefront_id
            }, adminSupabase);
            netDriver = pricing.netDriverPayout;
          }

          if (netDriver > 0) {
            totalDisponivel += netDriver;
            orderIds.push(o.id);
          }
        }
      } else if (dErr) {
        console.warn('[partnerBalance] Erro ao consultar pedidos do motorista:', dErr);
      }
    } else {
      // 2. Se for loja ou fornecedor, busca pelo storefront_id vinculado ao partner_id OU pelo partner_id diretamente em seller_storefront_id
      const { data: storefronts } = await adminSupabase
        .from('storefronts')
        .select('id, frete_subsidy_pct')
        .eq('partner_id', partnerId);

      const sfIds = storefronts ? storefronts.map(s => s.id) : [];
      const validStorefrontOrUserIds = Array.from(new Set([...sfIds, partnerId]));

      const { data: sellerOrders, error: sErr } = await adminSupabase
        .from('orders')
        .select('id, seller_storefront_id, buyer_id, order_type, products_subtotal, delivery_distance_km, status, seller_amount, cidade_origem, payout_seller_done')
        .or('payout_seller_done.eq.false,payout_seller_done.is.null')
        .in('status', validStatuses)
        .in('seller_storefront_id', validStorefrontOrUserIds);

      if (!sErr && sellerOrders) {
        for (const o of sellerOrders) {
          let netSeller = Number((o as any).seller_amount || 0);
          if (netSeller <= 0) {
            const pricing = await calculateOrderPricing({
              orderType: o.order_type,
              distanceKm: o.delivery_distance_km,
              cityName: (o as any).cidade_origem,
              productsSubtotal: o.products_subtotal,
              sellerStorefrontId: o.seller_storefront_id
            }, adminSupabase);
            netSeller = pricing.netSellerPayout;
          }

          if (netSeller > 0) {
            totalDisponivel += netSeller;
            orderIds.push(o.id);
          }
        }
      } else if (sErr) {
        console.warn('[partnerBalance] Erro ao consultar pedidos do vendedor:', sErr);
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
