export interface PayoutSettings {
  courier_payment_mode?: string;
  courier_fixed_fee?: number;
  transporter_payment_mode?: string;
  transporter_fixed_fee?: number;
  ecopoint_payment_mode?: string;
  ecopoint_fixed_fee?: number;
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
  [key: string]: any;
}

export function calculateOrderDeliveryTotal(order: PayoutOrder, settings?: PayoutSettings): number {
  const orderType = String(order.order_type || 'B2C').toUpperCase();
  const courierMode = settings?.courier_payment_mode || 'KM';
  const courierFixed = Number(settings?.courier_fixed_fee ?? 8.00);
  const transporterMode = settings?.transporter_payment_mode || 'KM';
  const transporterFixed = Number(settings?.transporter_fixed_fee ?? 150.00);
  const ecopointMode = settings?.ecopoint_payment_mode || 'KM';
  const ecopointFixed = Number(settings?.ecopoint_fixed_fee ?? 50.00);

  const distKm = Number(order.delivery_distance_km || 0);
  const feePerKm = Number(order.applied_delivery_fee_per_km || 0);

  if (distKm <= 0 && feePerKm <= 0) return 0;

  if (orderType === 'COLETA') {
    return ecopointMode === 'FIXED' ? ecopointFixed : distKm * feePerKm;
  } else if (orderType === 'B2B') {
    return transporterMode === 'FIXED' ? transporterFixed : distKm * feePerKm;
  } else {
    return courierMode === 'FIXED' ? courierFixed : distKm * feePerKm;
  }
}

export function calculateSellerPayout(
  order: PayoutOrder,
  freteSubsidyPct: number = 0,
  settings?: PayoutSettings
): number {
  const deliveryTotal = calculateOrderDeliveryTotal(order, settings);
  const freteLoja = deliveryTotal * (freteSubsidyPct / 100);
  const productSubtotal = Number(order.products_subtotal || 0);
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
