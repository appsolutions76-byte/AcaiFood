"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, MessageCircle, Sparkles, ExternalLink, QrCode } from "lucide-react";

interface ShareLandingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareLandingModal({ isOpen, onClose }: ShareLandingModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const landingUrl = "https://www.acaifood.app.br/apresentacao";
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(landingUrl)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(landingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt("Copie o link abaixo:", landingUrl);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🥣 Conheça o *AçaíFood* — O marketplace e ecossistema definitivo do Açaí!\n\nVeja a apresentação completa com vídeos curtos e faça seu pedido ou cadastre seu ponto de açaí:\n${landingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'AçaíFood - O Ecossistema do Açaí',
        text: 'Conheça o AçaíFood: peça açaí fresquinho, venda mais ou transporte com frete inteligente.',
        url: landingUrl
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-purple-900/50 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-zinc-100 space-y-5">
        
        {/* FECHAR */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* CABEÇALHO */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto">
            <Sparkles size={22} className="text-amber-400" />
          </div>
          <h3 className="text-xl font-black text-white">Apresentação Oficial AçaíFood</h3>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Compartilhe a página de apresentação com amigos, clientes, batedeiras e fornecedores da sua região!
          </p>
        </div>

        {/* LINK CARD */}
        <div className="bg-zinc-900/80 border border-purple-950 p-3.5 rounded-2xl space-y-2">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Link de Apresentação</span>
          <div className="flex items-center justify-between gap-2 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 text-xs font-mono text-purple-300">
            <span className="truncate">{landingUrl}</span>
            <button
              onClick={handleCopyLink}
              className="text-zinc-400 hover:text-white font-sans shrink-0 flex items-center gap-1 font-bold text-[11px]"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* BOTÕES DE COMPARTILHAMENTO */}
        <div className="space-y-2">
          <button
            onClick={handleShareWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
          >
            <MessageCircle size={18} />
            <span>Enviar no WhatsApp</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleNativeShare}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Share2 size={15} />
              <span>Mais Opções</span>
            </button>

            <button
              onClick={() => setShowQr(!showQr)}
              className="px-4 bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-purple-900/50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <QrCode size={15} />
              <span>QR Code</span>
            </button>
          </div>
        </div>

        {/* QR CODE EXPANSÍVEL */}
        {showQr && (
          <div className="bg-white p-4 rounded-2xl text-center space-y-2 animate-in zoom-in-95 duration-150">
            <img 
              src={qrCodeImgUrl} 
              alt="QR Code AçaíFood Apresentação" 
              className="w-48 h-48 mx-auto rounded-lg"
            />
            <p className="text-[11px] font-bold text-zinc-800">Aponte a câmera do celular para abrir</p>
          </div>
        )}

        {/* VER PÁGINA */}
        <div className="text-center pt-1 border-t border-zinc-900">
          <a
            href="/apresentacao"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 font-bold inline-flex items-center gap-1"
          >
            <span>Ver a página de apresentação agora</span>
            <ExternalLink size={12} />
          </a>
        </div>

      </div>
    </div>
  );
}
