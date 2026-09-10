"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, Store, Truck, Bike, ShoppingBag, ShieldCheck, 
  MapPin, Play, CheckCircle2, ArrowRight, Share2, 
  Copy, Check, MessageCircle, Smartphone,
  Zap, Printer
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InteractiveVideoModal, VideoId } from "@/components/InteractiveVideoModal";

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<'cliente' | 'loja' | 'fornecedor' | 'entregador'>('cliente');
  const [activeVideoModal, setActiveVideoModal] = useState<VideoId | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoFilter, setVideoFilter] = useState<'todos' | 'transportes' | 'motoboy' | 'caminhao' | 'batedeira' | 'cliente' | 'b2b'>('todos');

  const handleOpenVideo = (videoId: VideoId) => {
    setActiveVideoModal(videoId);
    setIsVideoModalOpen(true);
  };

  const landingUrl = "https://www.acaifood.app.br/apresentacao";

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(landingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt("Copie o link de apresentação do AçaíFood:", landingUrl);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🥣 Conheça o *AçaíFood* — O marketplace e ecossistema definitivo do Açaí!\n\nVeja a apresentação completa e acerte no pedido ou nas vendas:\n${landingUrl}`;
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-600 selection:text-white flex flex-col font-sans">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-zinc-950/85 backdrop-blur-md border-b border-purple-900/30 px-4 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl sm:text-3xl p-1.5 bg-purple-900/40 rounded-xl border border-purple-500/30 group-hover:scale-105 transition-transform">
              🥣
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white">AçaíFood</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white px-1.5 py-0.5 rounded-md">Oficial</span>
              </div>
              <p className="text-[10px] text-zinc-400">O Ecossistema Completo do Açaí</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleNativeShare}
              className="bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800/60 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Compartilhar esta página de apresentação"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            <ThemeToggle />

            <Link
              href="/"
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-purple-900/40 transition active:scale-95 flex items-center gap-1.5"
            >
              <span>Abrir App</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/30 via-zinc-950 to-zinc-950 -z-10" />
        <div className="max-w-6xl mx-auto text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-950/80 to-purple-900/40 border border-purple-500/40 px-3.5 py-1.5 rounded-full text-purple-300 text-xs font-bold tracking-wide animate-pulse">
            <Sparkles size={14} className="text-amber-400" />
            <span>A Revolução Digital do Açaí</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-tight sm:leading-none max-w-4xl mx-auto">
            Do Ribeirinho à Tigela. <br className="hidden sm:inline"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
              Tudo em um só App.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-zinc-300 max-w-2xl mx-auto font-normal leading-relaxed">
            O <strong>AçaíFood</strong> une clientes sedentos por açaí fresquinho, batedeiras locais, fornecedores de fruto do mato e entregadores com frete inteligente calculado por GPS.
          </p>

          {/* BOTÕES DE AÇÃO HERO */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
            <Link
              href="/"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black px-7 py-3.5 rounded-2xl shadow-xl shadow-purple-900/50 flex items-center justify-center gap-2 text-base transition-all active:scale-95"
            >
              <ShoppingBag size={18} />
              <span>Pedir Açaí Agora</span>
            </Link>

            <button
              onClick={() => handleOpenVideo('ciclo_animado')}
              className="w-full sm:w-auto bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base transition-all active:scale-95 shadow-xl shadow-pink-900/40"
            >
              <Play size={18} className="fill-white text-white" />
              <span>Ver Vídeo Animado (Voz)</span>
            </button>

            <button
              onClick={() => handleOpenVideo('ciclo_completo')}
              className="w-full sm:w-auto bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/40 font-bold px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base transition-all active:scale-95 shadow-lg"
            >
              <Play size={18} className="text-purple-400 fill-purple-400" />
              <span>Ciclo Simulado (App)</span>
            </button>

            <Link
              href="/parceiros"
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 font-bold px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-base transition-all active:scale-95"
            >
              <Store size={18} />
              <span>Seja Parceiro</span>
            </Link>
          </div>

          {/* PROVA SOCIAL RÁPIDA */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Split de Pagamento Automático</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-purple-400" />
              <span>GPS de Alta Precisão</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-amber-400" />
              <span>PIN Seguro de Entrega</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO VÍDEO / DEMONSTRAÇÃO INTERATIVA COM TRANSPORTES */}
      <section className="px-4 sm:px-6 py-14 bg-zinc-900/50 border-y border-purple-900/20">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-purple-400 text-xs font-black uppercase tracking-wider">Como Funciona na Prática</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white">Veja a Operação e os Transportes em Vídeo</h2>
            <p className="text-zinc-400 text-sm">
              Assista como funciona a rotina dos clientes, das batedeiras e da nossa malha logística de <strong>Moto Entrega Express</strong>, <strong>Caminhão de Carga Pesada</strong> e <strong>Coleta de Caroço por Caçamba</strong>.
            </p>
          </div>

          {/* DESTAQUE MASTER: VÍDEO DO FLUXO COMPLETO */}
          <div 
            role="button"
            tabIndex={0}
            onClick={() => handleOpenVideo('ciclo_completo')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('ciclo_completo'); }}
            className="relative bg-gradient-to-r from-purple-950 via-zinc-900 to-amber-950 border-2 border-purple-500/60 hover:border-purple-400 rounded-3xl p-6 sm:p-8 shadow-2xl cursor-pointer group transition-all duration-300 hover:shadow-purple-900/50 active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-purple-600/30 border border-purple-400/40 px-3 py-1 rounded-full text-purple-200 text-xs font-black uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Vídeo Principal • Ciclo Completo (1:30)</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white group-hover:text-purple-300 transition-colors">
                  Da Colheita à Tigela e ao Descarte do Caroço
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Assista em um só vídeo todo o ecossistema integrado: cliente pede, loja imprime comanda térmica, motoboy entrega com PIN no portão, loja compra frutos ribeirinhos, caminhoneiro valida o PIN na doca da loja, e caçamba recolhe o caroço residual!
                </p>
                
                {/* Fluxo visual em linha */}
                <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 text-[11px] font-bold text-zinc-300">
                  <span className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">🥣 Cliente Pede</span>
                  <span>➔</span>
                  <span className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">🏪 Loja Imprime</span>
                  <span>➔</span>
                  <span className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">🏍️ Moto (PIN Cliente)</span>
                  <span>➔</span>
                  <span className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">🚚 Caminhão (PIN Loja)</span>
                  <span>➔</span>
                  <span className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">🚜 Caçamba Caroço</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 border-2 border-purple-300 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform animate-pulse">
                  <Play size={32} className="translate-x-0.5 fill-white" />
                </div>
                <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
                  Rodar Vídeo Completo
                </span>
              </div>
            </div>
          </div>

          {/* FILTRO DE CATEGORIAS DE VÍDEO */}
          <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
            <button
              onClick={() => setVideoFilter('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                videoFilter === 'todos'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              Todos os Vídeos (7)
            </button>
            <button
              onClick={() => setVideoFilter('ciclo_animado' as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                (videoFilter as string) === 'ciclo_animado'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-pink-300 hover:text-white border border-pink-800/40'
              }`}
            >
              <span>🎭 Vídeo Animado (Voz)</span>
            </button>
            <button
              onClick={() => setVideoFilter('ciclo_completo' as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                (videoFilter as string) === 'ciclo_completo'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-purple-300 hover:text-white border border-purple-800/40'
              }`}
            >
              <Sparkles size={13} /> Ciclo Simulado
            </button>
            <button
              onClick={() => setVideoFilter('transportes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                videoFilter === 'transportes'
                  ? 'bg-gradient-to-r from-amber-600 to-blue-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-amber-300 hover:text-white border border-amber-800/40'
              }`}
            >
              <span>🚚🏍️ Transportes (2)</span>
            </button>
            <button
              onClick={() => setVideoFilter('motoboy')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                videoFilter === 'motoboy'
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-amber-300 border border-zinc-800'
              }`}
            >
              <Bike size={13} /> Motoboy
            </button>
            <button
              onClick={() => setVideoFilter('caminhao')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                videoFilter === 'caminhao'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-blue-300 border border-zinc-800'
              }`}
            >
              <Truck size={13} /> Caminhão
            </button>
            <button
              onClick={() => setVideoFilter('batedeira')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                videoFilter === 'batedeira'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-purple-300 border border-zinc-800'
              }`}
            >
              <Store size={13} /> Batedeira
            </button>
            <button
              onClick={() => setVideoFilter('cliente')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                videoFilter === 'cliente'
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-pink-300 border border-zinc-800'
              }`}
            >
              <Smartphone size={13} /> Cliente
            </button>
          </div>

          {/* CARDS DE VÍDEOS OPERACIONAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* VÍDEO 0: CICLO ANIMADO COM PERSONAGENS E ÁUDIO */}
            {(videoFilter === 'todos' || (videoFilter as string) === 'ciclo_animado') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('ciclo_animado')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('ciclo_animado'); }}
                className="bg-gradient-to-b from-pink-950 via-purple-950 to-zinc-950 border-2 border-pink-500 hover:border-amber-300 rounded-3xl overflow-hidden shadow-2xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-pink-900/60 active:scale-[0.98] relative ring-1 ring-pink-400/40"
              >
                <div className="absolute top-3 right-3 z-20 bg-gradient-to-r from-pink-600 to-amber-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                  <span>🎭 Animado • Voz & Áudio</span>
                </div>
                <div className="relative aspect-[9/16] bg-pink-950/60 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-pink-950/70 to-transparent opacity-90" />
                  
                  {/* Avatares dos personagens voando */}
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-center -space-x-2 mb-1">
                      <div className="w-10 h-10 rounded-full bg-pink-600 border-2 border-white flex items-center justify-center text-lg shadow">🧑‍💻</div>
                      <div className="w-10 h-10 rounded-full bg-purple-600 border-2 border-white flex items-center justify-center text-lg shadow">👨‍🍳</div>
                      <div className="w-10 h-10 rounded-full bg-amber-600 border-2 border-white flex items-center justify-center text-lg shadow">🏍️</div>
                      <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-lg shadow">🚚</div>
                      <div className="w-10 h-10 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center text-lg shadow">🚜</div>
                    </div>

                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 border-2 border-white flex items-center justify-center text-zinc-950 shadow-2xl group-hover:scale-110 transition-all mx-auto animate-pulse">
                      <Play size={28} className="translate-x-0.5 fill-zinc-950 text-zinc-950" />
                    </div>
                    
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-pink-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Vídeo Animado • 1:28
                      </span>
                      <span className="text-[10px] text-amber-300 font-black">
                        Com Vozes, Balões & Som Real
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors">
                      História Animada: Turma do AçaíFood
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Conheça o Carlos, Seu Manoel, Marcos Motoboy, Tião Caminhoneiro e Beto da Caçamba em uma divertida animação falada com PIN duplo!
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-pink-900/40 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <span>🎭 Personagens & Áudio</span>
                  </span>
                  <span className="text-[11px] text-pink-400 font-black underline">Assistir Animação →</span>
                </div>
              </div>
            )}

            {/* VÍDEO MASTER: CICLO COMPLETO DO ECOSSISTEMA */}
            {(videoFilter === 'todos' || (videoFilter as string) === 'ciclo_completo') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('ciclo_completo')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('ciclo_completo'); }}
                className="bg-gradient-to-b from-purple-950 via-zinc-900 to-zinc-950 border-2 border-purple-500 hover:border-pink-400 rounded-3xl overflow-hidden shadow-2xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-purple-900/50 active:scale-[0.98] relative"
              >
                <div className="absolute top-3 right-3 z-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles size={11} /> Master • 8 Etapas
                </div>
                <div className="relative aspect-[9/16] bg-purple-950/70 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-purple-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 border-2 border-purple-200 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-white text-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-purple-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Vídeo Completo • 1:30
                      </span>
                      <span className="text-[10px] text-pink-300 font-bold">
                        Cliente ➔ Loja ➔ Moto ➔ Caminhão (PIN) ➔ Caçamba
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors">
                      O Ciclo Completo de Ponta a Ponta
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Acompanhe o pedido, impressão, motoboy com PIN, compra de matéria-prima, caminhoneiro com validação do PIN da loja e caçamba de resíduos!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-purple-900/40 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-pink-400" /> Cadeia Total Integrada
                  </span>
                  <span className="text-[11px] text-pink-400 font-bold underline">Rodar Tudo →</span>
                </div>
              </div>
            )}
            
            {/* VÍDEO TRANSPORTE 1: MOTOBOY */}
            {(videoFilter === 'todos' || videoFilter === 'transportes' || videoFilter === 'motoboy') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('motoboy')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('motoboy'); }}
                className="bg-zinc-900 border-2 border-amber-500/50 hover:border-amber-400 rounded-3xl overflow-hidden shadow-xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-amber-900/40 active:scale-[0.98]"
              >
                <div className="relative aspect-[9/16] bg-amber-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-amber-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-amber-500 border-2 border-amber-300 flex items-center justify-center text-zinc-950 shadow-xl group-hover:scale-110 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-zinc-950 text-zinc-950" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-amber-500 text-zinc-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Vídeo Transporte • 0:38
                      </span>
                      <span className="text-[10px] text-amber-300 font-bold">
                        Clique para Rodar
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                      No Motoboy: Corrida GPS, PIN Seguro e Saque PIX
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Radar de corridas apitando, retirada do açaí térmico na loja, rota com GPS e liberação do dinheiro no portão com PIN!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-amber-900/40 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Bike size={15} /> Motoboy Parceiro
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold underline">Rodar Vídeo →</span>
                </div>
              </div>
            )}

            {/* VÍDEO TRANSPORTE 2: CAMINHÃO */}
            {(videoFilter === 'todos' || videoFilter === 'transportes' || videoFilter === 'caminhao') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('caminhao')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('caminhao'); }}
                className="bg-zinc-900 border-2 border-blue-500/50 hover:border-blue-400 rounded-3xl overflow-hidden shadow-xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-blue-900/40 active:scale-[0.98]"
              >
                <div className="relative aspect-[9/16] bg-blue-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-blue-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-600 border-2 border-blue-300 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Vídeo Transporte • 0:42
                      </span>
                      <span className="text-[10px] text-blue-300 font-bold">
                        Clique para Rodar
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-blue-300 transition-colors">
                      No Caminhão: Frete Pesado, Latas e Rota B2B
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Lotes de toneladas de fruto colhido. Frete calculado automaticamente por km/peso, romaneio digital e descarga na batedeira!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-blue-900/40 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Truck size={15} /> Caminhão & Carga
                  </span>
                  <span className="text-[11px] text-blue-400 font-bold underline">Rodar Vídeo →</span>
                </div>
              </div>
            )}

            {/* VÍDEO 3: Batedeira */}
            {(videoFilter === 'todos' || videoFilter === 'batedeira') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('batedeira')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('batedeira'); }}
                className="bg-zinc-900 border border-purple-900/40 hover:border-purple-500 rounded-3xl overflow-hidden shadow-xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-purple-900/30 active:scale-[0.98]"
              >
                <div className="relative aspect-[9/16] bg-purple-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-purple-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-purple-600 border border-purple-400/50 flex items-center justify-center text-white shadow-xl group-hover:scale-110 group-hover:bg-purple-500 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-purple-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Assistir Vídeo • 0:40
                      </span>
                      <span className="text-[10px] text-purple-300 font-bold">
                        Clique para Rodar
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-purple-300 transition-colors">
                      Na Batedeira: Pedido e Impressão Instantânea
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      O pedido entra com toque sonoro, a impressora térmica emite o cupom na hora e o açaí sai fresquinho!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-purple-900/30 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Store size={15} /> Batedeira Operando
                  </span>
                  <span className="text-[11px] text-purple-400 font-bold underline">Rodar Vídeo →</span>
                </div>
              </div>
            )}

            {/* VÍDEO 4: Cliente */}
            {(videoFilter === 'todos' || videoFilter === 'cliente') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('cliente')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('cliente'); }}
                className="bg-zinc-900 border border-purple-900/40 hover:border-pink-500 rounded-3xl overflow-hidden shadow-xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-pink-900/30 active:scale-[0.98]"
              >
                <div className="relative aspect-[9/16] bg-pink-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-pink-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-pink-600 border border-pink-400/50 flex items-center justify-center text-white shadow-xl group-hover:scale-110 group-hover:bg-pink-500 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-pink-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Assistir Vídeo • 0:35
                      </span>
                      <span className="text-[10px] text-pink-300 font-bold">
                        Clique para Rodar
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors">
                      Do Celular do Cliente ao Portão
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Escolha a consistência (Popular, Médio ou Grosso), pague via PIX Copia e Cola e receba com o PIN seguro!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-purple-900/30 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <Smartphone size={15} /> Cliente Comprando
                  </span>
                  <span className="text-[11px] text-pink-400 font-bold underline">Rodar Vídeo →</span>
                </div>
              </div>
            )}

            {/* VÍDEO 5: Produtor & Fornecedor B2B */}
            {(videoFilter === 'todos' || videoFilter === 'b2b' || videoFilter === 'transportes') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('b2b')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('b2b'); }}
                className="bg-zinc-900 border border-purple-900/40 hover:border-emerald-500 rounded-3xl overflow-hidden shadow-xl flex flex-col group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-emerald-900/30 active:scale-[0.98]"
              >
                <div className="relative aspect-[9/16] bg-emerald-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-emerald-950/60 to-transparent opacity-90" />
                  <div className="relative z-10 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-600 border border-emerald-400/50 flex items-center justify-center text-white shadow-xl group-hover:scale-110 group-hover:bg-emerald-500 transition-all mx-auto animate-pulse">
                      <Play size={26} className="translate-x-0.5 fill-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block bg-emerald-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow">
                        ▶ Assistir Vídeo • 0:45
                      </span>
                      <span className="text-[10px] text-emerald-300 font-bold">
                        Clique para Rodar
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                      O Mercado B2B e Produtores de Açaí
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Fornecedores vendem latas do fruto direto para as batedeiras. Caminhões transportam com frete seguro!
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950 flex justify-between items-center border-t border-purple-900/30 group-hover:bg-zinc-900 transition-colors">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Store size={15} /> Abastecimento B2B
                  </span>
                  <span className="text-[11px] text-emerald-400 font-bold underline">Rodar Vídeo →</span>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* SEÇÃO 4 PILARES DA CADEIA DO AÇAÍ */}
      <section className="px-4 sm:px-6 py-16 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-purple-400 text-xs font-black uppercase tracking-wider">Feito para Todos</span>
          <h2 className="text-3xl sm:text-5xl font-black text-white">Qual é o seu papel no AçaíFood?</h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-sm">
            Nossa plataforma foi desenhada sob medida para cada elo do mercado de açaí.
          </p>
        </div>

        {/* ABAS INTERATIVAS DE PERFIS */}
        <div className="flex justify-center gap-2 flex-wrap">
          {[
            { id: 'cliente', label: '🥣 Quero Comprar (Cliente)' },
            { id: 'loja', label: '🏪 Batedeira (Loja)' },
            { id: 'fornecedor', label: '🏭 Fornecedor de Fruto' },
            { id: 'entregador', label: '🏍️ Entregador & Frete' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRoleTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
                activeRoleTab === tab.id
                  ? 'bg-purple-900/60 border-purple-400 text-white shadow-lg'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DA ABA SELECIONADA */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-purple-900/30 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {activeRoleTab === 'cliente' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-black text-pink-400 uppercase tracking-wide">Para Você e Sua Família</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">O Açaí Mais Fresco da Sua Região Sem Filas</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Não tome açaí industrializado ou requentado. O AçaíFood conecta você diretamente às melhores batedeiras de bairro da sua cidade.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Frete Justo via GPS:</strong> você só paga pela distância real entre a loja e o seu endereço.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Entrega com PIN de Segurança:</strong> o motoboy só conclui a entrega quando você digita seu código.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Chat ao Vivo no Pedido:</strong> tire dúvidas direto com quem está batendo seu açaí.</span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link href="/" className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-md transition">
                    Ver Batedeiras Próximas <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="bg-zinc-950 p-6 rounded-2xl border border-pink-900/30 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <span className="font-bold text-sm text-white">Tigela Personalizada</span>
                  <span className="text-xs bg-pink-500/20 text-pink-300 font-bold px-2 py-0.5 rounded">Fresco na Hora</span>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex justify-between py-1 border-b border-zinc-900">
                    <span>1L Açaí Grosso Artesanal</span>
                    <span className="font-bold text-white">R$ 22,00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-900">
                    <span>Tapioca de Grão Quebradinho</span>
                    <span className="font-bold text-white">R$ 3,00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Taxa de Entrega (1.4 km GPS)</span>
                    <span className="font-bold text-emerald-400">R$ 4,50</span>
                  </div>
                </div>
                <div className="bg-purple-950/60 p-3 rounded-xl border border-purple-800/40 text-center">
                  <span className="text-[11px] text-purple-300 font-bold">💳 Pagamento por PIX integrado e sem burocracia</span>
                </div>
              </div>
            </div>
          )}

          {activeRoleTab === 'loja' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wide">Para Batedeiras e Pontos de Venda</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">Venda Mais, Imprima Pedidos e Compre Insumos com 1 Toque</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Transforme seu ponto de açaí em uma potência digital. Tenha seu próprio cardápio com link exclusivo para sua bio do Instagram e WhatsApp.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                    <span><strong>Impressão Térmica Automática:</strong> conecte sua impressora 58mm ou 80mm via Bluetooth ou USB.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                    <span><strong>Abastecimento B2B Direto:</strong> compre latas do fruto direto de fornecedores cadastrados.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                    <span><strong>Saque Instantâneo via PIX:</strong> resgate seus ganhos na hora para a sua chave bancária cadastrada.</span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link href="/cadastro?role=loja" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-md transition">
                    Cadastrar Minha Batedeira <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="bg-zinc-950 p-6 rounded-2xl border border-purple-900/30 space-y-3">
                <span className="text-xs font-black text-purple-300 uppercase">Seu Painel Exclusivo</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-400">Vendas Hoje</span>
                    <p className="text-lg font-black text-emerald-400">R$ 485,00</p>
                  </div>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-400">Pedidos Entregues</span>
                    <p className="text-lg font-black text-white">18 pedidos</p>
                  </div>
                </div>
                <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-xs text-zinc-300">
                  ⚡ <strong>Sem mensalidades abusivas:</strong> você só paga uma pequena taxa quando efetivamente vender!
                </div>
              </div>
            </div>
          )}

          {activeRoleTab === 'fornecedor' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">Para Fornecedores de Fruto & Atacadistas</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">Venda Todo o Seu Fruto Direto para as Batedeiras</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Elimine atravessadores que esmagam sua margem. No AçaíFood, o seu fruto (em latas, sacos ou caixas) é listado diretamente no painel B2B das batedeiras da sua região.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Pagamento Garantido:</strong> o valor fica custodiado até a confirmação de recebimento da carga.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Chamado de Frete Pesado:</strong> acione caminhões e picapes com um toque.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span><strong>Link Exclusivo de Fornecedor:</strong> compartilhe seu catálogo atacadista no WhatsApp.</span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link href="/cadastro?role=fornecedor" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-md transition">
                    Cadastrar como Fornecedor <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="bg-zinc-950 p-6 rounded-2xl border border-emerald-900/30 space-y-4 text-center">
                <span className="text-4xl">🌴</span>
                <h4 className="text-lg font-bold text-white">Valorize a Produção Regional</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Conectamos os barcos e portos diretamente às lojas de açaí urbano, gerando renda e escoamento rápido de safra.
                </p>
              </div>
            </div>
          )}

          {activeRoleTab === 'entregador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wide">Para Motoboys, Picapes e Caminhões</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">Ganhe Mais com Corridas Curtas e Fretes Pesados</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Seja transportando 1 litro de açaí de moto ou 40 latas de fruto de caminhão, você tem um radar em tempo real para aceitar corridas e receber via PIX.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                    <span><strong>Radar Automático:</strong> corridas disponíveis aparecem com som e valor líquido na tela.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                    <span><strong>Segurança Máxima:</strong> entrega autenticada por PIN exclusivo informado pelo recebedor.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                    <span><strong>Repasse Direto:</strong> seus ganhos caem no PIX sem complicações.</span>
                  </li>
                </ul>
                <div className="pt-2 flex gap-3 flex-wrap">
                  <Link href="/cadastro?role=motoboy" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-3 rounded-xl text-sm shadow-md transition">
                    <Bike size={16} /> Sou Motoboy
                  </Link>
                  <Link href="/cadastro?role=caminhao" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl text-sm shadow-md transition">
                    <Truck size={16} /> Tenho Caminhão / Picape
                  </Link>
                </div>
              </div>

              <div className="bg-zinc-950 p-6 rounded-2xl border border-amber-900/30 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <span className="text-sm font-bold text-white">Corrida no Radar</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">Disponível</span>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="text-zinc-300">📍 <strong>Origem:</strong> Ponto do Açaí da Marambaia</p>
                  <p className="text-zinc-300">🏁 <strong>Destino:</strong> Travessa We 12, Conjunto Guajará</p>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-900">
                    <span className="text-zinc-400">Distância: 3.2 km</span>
                    <span className="text-base font-black text-amber-400">R$ 9,80</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </section>

      {/* DIFERENCIAIS TECNOLÓGICOS */}
      <section className="px-4 sm:px-6 py-16 bg-zinc-900/40 border-t border-purple-900/20">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-2">
            <span className="text-purple-400 text-xs font-black uppercase tracking-wider">Tecnologia Feita Para Funcionar</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Por Que o AçaíFood é Diferente?</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-zinc-950 p-6 rounded-2xl border border-purple-900/30 space-y-3">
              <div className="w-12 h-12 bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/30">
                <MapPin size={24} />
              </div>
              <h3 className="font-bold text-white text-base">GPS em Tempo Real</h3>
              <p className="text-xs text-zinc-400">
                O cliente pode pedir de qualquer lugar. O cálculo de frete por fórmula Haversine é justo para o cliente e para o entregador.
              </p>
            </div>

            <div className="bg-zinc-950 p-6 rounded-2xl border border-purple-900/30 space-y-3">
              <div className="w-12 h-12 bg-pink-600/20 text-pink-400 rounded-xl flex items-center justify-center border border-pink-500/30">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-bold text-white text-base">PIN Anti-Fraude</h3>
              <p className="text-xs text-zinc-400">
                Acaba com os golpes de entregas fantasmas. Apenas o recebedor possui o código numérico de liberação do pagamento.
              </p>
            </div>

            <div className="bg-zinc-950 p-6 rounded-2xl border border-purple-900/30 space-y-3">
              <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Zap size={24} />
              </div>
              <h3 className="font-bold text-white text-base">Split Instantâneo</h3>
              <p className="text-xs text-zinc-400">
                Integrado à infraestrutura do Asaas e Banco Central. O dinheiro do açaí vai para a loja e o do frete vai para o entregador.
              </p>
            </div>

            <div className="bg-zinc-950 p-6 rounded-2xl border border-purple-900/30 space-y-3">
              <div className="w-12 h-12 bg-amber-600/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30">
                <Printer size={24} />
              </div>
              <h3 className="font-bold text-white text-base">Impressão Térmica</h3>
              <p className="text-xs text-zinc-400">
                Batedeiras não precisam de computadores caros. Imprima ordens de serviço direto do celular em maquininhas térmicas de 58mm/80mm.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* CARD DE COMPARTILHAMENTO DA LANDING PAGE */}
      <section className="px-4 sm:px-6 py-14 max-w-4xl mx-auto w-full">
        <div className="bg-gradient-to-r from-purple-950 via-zinc-900 to-pink-950 border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center space-y-5">
          <div className="space-y-2 max-w-xl mx-auto">
            <span className="p-3 bg-purple-600/30 text-purple-300 rounded-2xl border border-purple-500/40 inline-block mb-1">
              <Share2 size={24} />
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">Espalhe a Ideia do AçaíFood</h3>
            <p className="text-xs sm:text-sm text-zinc-300">
              Compartilhe esta página de apresentação com batedeiras, amigos e fornecedores. Ajude a modernizar o comércio de açaí na sua cidade!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            >
              {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
              <span>{copied ? 'Link de Apresentação Copiado!' : 'Copiar Link da Apresentação'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            >
              <MessageCircle size={16} />
              <span>Mandar no WhatsApp</span>
            </button>
          </div>
          
          <div className="pt-2 text-[11px] text-purple-300/80 font-mono">
            {landingUrl}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-zinc-950 border-t border-purple-900/30 px-4 py-8 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <p className="font-bold text-zinc-300">AçaíFood © 2026 — O Marketplace Definitivo de Açaí</p>
            <p className="text-[11px] text-zinc-500">Conectando a cadeia do fruto com tecnologia brasileira de alta performance.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/politica-de-privacidade" className="hover:text-purple-400 underline transition">
              Política de Privacidade
            </Link>
            <Link href="/parceiros" className="hover:text-purple-400 underline transition">
              Portal do Parceiro
            </Link>
            <Link href="/" className="hover:text-purple-400 font-bold text-purple-400 transition">
              Acessar Cardápio
            </Link>
          </div>
        </div>
      </footer>

      {/* MODAL DE VÍDEO INTERATIVO & OPERAÇÃO */}
      <InteractiveVideoModal
        initialVideoId={activeVideoModal}
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
      />

    </div>
  );
}
