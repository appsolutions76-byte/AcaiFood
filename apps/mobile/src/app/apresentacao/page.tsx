"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, Store, Truck, Bike, ShoppingBag, ShieldCheck, 
  MapPin, Play, CheckCircle2, ArrowRight, Share2, 
  Copy, Check, MessageCircle, Smartphone,
  Zap, Printer, XCircle, ChevronDown, ChevronUp,
  Recycle, HelpCircle, Layers, Volume2, Users, TrendingUp
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { VideoId } from "@/components/InteractiveVideoModal";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";
import { AppSolutionsBrandCard } from "@/components/AppSolutionsBrandCard";
import dynamic from "next/dynamic";

// R41 (desempenho): modal de vídeo dinâmico sob demanda
const InteractiveVideoModal = dynamic(() => import("@/components/InteractiveVideoModal").then(m => m.InteractiveVideoModal), { ssr: false });

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<'cliente' | 'loja' | 'fornecedor' | 'entregador' | 'afiliado'>('cliente');
  const [activeVideoModal, setActiveVideoModal] = useState<VideoId | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoFilter, setVideoFilter] = useState<'todos' | 'ciclo_animado' | 'ciclo_completo' | 'transportes'>('todos');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqItems = [
    {
      q: "Preciso de computador ou sistema caro na minha batedeira?",
      a: "Não! O AçaíFood roda direto no seu smartphone, tablet ou maquininha Android (Smart POS). A impressão térmica de comandas conecta via Bluetooth ou USB em segundos."
    },
    {
      q: "Como motoboy e caminhoneiro recebem o frete?",
      a: "O repasse é automático e seguro. Para motoboys, a liberação ocorre quando o cliente informa o PIN no portão. Para caminhões, o PIN é validado na doca de descarregamento da loja. O saldo cai na hora e pode ser sacado via Pix."
    },
    {
      q: "Como o AçaíFood evita golpes de pedidos e entregas falsas?",
      a: "Através da tecnologia de Duplo PIN de 4 dígitos. A entrega só é concluída e o dinheiro só é liberado para o entregador quando o recebedor digita o código individual gerado pelo sistema."
    },
    {
      q: "Existe taxa de mensalidade ou anuidade fixa para parceiros?",
      a: "Zero mensalidade fixa! Você só paga uma pequena taxa sobre as vendas ou fretes que forem efetivamente concluídos com sucesso. Cadastro 100% gratuito."
    },
    {
      q: "Como funciona a coleta ecológica de caroço por caçamba?",
      a: "Quando a batedeira atinge o volume residual de caroços, ela solicita a retirada com um clique no painel. Caçambas parceiras recolhem e destinam o resíduo para indústrias de biomassa, tijolos ecológicos e caldeiras."
    },
    {
      q: "Como funciona o Programa de Afiliados?",
      a: "Você divulga seu link exclusivo (/r/SEUCODIGO). Ganha bônus por batedeiras homologadas, bônus por novos clientes no 1º pedido e comissão contínua sobre as vendas realizadas durante a vigência do contrato."
    }
  ];

  const handleOpenVideo = (videoId: VideoId) => {
    setActiveVideoModal(videoId);
    setIsVideoModalOpen(true);
  };

  const landingUrl = "https://www.acaifood.app.br/cadastro";

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(landingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      prompt("Copie o link de acesso ao AçaíFood:", landingUrl);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🥣 Conheça o *AçaíFood* — O marketplace e ecossistema definitivo do Açaí!\n\nPeça açaí fresquinho ou cadastre seu comércio:\n${landingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'AçaíFood - O Ecossistema do Açaí',
        text: 'Conheça o AçaíFood: peça açaí fresco, cadastre sua batedeira ou faça entregas!',
        url: landingUrl
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-600 selection:text-white flex flex-col font-sans">
      
      {/* NAVBAR COMPACTA */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-purple-900/30 px-3 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group" title="Página Inicial do AçaíFood">
            <Image
              src="/logo-header-escuro.svg"
              alt="AçaíFood"
              width={160}
              height={36}
              priority
              unoptimized
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-90 transition-opacity"
            />
            <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-wider bg-purple-600/80 text-white px-1.5 py-0.5 rounded">
              Oficial
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNativeShare}
              className="bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800/60 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Compartilhar apresentação"
            >
              <Share2 size={13} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            <ThemeToggle />

            <Link
              href="/"
              className="bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-black shadow-md shadow-purple-900/40 transition active:scale-95 flex items-center gap-1"
            >
              <span>Abrir App</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION COMPACTA & IMPACTANTE */}
      <section className="relative overflow-hidden pt-8 pb-10 sm:py-14 px-4 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/25 via-zinc-950 to-zinc-950 -z-10" />
        <div className="max-w-5xl mx-auto text-center space-y-4 sm:space-y-5">
          
          <div className="inline-flex items-center gap-1.5 bg-purple-950/70 border border-purple-500/30 px-3 py-1 rounded-full text-purple-300 text-[11px] font-bold tracking-wide">
            <Sparkles size={12} className="text-amber-400" />
            <span>O Ecossistema Completo do Açaí</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight max-w-3xl mx-auto">
            Do Ribeirinho à Tigela. <br className="hidden sm:inline"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
              Tudo em um só Aplicativo.
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-zinc-300 max-w-xl mx-auto font-normal leading-relaxed">
            Conectamos consumidores, batedeiras artesanais, fornecedores de fruto, motoboys e caminhoneiros com <strong>frete inteligente por GPS</strong> e <strong>pagamentos Pix instantâneos</strong>.
          </p>

          {/* BOTÕES DE AÇÃO HERO COMPACTOS (GRID RESPONSIVO) */}
          <div className="pt-2 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-2xl mx-auto">
            <Link
              href="/"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black px-4 py-2.5 rounded-xl shadow-lg shadow-purple-900/40 flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all active:scale-95"
            >
              <ShoppingBag size={15} />
              <span>Pedir Açaí</span>
            </Link>

            <button
              onClick={() => handleOpenVideo('ciclo_animado')}
              className="bg-zinc-900 hover:bg-pink-950/80 text-pink-300 border border-pink-500/40 font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all active:scale-95"
            >
              <Play size={14} className="fill-pink-400 text-pink-400" />
              <span>Vídeo com Voz</span>
            </button>

            <button
              onClick={() => handleOpenVideo('ciclo_completo')}
              className="bg-zinc-900 hover:bg-purple-950/80 text-purple-300 border border-purple-500/40 font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all active:scale-95"
            >
              <Play size={14} className="fill-purple-400 text-purple-400" />
              <span>Ciclo no App</span>
            </button>

            <Link
              href="/parceiros"
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-bold px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all active:scale-95"
            >
              <Store size={14} />
              <span>Seja Parceiro</span>
            </Link>
          </div>

          {/* PROVA SOCIAL RÁPIDA COMPACTA */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Pix & Split Asaas</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-purple-400" />
              <span>GPS de Alta Precisão</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-amber-400" />
              <span>Duplo PIN Anti-Fraude</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO CINE HUB: CARDS COMPACTOS EM PROPORÇÃO MODERNA */}
      <section className="px-4 sm:px-6 py-8 sm:py-10 bg-zinc-900/40 border-y border-purple-900/20">
        <div className="max-w-6xl mx-auto space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Cine Hub Oficial</span>
              <h2 className="text-xl sm:text-2xl font-black text-white">Vídeos em Destaque</h2>
              <p className="text-zinc-400 text-xs">Assista à simulação das telas reais e à narrativa animada da cadeia produtiva.</p>
            </div>

            {/* FILTROS COMPACTOS */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'todos', label: 'Todos (3)' },
                { id: 'ciclo_animado', label: '🎭 História com Voz' },
                { id: 'ciclo_completo', label: '🎬 Telas & PIN' },
                { id: 'transportes', label: '🚚 Logística' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setVideoFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    videoFilter === f.id
                      ? 'bg-purple-600 text-white shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* GRADE DE VÍDEOS MINIMIZADA (LAYOUT HORIZONTAL / STREAMING) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* CARD 1: HISTÓRIA ANIMADA */}
            {(videoFilter === 'todos' || videoFilter === 'ciclo_animado') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('ciclo_animado')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('ciclo_animado'); }}
                className="bg-gradient-to-b from-pink-950/40 via-zinc-900 to-zinc-950 border border-pink-500/50 hover:border-pink-400 rounded-2xl overflow-hidden shadow-md flex flex-col group cursor-pointer transition hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="relative aspect-video bg-pink-950/80 flex items-center justify-center p-4 overflow-hidden border-b border-pink-900/30">
                  <div className="absolute top-2 right-2 z-10 bg-pink-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Volume2 size={10} /> 1:28 min
                  </div>
                  <div className="w-12 h-12 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={20} className="translate-x-0.5 fill-white" />
                  </div>
                </div>

                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Animação & Diálogos</span>
                    <h3 className="text-sm font-black text-white group-hover:text-pink-300 transition-colors">
                      A Turma do AçaíFood: Uma História Real
                    </h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                      Carlos, Seu Manoel, Marcos Motoboy e Tião Caminhoneiro em uma animação narrada com humor e clareza.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-pink-400 border-t border-zinc-800">
                    <span>Ver animação</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 2: CICLO OPERACIONAL COMPLETO */}
            {(videoFilter === 'todos' || videoFilter === 'ciclo_completo') && (
              <div 
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVideo('ciclo_completo')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVideo('ciclo_completo'); }}
                className="bg-gradient-to-b from-purple-950/40 via-zinc-900 to-zinc-950 border border-purple-500/50 hover:border-purple-400 rounded-2xl overflow-hidden shadow-md flex flex-col group cursor-pointer transition hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="relative aspect-video bg-purple-950/80 flex items-center justify-center p-4 overflow-hidden border-b border-purple-900/30">
                  <div className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Sparkles size={10} /> 1:30 min
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={20} className="translate-x-0.5 fill-white" />
                  </div>
                </div>

                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-400 uppercase">Telas do App</span>
                    <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                      Ciclo Operacional: Telas Reais & Duplo PIN
                    </h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                      Pedido do cliente, impressão térmica automática na loja, rota GPS e validação de PIN de entrega.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-purple-400 border-t border-zinc-800">
                    <span>Rodar demonstração</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 3: MALHA LOGÍSTICA */}
            {(videoFilter === 'todos' || videoFilter === 'transportes') && (
              <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                      🚚🏍️ Logística
                    </span>
                    <span className="text-[10px] text-amber-300 font-bold">2 Modais</span>
                  </div>
                  <h3 className="text-sm font-black text-white">Malha Integrada: Moto & Caminhão</h3>
                  <p className="text-[11px] text-zinc-400">Atendemos a entrega expressa ao consumidor e o frete de toneladas de frutos.</p>

                  <div className="space-y-1.5 pt-1">
                    <div 
                      onClick={() => handleOpenVideo('motoboy')}
                      className="p-2 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-amber-400 flex items-center justify-between cursor-pointer transition text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Bike size={16} className="text-amber-400" />
                        <div>
                          <p className="font-bold text-white text-[11px]">Motoboy Express</p>
                          <p className="text-[9px] text-zinc-500">Radar GPS e PIN na entrega</p>
                        </div>
                      </div>
                      <Play size={12} className="text-amber-400 fill-amber-400" />
                    </div>

                    <div 
                      onClick={() => handleOpenVideo('caminhao')}
                      className="p-2 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-blue-400 flex items-center justify-between cursor-pointer transition text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-blue-400" />
                        <div>
                          <p className="font-bold text-white text-[11px]">Caminhão de Carga</p>
                          <p className="text-[9px] text-zinc-500">Frete por km/peso e romaneio</p>
                        </div>
                      </div>
                      <Play size={12} className="text-blue-400 fill-blue-400" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400 text-[11px]">Cadastro de motoristas</span>
                  <Link href="/cadastro?role=motoboy" className="text-amber-400 font-bold text-[11px] hover:underline">
                    Quero Rodar →
                  </Link>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* SEÇÃO COMPARATIVA MINIMIZADA: TRADICIONAL VS AÇAÍFOOD */}
      <section className="px-4 sm:px-6 py-8 sm:py-10 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <span className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Evolução Digital</span>
          <h2 className="text-xl sm:text-3xl font-black text-white">O Jeito Antigo vs. Modo AçaíFood</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MODO ANTIGO */}
          <div className="bg-zinc-900/50 border border-red-900/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-black text-sm border-b border-red-900/20 pb-2">
              <XCircle size={18} />
              <span>Sem o AçaíFood (Tradicional)</span>
            </div>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span><strong>Pedidos Perdidos no WhatsApp:</strong> áudios acumulados e clientes desistindo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span><strong>Caderno e Erros:</strong> comandas trocadas na correria da batedeira.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span><strong>Frete no "Chute":</strong> taxas combinadas sem critério gerando atritos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span><strong>Caroço na Calçada:</strong> sacas acumuladas atraindo insetos e multas.</span>
              </li>
            </ul>
          </div>

          {/* MODO AÇAÍFOOD */}
          <div className="bg-gradient-to-b from-purple-950/30 to-zinc-900/70 border border-purple-500/50 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm border-b border-purple-800/30 pb-2">
              <CheckCircle2 size={18} />
              <span>Com o AçaíFood (Ecossistema)</span>
            </div>
            <ul className="space-y-2 text-xs text-zinc-200">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span><strong>Cardápio Digital & Impressão Térmica:</strong> comanda impressa na hora com som.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span><strong>Cálculo Milimétrico por GPS:</strong> distância real justa para cliente e entregador.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span><strong>Duplo PIN de 4 Dígitos:</strong> entrega autenticada sem fraudes ou extravios.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span><strong>Coleta de Caroço por Caçamba:</strong> 1 toque para destinação a indústrias de biomassa.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SEÇÃO SUSTENTABILIDADE & CAROÇO COMPACTA */}
      <section className="px-4 sm:px-6 py-6 sm:py-8 bg-gradient-to-r from-teal-950/20 via-zinc-900 to-purple-950/20 border-y border-teal-900/30">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-xl text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 rounded-full text-teal-300 text-[10px] font-bold">
              <Recycle size={12} className="text-emerald-400" />
              <span>Sustentabilidade ESG</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white">Descarte Ecológico de Caroço</h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Mais de 80% do fruto é caroço residual. No AçaíFood, batedeiras acionam <strong>Caçambas Parceiras</strong> com 1 clique para destinação limpa a usinas de biomassa e carvão ativado.
            </p>
          </div>

          <div className="bg-zinc-950 p-4 rounded-2xl border border-teal-500/30 text-center shrink-0 w-full sm:w-64 space-y-2">
            <span className="text-2xl">🚜</span>
            <p className="font-bold text-white text-xs">Agendamento Fácil</p>
            <p className="text-[10px] text-zinc-400">Zero caroço na rua e descarte certificado.</p>
            <Link
              href="/parceiros/batedeira"
              className="inline-block bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition"
            >
              Painel da Batedeira
            </Link>
          </div>
        </div>
      </section>

      {/* SEÇÃO PILARES DO ECOSSISTEMA COM ABAS COMPACTAS */}
      <section className="px-4 sm:px-6 py-8 sm:py-10 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <span className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Perfis & Integração</span>
          <h2 className="text-xl sm:text-3xl font-black text-white">Quem Você é no AçaíFood?</h2>
        </div>

        {/* ABAS COMPACTAS */}
        <div className="flex justify-center gap-1.5 flex-wrap">
          {[
            { id: 'cliente', label: '🥣 Cliente' },
            { id: 'loja', label: '🏪 Batedeira' },
            { id: 'fornecedor', label: '🏭 Fornecedor' },
            { id: 'entregador', label: '🏍️ Entregador' },
            { id: 'afiliado', label: '🤝 Afiliado & Ganhos' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRoleTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                activeRoleTab === tab.id
                  ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DA ABA COMPACTA */}
        <div className="bg-zinc-900/80 border border-purple-900/30 rounded-2xl p-4 sm:p-6 shadow-xl">
          {activeRoleTab === 'cliente' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-black text-white">Peça Açaí Fresquinho Sem Filas</h3>
                <Link href="/" className="text-xs text-pink-400 font-bold hover:underline flex items-center gap-1">
                  Cardápio <ArrowRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-zinc-300">
                Acesse as melhores batedeiras de bairro da sua cidade. Escolha os 5 padrões (Popular, Médio, Grosso, Branco e Congelado para Viagem), churrascos com ponto da carne e complementos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-zinc-300">
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-emerald-400">📍 Frete por GPS</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Preço justo calculado pela rota real.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-purple-400">🔐 PIN de Entrega</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Motoboy só conclui após seu OK.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-pink-400">⚡ Pix Instantâneo</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Aprovação em segundos sem burocracia.</p>
                </div>
              </div>
            </div>
          )}

          {activeRoleTab === 'loja' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-black text-white">Venda Mais e Modernize sua Batedeira</h3>
                <Link href="/cadastro?role=loja" className="text-xs text-purple-400 font-bold hover:underline flex items-center gap-1">
                  Cadastrar Loja <ArrowRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-zinc-300">
                Tenha cardápio com link exclusivo para seu Instagram/WhatsApp. Impressão térmica automática de comandas (58mm/80mm), acionamento de motoboy sob demanda e abastecimento B2B.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-zinc-300">
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-purple-400">🖨️ Impressora Térmica</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Bluetooth, USB e alertas sonoros.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-emerald-400">💰 Zero Mensalidade</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Só paga taxa quando vender.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-amber-400">🏍️ Chamar Moto</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Radar direto com motoboys da praça.</p>
                </div>
              </div>
            </div>
          )}

          {activeRoleTab === 'fornecedor' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-black text-white">Venda de Fruto no Atacado Direto às Lojas</h3>
                <Link href="/cadastro?role=fornecedor" className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  Cadastrar Fruto <ArrowRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-zinc-300">
                Elimine atravessadores vendendo latas e sacas diretamente no painel B2B das batedeiras. Pagamento custodiado e acionamento de caminhão de carga pesada.
              </p>
            </div>
          )}

          {activeRoleTab === 'entregador' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-black text-white">Corridas Urbanas e Fretes Pesados</h3>
                <Link href="/cadastro?role=motoboy" className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1">
                  Cadastrar Moto/Caminhão <ArrowRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-zinc-300">
                Radar sob demanda: só chame corridas já prontas na loja. Rota automática no Google Maps, repasse imediato após o PIN do cliente e saques via Pix.
              </p>
            </div>
          )}

          {activeRoleTab === 'afiliado' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-black text-white">Programa de Parceiros Afiliados</h3>
                <Link href="/parceiro/afiliado" className="text-xs text-purple-400 font-bold hover:underline flex items-center gap-1">
                  Painel do Afiliado <ArrowRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-zinc-300">
                Divulgue o AçaíFood com seu link exclusivo (<code className="text-purple-300 font-mono">/r/SEUCODIGO</code>). Ganhe bônus por lojas homologadas, bônus por novos clientes e comissão contínua sobre as vendas!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-zinc-300">
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-purple-400">🏪 Bônus por Batedeira</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">R$ fixo por ponto homologado.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-pink-400">🥣 Bônus por Cliente</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Pago no 1º pedido concluído.</p>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="font-bold text-emerald-400">📈 Comissão Recorrente</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">% contínua por até 6 meses.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DIFERENCIAIS TECNOLÓGICOS (4 CARDS COMPACTOS) */}
      <section className="px-4 sm:px-6 py-8 bg-zinc-900/30 border-t border-purple-900/20">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="text-center">
            <span className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Engenharia Brasileira</span>
            <h2 className="text-lg sm:text-2xl font-black text-white">Diferenciais que Fazem Funcionar</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-purple-900/30 space-y-1.5">
              <MapPin size={20} className="text-purple-400" />
              <h3 className="font-bold text-white text-xs">GPS Haversine</h3>
              <p className="text-[11px] text-zinc-400">Cálculo de km real por ruas, sem valores abusivos de frete.</p>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-purple-900/30 space-y-1.5">
              <ShieldCheck size={20} className="text-pink-400" />
              <h3 className="font-bold text-white text-xs">Duplo PIN Anti-Fraude</h3>
              <p className="text-[11px] text-zinc-400">Entrega validada com código numérico gerado no banco.</p>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-purple-900/30 space-y-1.5">
              <Zap size={20} className="text-emerald-400" />
              <h3 className="font-bold text-white text-xs">Split Pix Asaas</h3>
              <p className="text-[11px] text-zinc-400">Divisão automática entre loja, entregador e plataforma.</p>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-purple-900/30 space-y-1.5">
              <Printer size={20} className="text-amber-400" />
              <h3 className="font-bold text-white text-xs">Impressão Térmica</h3>
              <p className="text-[11px] text-zinc-400">Comandas de 58mm/80mm direto do celular ou POS.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ COMPACTO */}
      <section className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <span className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Perguntas Frequentes</span>
          <h2 className="text-lg sm:text-2xl font-black text-white">Dúvidas Rápidas</h2>
        </div>

        <div className="space-y-2">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-zinc-900/60 border border-purple-900/30 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-purple-300 transition"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle size={15} className="text-purple-400 shrink-0" />
                    <span>{item.q}</span>
                  </span>
                  {isOpen ? <ChevronUp size={15} className="text-purple-400 shrink-0" /> : <ChevronDown size={15} className="text-zinc-500 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3.5 text-xs text-zinc-300 border-t border-purple-900/20 pt-2 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CARD DE COMPARTILHAMENTO MINIMALISTA */}
      <section className="px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
        <div className="bg-gradient-to-r from-purple-950/60 via-zinc-900 to-pink-950/60 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-lg text-center space-y-3">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white">Divulgue o AçaíFood</h3>
            <p className="text-xs text-zinc-300">
              Compartilhe com batedeiras, amigos e familiares para modernizar o açaí na sua cidade.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow transition active:scale-95"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? 'Link Copiado!' : 'Copiar Link'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow transition active:scale-95"
            >
              <MessageCircle size={14} />
              <span>Enviar no WhatsApp</span>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-zinc-950 border-t border-purple-900/30 px-4 py-6 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <div>
            <p className="font-bold text-zinc-300">AçaíFood © 2026 — O Marketplace Definitivo do Açaí</p>
            <p className="text-[11px] text-zinc-500">Conectando a cadeia do fruto com tecnologia de alta performance.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/politica-de-privacidade" className="hover:text-purple-400 underline transition">
              Privacidade
            </Link>
            <Link href="/parceiros" className="hover:text-purple-400 underline transition">
              Parceiros
            </Link>
            <Link href="/" className="hover:text-purple-400 font-bold text-purple-400 transition">
              Cardápio
            </Link>
          </div>
        </div>
        <AppSolutionsBrandCard className="my-4" />
        <AsaasPartnerBadge variant="footer" className="mt-3 border-t border-zinc-900 pt-3" />
      </footer>

      {/* MODAL DE VÍDEO INTERATIVO */}
      <InteractiveVideoModal
        initialVideoId={activeVideoModal}
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
      />

    </div>
  );
}