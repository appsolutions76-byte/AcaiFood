"use client";

import React from 'react';
import { computeFreight } from '@/lib/freightCalc';

/**
 * R36 — Campos da modalidade "Mínima + km" no painel de taxas (por cidade ou padrão geral).
 * prefix: 'courier' (motoboy), 'transporter' (caminhão) ou 'ecopoint' (caçamba/coleta).
 */
export function MinKmFreightFields({
  prefix,
  rates,
  onChange,
  defaults
}: {
  prefix: 'courier' | 'transporter' | 'ecopoint';
  rates: any;
  onChange: (patch: Record<string, number>) => void;
  defaults: { minFee: number; minKm: number; extraKmFee: number };
}) {
  const kMin = `${prefix}_min_fee`;
  const kKm = `${prefix}_min_km`;
  const kExtra = `${prefix}_extra_km_fee`;
  const minFee = Number(rates?.[kMin] ?? defaults.minFee);
  const minKm = Number(rates?.[kKm] ?? defaults.minKm);
  const extraKmFee = Number(rates?.[kExtra] ?? defaults.extraKmFee);
  const params = { mode: 'MIN_KM' as const, fixedFee: 0, perKm: 0, minFee, minKm, extraKmFee };
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const input = 'w-full border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500';
  const label = 'text-[10px] uppercase text-emerald-700 dark:text-emerald-400 font-bold';

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 p-3 space-y-3">
      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
        <strong>Mínima + km:</strong> a taxa mínima cobre os primeiros km; acima disso soma o valor por km só do que passar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={label}>Taxa mínima (R$)</label>
          <input type="number" step="0.1" min={0} value={minFee} onChange={e => onChange({ [kMin]: Number(e.target.value) })} className={input} />
        </div>
        <div>
          <label className={label}>Km incluídos na mínima</label>
          <input type="number" step="0.5" min={0} value={minKm} onChange={e => onChange({ [kKm]: Number(e.target.value) })} className={input} />
        </div>
        <div>
          <label className={label}>R$ por km excedente</label>
          <input type="number" step="0.1" min={0} value={extraKmFee} onChange={e => onChange({ [kExtra]: Number(e.target.value) })} className={input} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="text-zinc-500 font-bold">Simulação:</span>
        {[1, 3, 5, 10].map(km => (
          <span key={km} className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {km} km = <strong>{fmt(computeFreight(params, km))}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default MinKmFreightFields;
