import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface PartnerBalanceResult {
  totalDisponivel: number;
  orderIds: string[];
  quantidadePedidos: number;
}

export async function getPartnerAvailableBalance(partnerId: string, role: string): Promise<PartnerBalanceResult> {
  const adminSupabase = getSupabaseAdmin();
  const normalizedRole = String(role || '').toLowerCase().trim();
  const isDriver = normalizedRole === 'motorista' || normalizedRole === 'motoboy' || normalizedRole === 'caminhao' || normalizedRole === 'courier';
  const isSupplier = normalizedRole === 'fornecedor' || normalizedRole === 'supplier';
  const isStore = normalizedRole === 'loja' || normalizedRole === 'partner' || normalizedRole === 'batedeira';

  let orderIds: string[] = [];
  let totalDisponivel = 0;

  try {
    // 1. Se for motorista, busca em orders onde driver_id = partnerId e payout_driver_done = false
    if (isDriver) {
      const { data: driverOrders, error: dErr } = await adminSupabase
        .from('orders')
        .select('id, order_type, products_subtotal, delivery_distance_km, applied_delivery_fee_per_km, applied_delivery_platform_fee_percent, status')
        .eq('driver_id', partnerId)
        .eq('payout_driver_done', false)
        .in('status', ['DELIVERED', 'COMPLETED', 'RECEIVED', 'entregue']);

      if (!dErr && driverOrders) {
        driverOrders.forEach(o => {
          const type = (o.order_type || 'B2C').toUpperCase();
          const dist = Number(o.delivery_distance_km || 0);
          const feePerKm = Number(o.applied_delivery_fee_per_km || (type === 'B2B' ? 4 : (type === 'COLETA' ? 8 : 2)));
          const platFeePct = Number(o.applied_delivery_platform_fee_percent || 15);
          
          let deliveryTotal = dist * feePerKm;
          if (type === 'COLETA' && Number(o.products_subtotal) > 0) {
            deliveryTotal = Number(o.products_subtotal);
          }
          if (deliveryTotal <= 0 && Number(o.products_subtotal) > 0) {
            deliveryTotal = Number(o.products_subtotal);
          }

          const platformFee = Number((deliveryTotal * (platFeePct / 100)).toFixed(2));
          const netDriver = Math.max(0, Number((deliveryTotal - platformFee).toFixed(2)));

          if (netDriver > 0) {
            totalDisponivel += netDriver;
            orderIds.push(o.id);
          }
        });
      }
    } else {
      // 2. Se for loja ou fornecedor, busca pelo storefront_id vinculado ao partner_id
      const { data: storefronts } = await adminSupabase
        .from('storefronts')
        .select('id')
        .eq('partner_id', partnerId);

      const sfIds = storefronts ? storefronts.map(s => s.id) : [];

      if (sfIds.length > 0 || isStore || isSupplier) {
        let query = adminSupabase
          .from('orders')
          .select('id, seller_storefront_id, buyer_id, order_type, products_subtotal, delivery_distance_km, applied_platform_fee_percent, applied_delivery_fee_per_km, status')
          .eq('payout_seller_done', false)
          .in('status', ['DELIVERED', 'COMPLETED', 'RECEIVED', 'entregue']);

        if (sfIds.length > 0) {
          query = query.in('seller_storefront_id', sfIds);
        } else {
          query = query.eq('buyer_id', partnerId);
        }

        const { data: sellerOrders, error: sErr } = await query;

        if (!sErr && sellerOrders) {
          sellerOrders.forEach(o => {
            const subtotal = Number(o.products_subtotal || 0);
            const platPct = Number(o.applied_platform_fee_percent || 10);
            const platSales = Number((subtotal * (platPct / 100)).toFixed(2));
            const netSeller = Math.max(0, Number((subtotal - platSales).toFixed(2)));

            if (netSeller > 0) {
              totalDisponivel += netSeller;
              orderIds.push(o.id);
            }
          });
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
