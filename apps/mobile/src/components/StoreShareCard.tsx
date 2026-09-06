"use client";

import React, { useState } from "react";
import { Share2, Copy, Check, MessageCircle, QrCode, ExternalLink, X } from "lucide-react";

interface StoreShareCardProps {
  storeId: string;
  storeName: string;
  role?: string;
}

export function StoreShareCard({ storeId, storeName, role }: StoreShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // URL oficial do cardápio da loja
  const shareUrl = `https://www.acaifood.app.br/?loja=${storeId}`;
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt(`Copie o link de ${storeName} no AçaíFood abaixo:`, shareUrl);
    }
  };

  const handleShareWhatsApp = () => {
    const isSupplier = role === 'fornecedor';
    const text = isSupplier
      ? `🏭 Conheça o catálogo oficial de frutos e insumos de *${storeName}* no AçaíFood! Peça direto pelo nosso link:\n\n${shareUrl}`
      : `🥣 Peça o açaí fresquinho de *${storeName}* no AçaíFood! Peça direto pelo nosso cardápio oficial:\n\n${shareUrl}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      <div className="bg-gradient-to-br from-purple-900/40 via-zinc-900 to-amber-950/20 border border-purple-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-purple-600/30 text-purple-400 rounded-xl border border-purple-500/40">
                <Share2 size={18} />
              </span>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  🚀 Cardápio de {storeName} • AçaíFood
                </h3>
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Link de Divulgação Oficial</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Compartilhe seu link exclusivo na bio do Instagram, WhatsApp e redes sociais. Os clientes entram direto na sua loja e sua conta é criada automaticamente ao comprar!
            </p>
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-3 py-1.5 rounded-lg border border-purple-800/50 inline-block break-all select-all font-bold">
                {shareUrl}
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-md font-bold">
                🏪 {storeName}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
            >
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setQrModalOpen(true)}
              className="flex-1 sm:flex-none bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 border border-zinc-700 shadow transition-all active:scale-95"
            >
              <QrCode size={14} />
              <span>QR Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de QR Code para Impressão */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center relative">
            <button
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-zinc-100 dark:bg-zinc-800"
            >
              <X size={18} />
            </button>

            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-1">
              📱 QR Code da Sua Loja
            </h3>
            <p className="text-xs text-zinc-500 mb-5">
              Imprima este QR Code para colocar em mesas, panfletos, balcão ou adesivos de entrega.
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block border-2 border-purple-500/30 shadow-inner mb-4">
              <img
                src={qrCodeImgUrl}
                alt={`QR Code ${storeName}`}
                className="w-56 h-56 mx-auto object-contain"
              />
            </div>

            <p className="font-bold text-sm text-purple-600 dark:text-purple-400 mb-4">{storeName}</p>

            <div className="flex gap-2">
              <a
                href={qrCodeImgUrl}
                download={`QRCode_${storeName.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow"
              >
                💾 Baixar Imagem
              </a>
              <button
                onClick={() => window.open(shareUrl, '_blank')}
                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 px-4 rounded-xl text-xs transition border border-zinc-300 dark:border-zinc-700 flex items-center gap-1"
              >
                <ExternalLink size={13} />
                <span>Testar Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
