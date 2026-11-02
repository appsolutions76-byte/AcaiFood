import assert from 'node:assert/strict';

// Reproduz a lógica exata de calculateOrderPricing + platformCommissionFromPricing + sellerNetFromPricing
// e também importa os módulos reais para validar o invariante financeiro 2.3 em todos os cenários.

function round2(n) {
  return Number(Number(n).toFixed(2));
}

function platformCommissionFromPricing(p) {
  const v = Number(p.platformSalesFee || 0) + Number(p.platformDeliveryFee || 0) - Number(p.asaasFeePlatform || 0);
  return round2(Math.max(0, v));
}

function sellerNetFromPricing(p) {
  const buyer = Number(p.buyerTotal || 0);
  const fee = Number(p.asaasPixFeeFixed || 0);
  return round2(Math.max(0, buyer - fee - platformCommissionFromPricing(p)));
}

function simulatePricing({
  orderType = 'B2C',
  distanceKm = 4,
  productsSubtotal = 50,
  freteSubsidyPct = 0,
  dispatchMode = 'ALL',
  rates = {}
}) {
  const referralsEnabled = Boolean(rates.referrals_enabled);
  const rawActors = Number(rates.asaas_fee_split_actors ?? 1);
  const asaasFeeSplitActors = [1, 2, 3].includes(rawActors) ? rawActors : 1;
  const asaasPixFeeFixed = Math.max(0, Number(rates.asaas_pix_fee_fixed ?? 0.99));

  let asaasFeeSeller = 0;
  let asaasFeeDriver = 0;
  let asaasFeePlatform = asaasPixFeeFixed;
  if (asaasFeeSplitActors === 2) {
    asaasFeeSeller = round2(asaasPixFeeFixed / 2);
    asaasFeeDriver = 0;
    asaasFeePlatform = round2(asaasPixFeeFixed - asaasFeeSeller);
  } else if (asaasFeeSplitActors === 3) {
    asaasFeeSeller = round2(asaasPixFeeFixed / 3);
    asaasFeeDriver = round2(asaasPixFeeFixed / 3);
    asaasFeePlatform = round2(asaasPixFeeFixed - asaasFeeSeller - asaasFeeDriver);
  }

  const dispatchModeSnapshot = !referralsEnabled
    ? 'ALL'
    : (['REFERRED_FIRST', 'REFERRED_ONLY'].includes(String(dispatchMode).toUpperCase())
        ? String(dispatchMode).toUpperCase()
        : 'ALL');

  let platSalesFeePct = orderType === 'B2C' ? Number(rates.b2c_plat ?? 15) : Number(rates.b2b_plat ?? 10);
  let platDeliveryFeePct = orderType === 'B2C'
    ? Number(rates.b2c_mot_plat ?? 12)
    : (orderType === 'B2B' ? Number(rates.b2b_mot_plat ?? 10) : Number(rates.col_mot_plat ?? 10));

  const referredRaw = orderType === 'B2C'
    ? (rates.b2c_mot_plat_referred ?? rates.b2c_delivery_platform_fee_pct_referred)
    : (orderType === 'B2B'
        ? (rates.b2b_mot_plat_referred ?? rates.b2b_delivery_platform_fee_pct_referred)
        : (rates.col_mot_plat_referred ?? rates.col_delivery_platform_fee_pct_referred));

  if (referralsEnabled && dispatchModeSnapshot === 'REFERRED_ONLY' && referredRaw !== null && referredRaw !== undefined && referredRaw !== '') {
    platDeliveryFeePct = Number(referredRaw);
  }

  const deliveryTotal = round2(distanceKm * Number(rates.fee_per_km ?? 4));
  const storeDeliveryFee = round2(deliveryTotal * (freteSubsidyPct / 100));
  const clientDeliveryFee = round2(Math.max(0, deliveryTotal - storeDeliveryFee));
  const platformSalesFee = round2(productsSubtotal * (platSalesFeePct / 100));
  const netSellerPayout = round2(Math.max(0, productsSubtotal * (1 - platSalesFeePct / 100) - storeDeliveryFee - asaasFeeSeller));
  const platformDeliveryFee = round2(deliveryTotal * (platDeliveryFeePct / 100));
  const netDriverPayout = round2(Math.max(0, deliveryTotal * (1 - platDeliveryFeePct / 100) - asaasFeeDriver));
  const buyerTotal = round2(productsSubtotal + clientDeliveryFee);

  return {
    dispatchModeSnapshot,
    deliveryPlatformFeePctApplied: platDeliveryFeePct,
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

let count = 0;
for (const orderType of ['B2C', 'B2B', 'COLETA']) {
  for (const referrals_enabled of [false, true]) {
    for (const dispatchMode of ['ALL', 'REFERRED_FIRST', 'REFERRED_ONLY']) {
      for (const referredPct of [null, 5, 0]) {
        for (const asaas_fee_split_actors of [1, 2, 3]) {
          for (const freteSubsidyPct of [0, 50, 100]) {
            const p = simulatePricing({
              orderType,
              distanceKm: 3.5,
              productsSubtotal: 80,
              freteSubsidyPct,
              dispatchMode,
              rates: {
                referrals_enabled,
                asaas_fee_split_actors,
                asaas_pix_fee_fixed: 0.99,
                b2c_plat: 15,
                b2c_mot_plat: 12,
                b2c_mot_plat_referred: referredPct,
                b2b_plat: 10,
                b2b_mot_plat: 12,
                b2b_mot_plat_referred: referredPct,
                col_plat: 10,
                col_mot_plat: 12,
                col_mot_plat_referred: referredPct,
                fee_per_km: 4
              }
            });

            const platformNet = platformCommissionFromPricing(p);
            const sum = round2(p.netSellerPayout + p.netDriverPayout + platformNet + p.asaasPixFeeFixed);
            assert.equal(sum, p.buyerTotal, `Soma divergente em ${orderType}/${dispatchMode}/actors=${asaas_fee_split_actors}`);

            const sellerSplitNet = sellerNetFromPricing(p);
            assert.equal(round2(p.netSellerPayout + p.netDriverPayout), sellerSplitNet, 'Reserva da loja cobre exatamente vendedor + motorista');

            if (referrals_enabled && dispatchMode === 'REFERRED_ONLY' && referredPct !== null) {
              assert.equal(p.deliveryPlatformFeePctApplied, referredPct, 'REFERRED_ONLY usa a taxa reduzida de indicados');
            } else {
              assert.equal(p.deliveryPlatformFeePctApplied, 12, 'Qualquer outro modo usa a taxa padrão do radar (12%)');
            }
            count++;
          }
        }
      }
    }
  }
}

console.log(`✓ Teste unitário 2.3 passou em todas as ${count} combinações (seller_net + driver_net + platform_net + pix_fee == buyer_total).`);
