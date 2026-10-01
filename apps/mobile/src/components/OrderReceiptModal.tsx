'use client';

import React, { useRef } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Share2, Copy } from 'lucide-react';
import { SeloAsaas } from '@/components/SeloAsaas';
import { Order } from '@/store/useAppStore';

interface OrderReceiptModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  storeName?: string;
  clientName?: string;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  open,
  onClose,
  storeName,
  clientName,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!open || !order) return null;

  const total = Number(order.totalValue ?? order.valor ?? 0);
  const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const orderNum = order.id.slice(0, 8).toUpperCase();

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('pt-BR');

  const buyer = clientName || order.clienteNome || 'Cliente AçaíFood';
  const seller = storeName || order.lojaNome || 'Loja/Batedeira Parceira';
  const asaasId = (order as any).asaas_payment_id || (order as any).asaasPaymentId || order.id;

  const handlePrint = () => {
    if (typeof window === 'undefined') return;
    const printContent = receiptRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=450,height=700');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Comprovante Asaas - Pedido #${orderNum}</title>
            <meta charset="utf-8" />
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                color: #1e293b;
                background: #fff;
              }
              .receipt-container {
                max-width: 380px;
                margin: 0 auto;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                padding: 20px;
              }
              .text-center { text-align: center; }
              .flex-between { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
              .divider { border-bottom: 1px dashed #cbd5e1; margin: 14px 0; }
              .bold { font-weight: bold; }
              .seal-img { max-height: 40px; margin-top: 6px; }
              .badge {
                background: #ecfdf5;
                color: #059669;
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                display: inline-block;
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="text-center">
                <h2 style="margin:0 0 4px 0; font-size: 18px;">AÇAÍFOOD DELIVERY</h2>
                <div class="badge">● PAGAMENTO CONFIRMADO</div>
                <p style="font-size: 12px; color: #64748b; margin: 6px 0 0 0;">Comprovante de Liquidação Pix</p>
              </div>

              <div class="divider"></div>

              <div class="flex-between">
                <span style="color:#64748b;">Pedido:</span>
                <span class="bold">#${orderNum}</span>
              </div>
              <div class="flex-between">
                <span style="color:#64748b;">Data e Hora:</span>
                <span>${dateStr}</span>
              </div>
              <div class="flex-between">
                <span style="color:#64748b;">Cliente:</span>
                <span class="bold">${buyer}</span>
              </div>
              <div class="flex-between">
                <span style="color:#64748b;">Estabelecimento:</span>
                <span>${seller}</span>
              </div>
              <div class="flex-between">
                <span style="color:#64748b;">Forma de Pagamento:</span>
                <span class="bold">PIX INSTANTÂNEO</span>
              </div>
              <div class="flex-between" style="font-size: 15px; margin-top: 10px;">
                <span class="bold">VALOR TOTAL PAGO:</span>
                <span class="bold" style="color: #059669;">${formattedTotal}</span>
              </div>

              <div class="divider"></div>

              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                <div><strong>Transação Gateway:</strong> ${asaasId}</div>
                <div><strong>Favorecido:</strong> Eletromecânica Baia Ltda</div>
              </div>

              <div class="divider"></div>

              <div class="text-center">
                <p style="font-size: 11px; margin: 0; color: #475569; font-weight: bold;">
                  INTERMEDIAÇÃO FINANCEIRA OFICIAL
                </p>
                <img src="https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=55be4694-40a6-46bd-8342-0a8f310e627b" alt="Asaas" class="seal-img" />
                <p style="font-size: 9px; color: #94a3b8; margin: 4px 0 0 0;">
                  Asaas Gestão Financeira Instituição de Pagamento S.A.<br/>
                  CNPJ 19.540.550/0001-21 • Autorizada pelo Banco Central do Brasil
                </p>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() { window.close(); }
              }
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[250] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 relative max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0030B9] shrink-0" />
            <span className="font-bold text-sm text-zinc-900 dark:text-white">
              Comprovante Oficial Asaas
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Comprovante */}
        <div className="p-6 overflow-y-auto space-y-4" ref={receiptRef}>
          <div className="text-center pb-4 border-b border-dashed border-zinc-200 dark:border-zinc-700">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 ring-6 ring-emerald-50/40">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
              Comprovante de Pagamento Pix
            </h3>
            <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold">
              AçaíFood Delivery • AppSolutions76
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-[11px]">
                ● Pago e Liquidado
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Pedido:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                #{orderNum}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Data e Hora:</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {dateStr}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Cliente:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{buyer}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Estabelecimento:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">{seller}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Método de Pagamento:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">PIX (Asaas)</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="font-bold text-zinc-900 dark:text-white text-sm">Valor Pago:</span>
              <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                {formattedTotal}
              </span>
            </div>
          </div>

          {/* Dados Fiscais / Gateway */}
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700 text-[11px] space-y-1 text-zinc-600 dark:text-zinc-300">
            <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              🏦 Dados da Transação
            </div>
            <div>
              <span className="text-zinc-400">ID Asaas:</span>{' '}
              <span className="font-mono select-all text-zinc-700 dark:text-zinc-300">{asaasId}</span>
            </div>
            <div>
              <span className="text-zinc-400">Favorecido no Pix:</span>{' '}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Eletromecânica Baia Ltda</span>
            </div>
          </div>

          {/* Selo Asaas e Logomarca Oficial */}
          <div className="pt-2 text-center flex flex-col items-center justify-center gap-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-700">
            <span className="text-[11px] font-bold text-[#0030B9]">
              Processado por Parceira Financeira:
            </span>
            <SeloAsaas variant="positivo" width={140} height={42} />
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
              Asaas Gestão Financeira Instituição de Pagamento S.A.<br />
              CNPJ: 19.540.550/0001-21 • Autorizada pelo Banco Central do Brasil
            </p>
          </div>
        </div>

        {/* Ações / Botões */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/40">
          <button
            onClick={handlePrint}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer size={15} /> Imprimir Comprovante
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
