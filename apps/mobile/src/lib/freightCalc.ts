/**
 * Cálculo do frete (R36) — compartilhado entre o servidor (pricingEngine) e as telas do app.
 *
 * Modalidades:
 * - FIXED  : valor fixo por entrega.
 * - KM     : km rodado × valor por km.
 * - MIN_KM : "Mínima + km" — taxa mínima cobre os primeiros N km; acima disso soma
 *            o valor por km só do que passar (ex.: R$ 6 até 3 km; 5 km = 6 + 2 × 1,50 = R$ 9).
 */

export type FreightMode = 'KM' | 'FIXED' | 'MIN_KM';

export interface FreightParams {
  mode: FreightMode;
  fixedFee: number;
  perKm: number;
  minFee: number;
  minKm: number;
  extraKmFee: number;
}

const num = (v: any, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export function parseFreightMode(raw: any, fallback: FreightMode = 'FIXED'): FreightMode {
  const m = String(raw || '').toUpperCase().trim();
  if (m === 'FIXED' || m === 'KM' || m === 'MIN_KM') return m;
  return fallback;
}

/** Lê os parâmetros do frete de um tipo de pedido a partir das taxas (globais + cidade). */
export function getFreightParams(orderType: string, rates: any = {}): FreightParams {
  const t = String(orderType || 'B2C').toUpperCase();
  if (t === 'COLETA') {
    const fixedFee = num(rates.ecopoint_fixed_fee ?? rates.col_fixed_price ?? rates.col_valor, 50);
    const perKm = num(rates.col_km ?? rates.col_fee_per_km, 8);
    return {
      mode: parseFreightMode(rates.ecopoint_payment_mode ?? rates.col_payment_mode, 'FIXED'),
      fixedFee,
      perKm,
      minFee: num(rates.ecopoint_min_fee, fixedFee > 0 ? fixedFee : 50),
      minKm: num(rates.ecopoint_min_km, 3),
      extraKmFee: num(rates.ecopoint_extra_km_fee, perKm > 0 ? perKm : 8)
    };
  }
  if (t === 'B2B') {
    const fixedFee = num(rates.transporter_fixed_fee ?? rates.b2b_km, 150);
    const perKm = num(rates.b2b_km ?? rates.truck_fee_per_km, 4);
    return {
      mode: parseFreightMode(rates.transporter_payment_mode ?? rates.b2b_payment_mode, 'FIXED'),
      fixedFee,
      perKm,
      minFee: num(rates.transporter_min_fee, fixedFee > 0 ? fixedFee : 150),
      minKm: num(rates.transporter_min_km, 3),
      extraKmFee: num(rates.transporter_extra_km_fee, perKm > 0 ? perKm : 4)
    };
  }
  const fixedFee = num(rates.courier_fixed_fee ?? rates.b2c_km, 4);
  const perKm = num(rates.b2c_km ?? rates.motoboy_fee_per_km, 4);
  return {
    mode: parseFreightMode(rates.courier_payment_mode ?? rates.b2c_payment_mode, 'FIXED'),
    fixedFee,
    perKm,
    minFee: num(rates.courier_min_fee, 6),
    minKm: num(rates.courier_min_km, 3),
    extraKmFee: num(rates.courier_extra_km_fee, 1.5)
  };
}

/** Valor total do frete para a distância informada. */
export function computeFreight(params: FreightParams, distanceKm: number): number {
  const dist = Math.max(0, Number(distanceKm) || 0);
  if (params.mode === 'FIXED') {
    return Number(Math.max(0, params.fixedFee).toFixed(2));
  }
  if (params.mode === 'MIN_KM') {
    const minFee = Math.max(0, params.minFee);
    const minKm = Math.max(0, params.minKm);
    const extra = Math.max(0, dist - minKm) * Math.max(0, params.extraKmFee);
    return Number((minFee + extra).toFixed(2));
  }
  return Number((dist * Math.max(0, params.perKm)).toFixed(2));
}

export function freightModeLabel(mode: FreightMode): string {
  if (mode === 'FIXED') return 'Valor Fixo';
  if (mode === 'MIN_KM') return 'Mínima + km';
  return 'Estimativa por KM';
}
