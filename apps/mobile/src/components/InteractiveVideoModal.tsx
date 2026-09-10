"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, 
  Minimize2, X, Store, Smartphone, Truck, CheckCircle2, 
  Printer, ArrowRight, ChevronRight, ChevronLeft,
  MapPin, QrCode, Navigation
} from "lucide-react";
import Link from "next/link";

export interface VideoItem {
  id: 'batedeira' | 'cliente' | 'b2b';
  title: string;
  badge: string;
  role: string;
  durationSeconds: number;
  description: string;
  ctaText: string;
  ctaLink: string;
  colorScheme: 'purple' | 'pink' | 'amber';
  videoUrl?: string;
}

export const VIDEO_CATALOG: VideoItem[] = [
  {
    id: 'batedeira',
    title: 'Na Batedeira: Pedido e Impressão Instantânea',
    badge: 'Batedeira Operando',
    role: 'Para Batedeiras de Açaí',
    durationSeconds: 40,
    description: 'Veja como o pedido chega com toque sonoro, gera a comanda automática para impressão térmica de 58mm/80mm e despacha com facilidade.',
    ctaText: 'Cadastrar Minha Batedeira',
    ctaLink: '/parceiros',
    colorScheme: 'purple',
    videoUrl: '/videos/batedeira.mp4'
  },
  {
    id: 'cliente',
    title: 'Do Celular do Cliente ao Portão',
    badge: 'Cliente Comprando',
    role: 'Experiência do Consumidor',
    durationSeconds: 35,
    description: 'Da escolha do açaí com complementos ao pagamento instantâneo por PIX e entrega rastreada com PIN de segurança no portão.',
    ctaText: 'Fazer um Pedido Agora',
    ctaLink: '/',
    colorScheme: 'pink',
    videoUrl: '/videos/cliente.mp4'
  },
  {
    id: 'b2b',
    title: 'O Mercado B2B e o Frete Pesado',
    badge: 'Abastecimento B2B',
    role: 'Produtores & Caminhoneiros',
    durationSeconds: 45,
    description: 'Negociação direta de latas de fruto entre produtores ribeirinhos e batedeiras com frete pesado seguro por peso e rota.',
    ctaText: 'Acessar Mercado de Frutos',
    ctaLink: '/parceiros',
    colorScheme: 'amber',
    videoUrl: '/videos/b2b.mp4'
  }
];

interface InteractiveVideoModalProps {
  initialVideoId: 'batedeira' | 'cliente' | 'b2b' | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InteractiveVideoModal({ initialVideoId, isOpen, onClose }: InteractiveVideoModalProps) {
  const [currentVideoId, setCurrentVideoId] = useState<'batedeira' | 'cliente' | 'b2b'>('batedeira');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSoundSceneRef = useRef<number>(-1);

  useEffect(() => {
    if (initialVideoId) {
      setCurrentVideoId(initialVideoId);
      setCurrentTime(0);
      setIsPlaying(true);
      lastSoundSceneRef.current = -1;
    }
  }, [initialVideoId]);

  const activeVideo = VIDEO_CATALOG.find(v => v.id === currentVideoId) || VIDEO_CATALOG[0];

  // Web Audio synthesizer for realistic app feedback sound effects
  const playSoundEffect = (type: 'order_bell' | 'printer' | 'pix_success' | 'truck_gear') => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'order_bell') {
        // Double ding bell sound
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1174.66, now + 0.15);
        gain2.gain.setValueAtTime(0.2, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.6);
      } else if (type === 'printer') {
        // Thermal printer stepping sound
        const now = ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(450 + (i % 2) * 120, now + i * 0.08);
          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.06);
        }
      } else if (type === 'pix_success') {
        // Happy ascending chord
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.15, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.35);
        });
      } else if (type === 'truck_gear') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // Timer loop for playback
  useEffect(() => {
    if (!isOpen) return;

    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          if (next >= activeVideo.durationSeconds) {
            return 0;
          }
          return next;
        });
      }, 500);
    }

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, activeVideo.durationSeconds]);

  // Sound triggering on scene changes
  useEffect(() => {
    if (!isOpen) return;

    let currentSceneIdx = 0;
    if (currentVideoId === 'batedeira') {
      if (currentTime < 10) currentSceneIdx = 0;
      else if (currentTime < 22) currentSceneIdx = 1;
      else if (currentTime < 32) currentSceneIdx = 2;
      else currentSceneIdx = 3;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('order_bell');
        else if (currentSceneIdx === 2) playSoundEffect('printer');
        else if (currentSceneIdx === 3) playSoundEffect('pix_success');
      }
    } else if (currentVideoId === 'cliente') {
      if (currentTime < 9) currentSceneIdx = 0;
      else if (currentTime < 18) currentSceneIdx = 1;
      else if (currentTime < 27) currentSceneIdx = 2;
      else currentSceneIdx = 3;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('order_bell');
        else if (currentSceneIdx === 2) playSoundEffect('pix_success');
      }
    } else if (currentVideoId === 'b2b') {
      if (currentTime < 12) currentSceneIdx = 0;
      else if (currentTime < 24) currentSceneIdx = 1;
      else if (currentTime < 36) currentSceneIdx = 2;
      else currentSceneIdx = 3;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('order_bell');
        else if (currentSceneIdx === 2) playSoundEffect('truck_gear');
        else if (currentSceneIdx === 3) playSoundEffect('pix_success');
      }
    }
  }, [currentTime, currentVideoId, isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " && isOpen) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const progressPercent = Math.min(100, Math.max(0, (currentTime / activeVideo.durationSeconds) * 100));

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(ratio * activeVideo.durationSeconds);
  };

  const handleNextVideo = () => {
    const currentIndex = VIDEO_CATALOG.findIndex(v => v.id === currentVideoId);
    const nextIndex = (currentIndex + 1) % VIDEO_CATALOG.length;
    setCurrentVideoId(VIDEO_CATALOG[nextIndex].id);
    setCurrentTime(0);
    lastSoundSceneRef.current = -1;
  };

  const handlePrevVideo = () => {
    const currentIndex = VIDEO_CATALOG.findIndex(v => v.id === currentVideoId);
    const prevIndex = (currentIndex - 1 + VIDEO_CATALOG.length) % VIDEO_CATALOG.length;
    setCurrentVideoId(VIDEO_CATALOG[prevIndex].id);
    setCurrentTime(0);
    lastSoundSceneRef.current = -1;
  };

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Video Player Container */}
      <div 
        ref={modalContainerRef}
        className="relative z-10 w-full max-w-4xl bg-zinc-950 border border-purple-800/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* PLAYER TOP BAR */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-purple-900/30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
              {activeVideo.badge}
            </span>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">• Demonstração Interativa</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title={isMuted ? "Ativar Áudio da Operação" : "Silenciar Áudio"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-purple-400" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition hidden sm:flex"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/40 transition active:scale-90"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* VIDEO DISPLAY STAGE */}
        <div className="relative flex-1 bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 min-h-[380px] sm:min-h-[460px] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          
          {/* SIMULATED HIGH-FIDELITY INTERACTIVE VIDEO SCREEN */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto aspect-[9/16] max-h-[480px] bg-zinc-900 border-4 border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col select-none ring-1 ring-purple-500/20">
            
            {/* Phone Notch */}
            <div className="h-6 bg-zinc-950 flex items-center justify-center relative shrink-0">
              <div className="w-20 h-3 bg-zinc-800 rounded-full" />
              <div className="absolute right-4 text-[9px] font-mono text-zinc-500">100% 🔋</div>
            </div>

            {/* Simulated Phone Screen Content */}
            <div className="flex-1 bg-zinc-950 p-4 flex flex-col justify-between overflow-hidden relative">
              
              {/* VIDEO 1: BATEDEIRA FLOW */}
              {currentVideoId === 'batedeira' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-purple-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Store className="text-purple-400" size={16} />
                        <span className="text-xs font-black text-white">Batedeira Ponto do Açaí</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Loja Aberta
                      </span>
                    </div>

                    {/* Step indicator */}
                    <div className="bg-purple-950/60 border border-purple-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">
                        {currentTime < 10 && "Etapa 1: Alerta de Pedido Novo"}
                        {currentTime >= 10 && currentTime < 22 && "Etapa 2: Confirmação & Preparo"}
                        {currentTime >= 22 && currentTime < 32 && "Etapa 3: Impressão Térmica Direta"}
                        {currentTime >= 32 && "Etapa 4: Pronto & Despachado"}
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5">
                        {currentTime < 10 && "🔔 Toque sonoro ativado! O cliente finalizou o PIX."}
                        {currentTime >= 10 && currentTime < 22 && "👨‍🍳 Batedeira aceita com 1 toque no painel."}
                        {currentTime >= 22 && currentTime < 32 && "🖨️ Cupom emitido na impressora 58mm/80mm!"}
                        {currentTime >= 32 && "🛵 Motoboy a caminho para retirar no balcão."}
                      </p>
                    </div>
                  </div>

                  {/* Middle Animated Stage: Batedeira */}
                  <div className="my-auto space-y-3">
                    {currentTime < 10 && (
                      <div className="bg-gradient-to-r from-purple-900/80 to-pink-900/80 border border-purple-400 rounded-2xl p-4 shadow-xl text-center space-y-2 animate-bounce">
                        <span className="inline-block p-3 bg-purple-500/30 rounded-full text-purple-300 border border-purple-400/40 animate-pulse">
                          🔔
                        </span>
                        <h4 className="text-sm font-black text-white">NOVO PEDIDO #1084</h4>
                        <div className="text-xs text-purple-200">1x Açaí Médio 1L + Tapioca</div>
                        <div className="text-base font-black text-emerald-400">R$ 28,00 • Pago via PIX</div>
                      </div>
                    )}

                    {currentTime >= 10 && currentTime < 22 && (
                      <div className="bg-zinc-900 border border-purple-700/50 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">Status do Pedido:</span>
                          <span className="font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                            Em Preparo 🥣
                          </span>
                        </div>
                        <div className="p-3 bg-zinc-950 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-zinc-300">
                            <span>1x Açaí 1L (Médio)</span>
                            <span className="font-bold">R$ 24,00</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>+ Farinha de Tapioca</span>
                            <span className="font-bold">R$ 4,00</span>
                          </div>
                        </div>
                        <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-2 rounded-xl text-xs transition">
                          Avançar para Pronto
                        </button>
                      </div>
                    )}

                    {currentTime >= 22 && currentTime < 32 && (
                      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                          <Printer size={16} className="animate-spin" />
                          <span>Imprimindo Cupom Fiscal / Ordem...</span>
                        </div>
                        {/* Thermal Paper Animation */}
                        <div className="bg-amber-100 text-zinc-900 p-3 rounded-lg font-mono text-[10px] space-y-1 shadow-md border border-amber-300 transform -translate-y-1 transition-transform">
                          <div className="text-center font-bold text-xs border-b border-zinc-400 pb-1">
                            *** AÇAÍFOOD DELIVERY ***
                          </div>
                          <div className="flex justify-between">
                            <span>PEDIDO: #1084</span>
                            <span>HORA: 19:42</span>
                          </div>
                          <div>CLIENTE: Carlos E. • (91) 98...</div>
                          <div>END: Rua dos Açaizeiros, 120</div>
                          <div className="border-t border-dashed border-zinc-400 pt-1 font-bold">
                            ITEM: 1L Açaí Médio + Tapioca
                          </div>
                          <div className="text-center font-bold text-xs pt-1 text-purple-900">
                            PIN DE ENTREGA: [ 4 8 2 1 ]
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 32 && (
                      <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2">
                        <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                        <h4 className="text-sm font-black text-white">Pedido Pronto no Balcão!</h4>
                        <p className="text-[11px] text-emerald-200">
                          Split de R$ 28,00 creditado automaticamente na sua conta Asaas.
                        </p>
                        <div className="text-[10px] text-zinc-400 bg-zinc-950/80 p-2 rounded-lg">
                          Motoboy Marcos R. está a 300 metros da batedeira.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-center text-zinc-500">
                    AçaíFood Batedeira Pro • Sistema Operacional
                  </div>
                </div>
              )}

              {/* VIDEO 2: CLIENTE FLOW */}
              {currentVideoId === 'cliente' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-pink-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="text-pink-400" size={16} />
                        <span className="text-xs font-black text-white">AçaíFood Cliente</span>
                      </div>
                      <span className="text-[10px] bg-pink-500/20 text-pink-300 font-bold px-2 py-0.5 rounded-full border border-pink-500/30 flex items-center gap-1">
                        <MapPin size={10} /> Belém / Ananindeua
                      </span>
                    </div>

                    <div className="bg-pink-950/60 border border-pink-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-pink-300 uppercase tracking-wide">
                        {currentTime < 9 && "Etapa 1: Batedeiras Vizinhas por GPS"}
                        {currentTime >= 9 && currentTime < 18 && "Etapa 2: Consistência & Acompanhamentos"}
                        {currentTime >= 18 && currentTime < 27 && "Etapa 3: PIX Copia e Cola / Split"}
                        {currentTime >= 27 && "Etapa 4: Rota em Tempo Real & PIN"}
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5">
                        {currentTime < 9 && "📍 Mostra as batedeiras batendo açaí fresquinho perto de você."}
                        {currentTime >= 9 && currentTime < 18 && "🥣 Escolha: Popular, Médio ou Grosso, com farinha ou sem."}
                        {currentTime >= 18 && currentTime < 27 && "⚡ Pagamento aprovado em 2 segundos pelo Banco Central."}
                        {currentTime >= 27 && "🔒 Validação segura do PIN no portão ao receber a tigela."}
                      </p>
                    </div>
                  </div>

                  {/* Middle Animated Stage: Cliente */}
                  <div className="my-auto space-y-3">
                    {currentTime < 9 && (
                      <div className="bg-zinc-900 border border-pink-700/50 rounded-2xl p-3.5 space-y-2">
                        <div className="text-[11px] font-bold text-zinc-300">Batedeiras Próximas (Radar GPS)</div>
                        <div className="space-y-1.5">
                          <div className="p-2 bg-pink-950/40 border border-pink-500/40 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-white">Batedeira do Seu Zé</div>
                              <div className="text-[10px] text-zinc-400">800m • Aberta agora</div>
                            </div>
                            <span className="text-[10px] font-bold text-pink-400 bg-pink-900/40 px-2 py-0.5 rounded">4.9 ★</span>
                          </div>
                          <div className="p-2 bg-zinc-950 rounded-xl flex justify-between items-center text-xs opacity-75">
                            <div>
                              <div className="font-bold text-zinc-200">Açaí Puro Pará</div>
                              <div className="text-[10px] text-zinc-400">1.4km • Aberta agora</div>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400">4.8 ★</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 9 && currentTime < 18 && (
                      <div className="bg-zinc-900 border border-pink-600/50 rounded-2xl p-3.5 space-y-2.5">
                        <div className="text-xs font-bold text-white">Escolha a Consistência:</div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          <div className="p-2 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-800">Popular</div>
                          <div className="p-2 rounded-xl bg-pink-600 text-white font-bold shadow-md">Médio ✓</div>
                          <div className="p-2 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-800">Grosso</div>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl text-[11px] space-y-1">
                          <div className="flex justify-between text-zinc-300">
                            <span>+ Farinha de Bragança torrada</span>
                            <span className="text-pink-400 font-bold">Grátis</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>+ Açúcar separado</span>
                            <span className="text-pink-400 font-bold">Grátis</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 18 && currentTime < 27 && (
                      <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2">
                        <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                          <QrCode size={20} />
                        </div>
                        <h4 className="text-xs font-black text-white">PIX Dinâmico Asaas</h4>
                        <div className="text-[11px] text-emerald-300 font-mono bg-zinc-950 p-1.5 rounded border border-emerald-900/50">
                          00020126580014br.gov.bcb.pix...
                        </div>
                        <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 size={14} /> Pagamento Aprovado Instantâneo!
                        </div>
                      </div>
                    )}

                    {currentTime >= 27 && (
                      <div className="bg-zinc-900 border border-pink-500/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-300 font-bold flex items-center gap-1">
                            <Navigation size={12} className="text-pink-400" /> Motoboy a Caminho
                          </span>
                          <span className="text-[10px] text-pink-400 font-bold">Chega em 6 min</span>
                        </div>
                        <div className="bg-pink-950/60 p-3 rounded-xl border border-pink-500/40 text-center space-y-1">
                          <div className="text-[10px] text-zinc-300 uppercase tracking-wider font-bold">
                            Seu PIN Seguro de Entrega
                          </div>
                          <div className="text-2xl font-black text-white tracking-widest font-mono">
                            4 8 2 1
                          </div>
                          <div className="text-[9px] text-pink-200">
                            Informe apenas quando o motoboy estiver no seu portão.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-center text-zinc-500">
                    AçaíFood App • Feito para quem ama Açaí
                  </div>
                </div>
              )}

              {/* VIDEO 3: B2B FLOW */}
              {currentVideoId === 'b2b' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-amber-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Truck className="text-amber-400" size={16} />
                        <span className="text-xs font-black text-white">Mercado B2B do Fruto</span>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        Carga Pesada
                      </span>
                    </div>

                    <div className="bg-amber-950/60 border border-amber-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                        {currentTime < 12 && "Etapa 1: Oferta de Fruto Ribeirinho"}
                        {currentTime >= 12 && currentTime < 24 && "Etapa 2: Compra em Lote pela Loja"}
                        {currentTime >= 24 && currentTime < 36 && "Etapa 3: Frete Pesado com Caminhão"}
                        {currentTime >= 36 && "Etapa 4: Descarga & Liberação"}
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5">
                        {currentTime < 12 && "🍇 Produtores cadastram safra de latas colhidas do dia."}
                        {currentTime >= 12 && currentTime < 24 && "🤝 Batedeiras garantem insumo de alta qualidade sem intermediários."}
                        {currentTime >= 24 && currentTime < 36 && "🚚 Caminhão parceiro calcula frete automático por peso e km."}
                        {currentTime >= 36 && "💰 Pagamento liberado do escrow direto na conta do fornecedor."}
                      </p>
                    </div>
                  </div>

                  {/* Middle Animated Stage: B2B */}
                  <div className="my-auto space-y-3">
                    {currentTime < 12 && (
                      <div className="bg-zinc-900 border border-amber-700/50 rounded-2xl p-3.5 space-y-2">
                        <div className="text-xs font-bold text-white">Novo Lote Disponível:</div>
                        <div className="p-2.5 bg-amber-950/50 border border-amber-500/40 rounded-xl space-y-1">
                          <div className="flex justify-between text-xs font-bold text-amber-200">
                            <span>50 Latas de Açaí Chumbinho</span>
                            <span>R$ 48,00 / lata</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">Origem: Igarapé-Miri / Abaetetuba • Safra fresca</div>
                          <div className="text-[11px] font-bold text-emerald-400 pt-1">Total Lote: R$ 2.400,00</div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 12 && currentTime < 24 && (
                      <div className="bg-zinc-900 border border-purple-600/50 rounded-2xl p-3.5 space-y-2">
                        <div className="text-xs font-bold text-white">Batedeira Comprando Insumo:</div>
                        <div className="p-2 bg-zinc-950 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between text-zinc-300">
                            <span>Quantidade Selecionada:</span>
                            <span className="font-bold text-white">30 Latas</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>Garantia de Pagamento:</span>
                            <span className="text-emerald-400 font-bold">Escrow Protegido</span>
                          </div>
                        </div>
                        <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-xl text-xs transition">
                          Contratar Frete & Comprar
                        </button>
                      </div>
                    )}

                    {currentTime >= 24 && currentTime < 36 && (
                      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <Truck size={14} /> Frete de Carga Pesada
                          </span>
                          <span className="text-[10px] text-zinc-400">Em Trânsito</span>
                        </div>
                        <div className="p-2.5 bg-amber-950/40 border border-amber-800/40 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-zinc-300">
                            <span>Distância Rota:</span>
                            <span className="font-bold text-white">42 km</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>Carga estimada:</span>
                            <span className="font-bold text-white">420 kg (30 latas)</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-bold border-t border-amber-900/40 pt-1">
                            <span>Frete Caminhoneiro:</span>
                            <span>R$ 180,00</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 36 && (
                      <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2">
                        <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                        <h4 className="text-sm font-black text-white">Descarga Confirmada!</h4>
                        <p className="text-[11px] text-emerald-200">
                          Latas conferidas no pátio. Pagamento liberado imediatamente para o produtor e motorista.
                        </p>
                        <div className="text-[10px] text-zinc-400 bg-zinc-950/80 p-2 rounded-lg font-mono">
                          Comprovante de split emitido via Asaas
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-center text-zinc-500">
                    AçaíFood B2B Logística • Fruto Direto da Fonte
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Home Indicator */}
            <div className="h-4 bg-zinc-950 flex items-center justify-center shrink-0">
              <div className="w-24 h-1 bg-zinc-700 rounded-full" />
            </div>

          </div>

          {/* Floating Next/Prev Video Arrows */}
          <button
            onClick={handlePrevVideo}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-purple-900 text-white border border-purple-800/50 flex items-center justify-center shadow-lg transition active:scale-90"
            title="Vídeo Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button
            onClick={handleNextVideo}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-purple-900 text-white border border-purple-800/50 flex items-center justify-center shadow-lg transition active:scale-90"
            title="Próximo Vídeo"
          >
            <ChevronRight size={20} />
          </button>

        </div>

        {/* CONTROLS & TIMELINE SCRUBBER */}
        <div className="px-4 sm:px-6 py-4 bg-zinc-900/95 border-t border-purple-900/40 space-y-3">
          
          {/* Progress bar with clickable scrubbing */}
          <div 
            onClick={handleSeek}
            className="w-full h-2.5 bg-zinc-800 hover:h-3 rounded-full cursor-pointer relative overflow-hidden transition-all group"
          >
            <div 
              className={`h-full transition-all duration-100 ${
                activeVideo.colorScheme === 'purple' ? 'bg-gradient-to-r from-purple-500 to-purple-400' :
                activeVideo.colorScheme === 'pink' ? 'bg-gradient-to-r from-pink-500 to-pink-400' :
                'bg-gradient-to-r from-amber-500 to-amber-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Player controls row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Playback Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-md transition active:scale-95"
                  title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
                </button>

                <button
                  onClick={() => { setCurrentTime(0); lastSoundSceneRef.current = -1; }}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  title="Reiniciar Vídeo"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Timecode */}
              <div className="font-mono text-xs text-zinc-300">
                <span className="text-white font-bold">{formatSeconds(currentTime)}</span>
                <span className="text-zinc-500"> / {formatSeconds(activeVideo.durationSeconds)}</span>
              </div>

              {/* Sound indicator toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-xs text-purple-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/40 sm:ml-2"
              >
                {isMuted ? <VolumeX size={14} className="text-zinc-500" /> : <Volume2 size={14} className="text-emerald-400" />}
                <span className="text-[11px]">{isMuted ? "Sem som" : "Som ativo"}</span>
              </button>

            </div>

            {/* Quick Switch Video Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
              {VIDEO_CATALOG.map((vid) => (
                <button
                  key={vid.id}
                  onClick={() => {
                    setCurrentVideoId(vid.id);
                    setCurrentTime(0);
                    lastSoundSceneRef.current = -1;
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    currentVideoId === vid.id
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {vid.id === 'batedeira' && '🏪 Batedeira'}
                  {vid.id === 'cliente' && '📱 Cliente'}
                  {vid.id === 'b2b' && '🚚 B2B & Frete'}
                </button>
              ))}
            </div>

            {/* Direct CTA action link */}
            <Link
              href={activeVideo.ctaLink}
              onClick={onClose}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition active:scale-95"
            >
              <span>{activeVideo.ctaText}</span>
              <ArrowRight size={14} />
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}
