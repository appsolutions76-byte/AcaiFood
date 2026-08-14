"use client";

import React, { useState, useEffect } from "react";
import { Copy, CheckCircle, ExternalLink, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export interface PixModalData {
  open: boolean;
  qrCode?: string | null;
  copiaECola?: string | null;
  invoiceUrl?: string | null;
  orderId?: string;
  isSandbox?: boolean;
  paymentId?: string;
  totalValue?: number;
}

interface PixModalProps {
  data: PixModalData;
  onClose: () => void;
  onPaymentConfirmed?: () => void;
}

export function PixModal({ data, onClose, onPaymentConfirmed }: PixModalProps) {
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const acaoPedido = useAppStore((state) => state.acaoPedido);

  useEffect(() => {
    if (!data.open || !data.orderId || isPaid) return;

    const checkStatus = async () => {
      if (isPaid) return;
      try {
        const query = data.paymentId 
          ? `paymentId=${data.paymentId}&orderId=${data.orderId}` 
          : `orderId=${data.orderId}`;
        const res = await fetch(`/api/asaas/status?${query}`);
        if (res.ok) {
          const resData = await res.json();
          if (resData.isPaid) {
            setIsPaid(true);
            if (data.orderId) {
              await acaoPedido(data.orderId, 'confirmar_pagamento');
            }
            if (onPaymentConfirmed) {
              onPaymentConfirmed();
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao checar status do Pix no PixModal:", e);
      }
    };

    // Checar imediatamente e depois a cada 5s
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [data.open, data.orderId, data.paymentId, isPaid, acaoPedido, onPaymentConfirmed]);

  if (!data.open) return null;

  const formatMoney = (val?: number) =>
    (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const qrSrc = data.copiaECola
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.copiaECola)}`
    : (data.qrCode
        ? (data.qrCode.startsWith('data:') || data.qrCode.startsWith('http')
            ? data.qrCode
            : `data:image/png;base64,${data.qrCode}`)
        : null);

  const handleCopy = () => {
    if (data.copiaECola) {
      navigator.clipboard.writeText(data.copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 text-center relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X size={20} />
        </button>

        {isPaid ? (
          <div className="py-4">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={40} className="mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              ✅ Pagamento Confirmado!
            </h3>
            <p className="text-xs text-zinc-500 mb-6">
              Seu Pix foi recebido com sucesso. O pedido já foi liberado para preparo e envio!
            </p>
            <button
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2"
            >
              Concluir
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-purple-100 dark:bg-purple-900/40 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
              Pagamento via Pix
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Escaneie o QR Code ou copie o código abaixo para realizar o pagamento.
            </p>

            {data.totalValue !== undefined && (
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-2.5 mb-4 text-center">
                <span className="text-xs text-purple-900 dark:text-purple-300 font-medium">
                  💰 Valor Total:{" "}
                </span>
                <span className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                  {formatMoney(data.totalValue)}
                </span>
              </div>
            )}

            {qrSrc && (
              <div className="bg-white p-3 rounded-xl border border-zinc-200 inline-block mb-4 shadow-inner">
                <img
                  src={qrSrc}
                  alt="Pix QR Code"
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>
            )}

            {data.copiaECola && (
              <div className="mb-4">
                <input
                  type="text"
                  readOnly
                  value={data.copiaECola}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-600 dark:text-zinc-300 font-mono mb-2 text-center select-all"
                />
                <button
                  onClick={handleCopy}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle size={16} /> Código Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> 📋 Copiar Código Pix Copia e Cola
                    </>
                  )}
                </button>
              </div>
            )}

            {data.invoiceUrl && (
              <a
                href={data.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 rounded-xl text-xs transition mb-3 flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} /> Pagar Fatura Direto no Asaas
              </a>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-purple-700 dark:text-purple-300 font-medium py-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl mb-4 animate-pulse">
              <span>⌛</span> Aguardando confirmação do pagamento...
            </div>

            <button
              onClick={onClose}
              className="w-full bg-zinc-800 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
