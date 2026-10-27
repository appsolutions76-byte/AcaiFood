"use client";

import React from 'react';

/**
 * Situação do estorno de um pedido (R28), para cliente, loja/fornecedor e admin.
 * - Estorno concluído: valor, data/hora e link do comprovante do Asaas.
 * - Estorno em processamento.
 * - Estorno não concluído: só enquanto o pedido ainda pode ser cancelado.
 */

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

// Status em que o pedido ainda pode ser cancelado (cliente: até o preparo; loja: até ficar pronto)
const CANCELLABLE: Record<'cliente' | 'loja' | 'admin', string[]> = {
  cliente: ['aguardando_pagamento', 'pendente'],
  loja: ['aguardando_pagamento', 'pendente', 'preparo', 'pronto'],
  admin: ['aguardando_pagamento', 'pendente', 'preparo', 'pronto']
};

export function RefundInfo({ order, viewer, compact = false }: { order: any; viewer: 'cliente' | 'loja' | 'admin'; compact?: boolean }) {
  if (!order) return null;
  const status = String(order.status || '');
  const refundStatus = String(order.asaasRefundStatus || '').toUpperCase();
  const value = Number(order.refundValue || 0);
  const at = fmtDate(order.refundedAt);
  const url = order.refundReceiptUrl ? String(order.refundReceiptUrl) : '';
  const box = compact ? 'text-[10px] px-1.5 py-1' : 'w-full text-[11px] px-2.5 py-1.5';

  // Só mostra "concluído" com valor ou comprovante do Asaas (pedido nunca pago não tem estorno)
  if (status === 'cancelado' && (value > 0 || url)) {
    return (
      <div className={`${box} font-bold rounded-lg border bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300`}>
        ↩️ Estorno concluído{value > 0 ? ` — ${fmtBRL(value)}` : ''}{at ? ` em ${at}` : ''}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1.5 underline whitespace-nowrap">Ver comprovante</a>
        )}
        {!compact && order.cancellationReason && (
          <span className="block font-medium opacity-80">Motivo: {order.cancellationReason}</span>
        )}
      </div>
    );
  }

  if (status === 'cancelado' && ['REFUND_IN_PROGRESS', 'REFUND_REQUESTED'].includes(refundStatus)) {
    return (
      <div className={`${box} font-bold rounded-lg border bg-sky-50 border-sky-300 text-sky-800 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300`}>
        ⏳ Estorno em processamento no Asaas. O comprovante aparece aqui quando for concluído.
      </div>
    );
  }

  if (refundStatus === 'REFUND_FAILED' && CANCELLABLE[viewer].includes(status)) {
    return (
      <div className={`${box} font-bold rounded-lg border bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300`}>
        ⚠️ Estorno não concluído: o pedido continua pago.{' '}
        {viewer === 'cliente' ? 'Toque em "Cancelar Pedido" para tentar de novo ou fale com o suporte.' : 'Cancele de novo para tentar outra vez.'}
      </div>
    );
  }

  return null;
}
