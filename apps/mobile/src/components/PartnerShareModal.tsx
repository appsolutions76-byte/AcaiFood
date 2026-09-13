"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, MessageCircle, QrCode, ExternalLink, Sparkles } from "lucide-react";

interface PartnerShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  role?: string;
}

export function PartnerShareModal({ isOpen, onClose, storeId, storeName, role }: PartnerShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'app'>('store');

  if (!isOpen) return null;

  const isSupplier = role === 'fornecedor';
  const storeUrl = `https://www.acaifood.app.br/?loja=${storeId}`;
  const appUrl = "https://www.acaifood.app.br/apresentacao";

  const targetUrl = activeTab === 'store' ? storeUrl : appUrl;
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt("Copie o link abaixo:", targetUrl);
    }
  };

  const handleShareWhatsApp = () => {
    let text = "";
    if (activeTab === 'store') {
      if (isSupplier) {
        text = `🏭 Olá! Acesse nosso catálogo de frutos e insumos no *AçaíFood* e faça seu pedido direto com *${storeName}*:\n\n${storeUrl}`;
      } else {
        text = `🥣 Olá! Acesse nosso cardápio oficial no *AçaíFood* e faça seu pedido direto na *${storeName}*:\n\n${storeUrl}`;
      }
    } else {
      text = `🥣 Conheça o *AçaíFood* — O marketplace e aplicativo oficial do Açaí!\n\nVeja a apresentação completa:\n${appUrl}`;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: activeTab === 'store' ? `${storeName} - AçaíFood` : 'AçaíFood Oficial',
        text: activeTab === 'store' ? `Peça direto na ${storeName} no AçaíFood!` : 'Conheça o AçaíFood',
        url: targetUrl
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-purple-200 dark:border-purple-900/50 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-zinc-900 dark:text-zinc-100 space-y-4">
        
        {/* FECHAR */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* CABEÇALHO */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center mx-auto text-2xl shadow-xs">
            {isSupplier ? '🏭' : '🥣'}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
            Compartilhar Link de Vendas
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium max-w-xs mx-auto">
            {activeTab === 'store' 
              ? `Divulgue seu link exclusivo para clientes entrarem direto no cardápio de ${storeName}!` 
              : 'Divulgue a página de apresentação oficial do aplicativo AçaíFood.'}
          </p>
        </div>

        {/* ABAS DE SELEÇÃO DE LINK */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl gap-1 border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('store')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'store'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span>{isSupplier ? '🏭 Meu Catálogo' : '🏪 Meu Cardápio'}</span>
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'app'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={12} className="text-amber-400" />
            <span>App Geral</span>
          </button>
        </div>

        {/* LINK CARD */}
        <div className="bg-purple-50 dark:bg-zinc-900/80 border border-purple-200 dark:border-purple-950 p-3.5 rounded-2xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              {activeTab === 'store' ? '🔗 Link Direto do Seu Estabelecimento' : '✨ Link de Apresentação'}
            </span>
            {activeTab === 'store' && (
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-md">
                Entrada Direta
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 px-3 py-2 rounded-xl border border-purple-200 dark:border-zinc-800 text-xs font-mono text-purple-900 dark:text-purple-300 shadow-2xs">
            <span className="truncate select-all font-semibold">{targetUrl}</span>
            <button
              onClick={handleCopyLink}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-white font-sans shrink-0 flex items-center gap-1 font-extrabold text-[11px] cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="space-y-2">
          <button
            onClick={handleShareWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
          >
            <MessageCircle size={18} />
            <span>Enviar no WhatsApp</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleNativeShare}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <Share2 size={14} />
              <span>Mais Opções</span>
            </button>

            <button
              onClick={() => setShowQr(!showQr)}
              className="px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-purple-300 border border-zinc-200 dark:border-purple-900/50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <QrCode size={14} />
              <span>{showQr ? 'Ocultar QR' : 'QR Code'}</span>
            </button>
          </div>
        </div>

        {/* QR CODE EXPANSÍVEL */}
        {showQr && (
          <div className="bg-white p-4 rounded-2xl text-center space-y-2 border border-purple-200 dark:border-zinc-800 shadow-inner animate-in zoom-in-95 duration-150">
            <img 
              src={qrCodeImgUrl} 
              alt={`QR Code ${storeName}`} 
              className="w-44 h-44 mx-auto rounded-lg object-contain"
            />
            <p className="text-[11px] font-bold text-zinc-800">Aponte a câmera para abrir direto no seu cardápio</p>
            <a
              href={qrCodeImgUrl}
              download={`QRCode_${storeName.replace(/\s+/g, '_')}.png`}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-lg text-xs hover:bg-purple-200 transition"
            >
              💾 Baixar QR Code PNG
            </a>
          </div>
        )}

        {/* LINK PARA TESTAR */}
        <div className="text-center pt-2 border-t border-zinc-200 dark:border-zinc-900">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold inline-flex items-center gap-1"
          >
            <span>{activeTab === 'store' ? '👁️ Abrir e testar meu cardápio agora' : '✨ Ver página de apresentação'}</span>
            <ExternalLink size={12} />
          </a>
        </div>

      </div>
    </div>
  );
}

interface StoreShareCardProps {
  storeId: string;
  storeName: string;
  role?: string;
  onOpenModal?: () => void;
}

export function StoreShareCard({ storeId, storeName, role, onOpenModal }: StoreShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const isSupplier = role === 'fornecedor';
  const storeUrl = `https://www.acaifood.app.br/?loja=${storeId}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt("Copie o link do seu estabelecimento:", storeUrl);
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = "";
    if (isSupplier) {
      text = `🏭 Olá! Acesse nosso catálogo de frutos e insumos no *AçaíFood* e faça seu pedido direto com *${storeName}*:\n\n${storeUrl}`;
    } else {
      text = `🥣 Olá! Acesse nosso cardápio oficial no *AçaíFood* e faça seu pedido direto na *${storeName}*:\n\n${storeUrl}`;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      <div className="bg-gradient-to-br from-purple-900 via-indigo-950 to-zinc-950 text-white p-5 rounded-2xl shadow-lg border border-purple-500/40 relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{isSupplier ? '🏭' : '🥣'}</span>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 bg-purple-950/80 border border-purple-700/60 px-2 py-0.5 rounded-md">
                Link de Vendas Direto
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              {isSupplier ? 'Catálogo Digital do Produtor' : 'Cardápio Digital da sua Loja'}
            </h3>
            <p className="text-xs text-purple-200/90 font-medium max-w-lg leading-relaxed">
              Compartilhe seu link exclusivo com clientes no WhatsApp, Instagram e redes sociais. Ao clicar, seus clientes entram direto nos seus produtos para fazer pedidos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
            >
              <MessageCircle size={15} />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Copiar link"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={() => {
                if (onOpenModal) {
                  onOpenModal();
                } else {
                  setModalOpen(true);
                }
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md border border-purple-400/40 cursor-pointer"
            >
              <Share2 size={15} />
              <span>QR Code & Mais</span>
            </button>
          </div>
        </div>

        {/* Link em destaque */}
        <div className="relative z-10 mt-3.5 pt-3 border-t border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-purple-300 font-mono truncate">
            <span className="font-bold text-white">Seu link:</span>
            <span className="bg-black/40 px-2.5 py-1 rounded-lg border border-purple-800/40 select-all truncate">
              {storeUrl}
            </span>
          </div>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-white font-bold flex items-center gap-1 shrink-0 self-end sm:self-auto hover:underline"
          >
            <span>Testar como Cliente</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <PartnerShareModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        storeId={storeId}
        storeName={storeName}
        role={role}
      />
    </>
  );
}

