export interface PayoutSettings {
  courier_payment_mode?: string;
  courier_fixed_fee?: number;
  transporter_payment_mode?: string;
  transporter_fixed_fee?: number;
  ecopoint_payment_mode?: string;
  ecopoint_fixed_fee?: number;
  [key: string]: any;
}

export interface PayoutOrder {
  id: string;
  order_type?: string;
  products_subtotal?: number;
  delivery_distance_km?: number;
  applied_delivery_fee_per_km?: number;
  applied_platform_fee_percent?: number;
  applied_delivery_platform_fee_percent?: number;
  seller_storefront_id?: string;
  driver_id?: string;
  delivery_city?: string;
  city?: string;
  cidade?: string;
  [key: string]: any;
}

export function calculateOrderDeliveryTotal(order: PayoutOrder, settings?: PayoutSettings): number {
  const orderType = String(order.order_type || 'B2C').toUpperCase();
  const courierMode = String(settings?.courier_payment_mode || 'FIXED').toUpperCase();
  const courierFixed = Number(settings?.courier_fixed_fee ?? 4.00);
  const transporterMode = String(settings?.transporter_payment_mode || 'FIXED').toUpperCase();
  const transporterFixed = Number(settings?.transporter_fixed_fee ?? 4.00);
  const ecopointMode = String(settings?.ecopoint_payment_mode || 'FIXED').toUpperCase();
  const ecopointFixed = Number(settings?.ecopoint_fixed_fee ?? 7.50);

  const distKm = Math.max(0, Number(order.delivery_distance_km || 0));
  const feePerKm = Number(order.applied_delivery_fee_per_km || 0);

  if (orderType === 'COLETA') {
    return ecopointMode === 'FIXED' ? ecopointFixed : Number((distKm * (feePerKm || 8.00)).toFixed(2));
  } else if (orderType === 'B2B') {
    return transporterMode === 'FIXED' ? transporterFixed : Number((distKm * (feePerKm || 4.00)).toFixed(2));
  } else {
    return courierMode === 'FIXED' ? courierFixed : Number((distKm * (feePerKm || 4.00)).toFixed(2));
  }
}

export function calculateSellerPayout(
  order: PayoutOrder,
  freteSubsidyPct: number = 0,
  settings?: PayoutSettings
): number {
  const deliveryTotal = calculateOrderDeliveryTotal(order, settings);
  const freteLoja = deliveryTotal * (freteSubsidyPct / 100);
  const productSubtotal = Math.max(0, Number(order.products_subtotal || 0));
  const platformFee = Number(order.applied_platform_fee_percent ?? 10);
  const rawSellerValue = productSubtotal * (1 - platformFee / 100) - freteLoja;
  return Number(Math.max(0, rawSellerValue).toFixed(2));
}

export function calculateDriverPayout(
  order: PayoutOrder,
  settings?: PayoutSettings
): number {
  const deliveryTotal = calculateOrderDeliveryTotal(order, settings);
  const platPct = Number(order.applied_delivery_platform_fee_percent ?? 10);
  return Number(Math.max(0, deliveryTotal * (1 - platPct / 100)).toFixed(2));
}

