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
  // Asaas fee split breakdown
  asaasFeeSplitActors: number;
  asaasPixFeeFixed: number;
  asaasFeeSeller: number;
  asaasFeeDriver: number;
  asaasFeePlatform: number;

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

  // Configuracao de rateio do Asaas (1, 2 ou 3 atores)
  const rawActors = Number(rates.asaas_fee_split_actors ?? rates.asaas_actors ?? 1);
  const asaasFeeSplitActors = [1, 2, 3].includes(rawActors) ? rawActors : 1;
  const asaasPixFeeFixed = Math.max(0, Number(rates.asaas_pix_fee_fixed ?? 0.99));

  let asaasFeeSeller = 0;
  let asaasFeeDriver = 0;
  let asaasFeePlatform = asaasPixFeeFixed;

  if (asaasFeeSplitActors === 2) {
    asaasFeeSeller = Number((asaasPixFeeFixed / 2).toFixed(2));
    asaasFeeDriver = 0;
    asaasFeePlatform = Number((asaasPixFeeFixed - asaasFeeSeller).toFixed(2));
  } else if (asaasFeeSplitActors === 3) {
    asaasFeeSeller = Number((asaasPixFeeFixed / 3).toFixed(2));
    asaasFeeDriver = Number((asaasPixFeeFixed / 3).toFixed(2));
    asaasFeePlatform = Number((asaasPixFeeFixed - asaasFeeSeller - asaasFeeDriver).toFixed(2));
  }

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
    const rawMode = String(rates.ecopoint_payment_mode || rates.col_payment_mode || 'FIXED').toUpperCase();
    paymentMode = rawMode === 'FIXED' ? 'FIXED' : 'KM';
    fixedFee = Number(rates.ecopoint_fixed_fee ?? rates.col_fixed_price ?? rates.col_valor ?? rates.col_km ?? 50.00);
    feePerKm = Number(rates.col_km ?? rates.col_fee_per_km ?? 8.00);
    platSalesFeePct = Number(rates.col_plat ?? rates.col_fee_percentage ?? 10);
    platDeliveryFeePct = Number(rates.col_mot_plat ?? rates.col_platform_fee_percentage ?? 10);
  } else if (orderType === 'B2B') {
    const rawMode = String(rates.transporter_payment_mode || rates.b2b_payment_mode || 'FIXED').toUpperCase();
    paymentMode = rawMode === 'FIXED' ? 'FIXED' : 'KM';
    fixedFee = Number(rates.transporter_fixed_fee ?? rates.b2b_km ?? 150.00);
    feePerKm = Number(rates.b2b_km ?? rates.truck_fee_per_km ?? 4.00);
    platSalesFeePct = Number(rates.b2b_plat ?? rates.b2b_fee_percentage ?? 10);
    platDeliveryFeePct = Number(rates.b2b_mot_plat ?? rates.truck_platform_fee_percentage ?? 10);
  } else {
    // B2C
    const rawMode = String(rates.courier_payment_mode || rates.b2c_payment_mode || 'FIXED').toUpperCase();
    paymentMode = rawMode === 'FIXED' ? 'FIXED' : 'KM';
    fixedFee = Number(rates.courier_fixed_fee ?? rates.b2c_km ?? 4.00);
    feePerKm = Number(rates.b2c_km ?? rates.motoboy_fee_per_km ?? 4.00);
    platSalesFeePct = Number(rates.b2c_plat ?? rates.b2c_fee_percentage ?? 15);
    platDeliveryFeePct = Number(rates.b2c_mot_plat ?? rates.motoboy_platform_fee_percentage ?? 12);
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

  // Taxa de venda e repasse do vendedor (descontando fatia do Asaas se aplicável)
  const platformSalesFee = Number((productsSubtotal * (platSalesFeePct / 100)).toFixed(2));
  const rawSellerVal = productsSubtotal * (1 - platSalesFeePct / 100) - storeDeliveryFee - asaasFeeSeller;
  const netSellerPayout = Number(Math.max(0, rawSellerVal).toFixed(2));

  // Taxa de entrega e repasse do motorista (descontando fatia do Asaas se aplicável)
  const platformDeliveryFee = Number((deliveryTotal * (platDeliveryFeePct / 100)).toFixed(2));
  const rawDriverVal = deliveryTotal * (1 - platDeliveryFeePct / 100) - asaasFeeDriver;
  const netDriverPayout = Number(Math.max(0, rawDriverVal).toFixed(2));

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

    asaasFeeSplitActors,
    asaasPixFeeFixed,
    asaasFeeSeller,
    asaasFeeDriver,
    asaasFeePlatform,

    netSellerPayout,
    netDriverPayout,
    buyerTotal
  };
}

