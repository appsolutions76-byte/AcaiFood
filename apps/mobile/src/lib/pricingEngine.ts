import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface PricingInput {
  orderType?: 'B2C' | 'B2B' | 'COLETA' | string;
  distanceKm?: number;
  cityName?: string | null;
  productsSubtotal?: number;
  sellerStorefrontId?: string | null;
  driverId?: string | null;
  freteSubsidyPct?: number;
}

export interface PricingResult {
  orderType: string;
  distanceKm: number;
  cityName: string | null;

  // Rates applied
  courierPaymentMode: 'KM' | 'FIXED';
  deliveryFeePerKm: number;
  deliveryFixedFee: number;
  platformSalesFeePercent: number;
  platformDeliveryFeePercent: number;

  // Financial breakdown
  productsSubtotal: number;
  deliveryTotal: number;
  clientDeliveryFee: number;
  storeDeliveryFee: number; // freteLoja (subsídio da loja)
  platformSalesFee: number;
  platformDeliveryFee: number;
  netSellerPayout: number;
  netDriverPayout: number;
  buyerTotal: number;
}

/**
 * Busca e mescla taxas de platform_settings com taxas específicas da cidade (cities.rates).
 */
export async function getMergedRatesForCity(cityName?: string | null, supabaseClient?: any): Promise<Record<string, any>> {
  const supabase = supabaseClient || getSupabaseAdmin();

  // 1. Buscar platform_settings
  const { data: globalSettings } = await supabase
    .from('platform_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  const baseRates: Record<string, any> = globalSettings || {};

  if (!cityName) {
    return baseRates;
  }

  const norm = (str?: string | null) => String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const targetName = norm(cityName);
  if (!targetName) return baseRates;

  // 2. Buscar cidade no banco para mesclar rates
  try {
    const { data: cities } = await supabase
      .from('cities')
      .select('id, name, rates, status');

    if (cities && cities.length > 0) {
      const match = cities.find((c: any) => norm(c.name) === targetName);
      if (match && match.rates && typeof match.rates === 'object' && Object.keys(match.rates).length > 0) {
        return { ...baseRates, ...match.rates };
      }
    }
  } catch (err) {
    console.warn('[pricingEngine] Aviso ao consultar tabela de cidades:', err);
  }

  return baseRates;
}

/**
 * Função autoritativa do servidor que calcula todos os totais, taxas e repasses de um pedido.
 */
export async function calculateOrderPricing(
  input: PricingInput,
  supabaseClient?: any
): Promise<PricingResult> {
  const supabase = supabaseClient || getSupabaseAdmin();
  const orderType = String(input.orderType || 'B2C').toUpperCase();
  const distKm = Math.max(0, Number(input.distanceKm || 0));
  const productsSubtotal = Math.max(0, Number(input.productsSubtotal || 0));

  // Buscar taxas mescladas (global + cidade)
  const rates = await getMergedRatesForCity(input.cityName, supabase);

  // Buscar subsídio da loja se storefrontId fornecido e freteSubsidyPct não informado
  let subsidyPct = Number(input.freteSubsidyPct ?? 0);
  if (input.sellerStorefrontId && input.freteSubsidyPct === undefined) {
    try {
      const { data: sf } = await supabase
        .from('storefronts')
        .select('frete_subsidy_pct')
        .eq('id', input.sellerStorefrontId)
        .maybeSingle();

      if (sf && sf.frete_subsidy_pct !== undefined && sf.frete_subsidy_pct !== null) {
        subsidyPct = Number(sf.frete_subsidy_pct || 0);
      }
    } catch (err) {
      console.warn('[pricingEngine] Erro ao buscar storefront para subsídio:', err);
    }
  }

  let paymentMode: 'KM' | 'FIXED' = 'KM';
  let feePerKm = 0;
  let fixedFee = 0;
  let platSalesFeePct = 10;
  let platDeliveryFeePct = 10;

  if (orderType === 'COLETA') {
    paymentMode = rates.ecopoint_payment_mode || rates.col_payment_mode || 'KM';
    fixedFee = Number(rates.ecopoint_fixed_fee ?? rates.col_fixed_price ?? rates.col_valor ?? 50.00);
    feePerKm = Number(rates.col_fee_per_km ?? rates.col_km ?? 8.00);
    platSalesFeePct = Number(rates.col_fee_percentage ?? rates.col_plat ?? 10);
    platDeliveryFeePct = Number(rates.col_platform_fee_percentage ?? rates.col_mot_plat ?? 10);
  } else if (orderType === 'B2B') {
    paymentMode = rates.transporter_payment_mode || rates.b2b_payment_mode || 'KM';
    fixedFee = Number(rates.transporter_fixed_fee ?? rates.b2b_km ?? 150.00);
    feePerKm = Number(rates.truck_fee_per_km ?? rates.b2b_km ?? 4.00);
    platSalesFeePct = Number(rates.b2b_fee_percentage ?? rates.b2b_plat ?? 10);
    platDeliveryFeePct = Number(rates.truck_platform_fee_percentage ?? rates.b2b_mot_plat ?? 10);
  } else {
    // B2C
    paymentMode = rates.courier_payment_mode || rates.b2c_payment_mode || 'KM';
    fixedFee = Number(rates.courier_fixed_fee ?? rates.b2c_km ?? 8.00);
    feePerKm = Number(rates.motoboy_fee_per_km ?? rates.b2c_km ?? 2.00);
    platSalesFeePct = Number(rates.b2c_fee_percentage ?? rates.b2c_plat ?? 10);
    platDeliveryFeePct = Number(rates.motoboy_platform_fee_percentage ?? rates.b2c_mot_plat ?? 10);
  }

  // Total de entrega
  let deliveryTotal = 0;
  if (distKm > 0 || paymentMode === 'FIXED') {
    if (paymentMode === 'FIXED') {
      deliveryTotal = fixedFee;
    } else {
      deliveryTotal = Number((distKm * feePerKm).toFixed(2));
    }
  }

  // Divisão do frete entre subsídio da loja e cliente
  const storeDeliveryFee = Number((deliveryTotal * (subsidyPct / 100)).toFixed(2));
  const clientDeliveryFee = Math.max(0, Number((deliveryTotal - storeDeliveryFee).toFixed(2)));

  // Taxa de venda e repasse do vendedor
  const platformSalesFee = Number((productsSubtotal * (platSalesFeePct / 100)).toFixed(2));
  const rawSellerVal = productsSubtotal * (1 - platSalesFeePct / 100) - storeDeliveryFee;
  const netSellerPayout = Number(Math.max(0, rawSellerVal).toFixed(2));

  // Taxa de entrega e repasse do motorista
  const platformDeliveryFee = Number((deliveryTotal * (platDeliveryFeePct / 100)).toFixed(2));
  const netDriverPayout = Number(Math.max(0, deliveryTotal * (1 - platDeliveryFeePct / 100)).toFixed(2));

  // Total final cobrado do comprador
  const buyerTotal = Number((productsSubtotal + clientDeliveryFee).toFixed(2));

  return {
    orderType,
    distanceKm: distKm,
    cityName: input.cityName || null,

    courierPaymentMode: paymentMode,
    deliveryFeePerKm: feePerKm,
    deliveryFixedFee: fixedFee,
    platformSalesFeePercent: platSalesFeePct,
    platformDeliveryFeePercent: platDeliveryFeePct,

    productsSubtotal,
    deliveryTotal,
    clientDeliveryFee,
    storeDeliveryFee,
    platformSalesFee,
    platformDeliveryFee,
    netSellerPayout,
    netDriverPayout,
    buyerTotal
  };
}
