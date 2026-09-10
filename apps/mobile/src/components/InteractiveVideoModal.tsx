"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, 
  Minimize2, X, Store, Smartphone, Truck, Bike, CheckCircle2, 
  Printer, ArrowRight, ChevronRight, ChevronLeft,
  MapPin, QrCode, Navigation, ShieldCheck, Recycle, Trash2,
  Sparkles, Layers
} from "lucide-react";
import Link from "next/link";

export type VideoId = 'ciclo_animado' | 'ciclo_completo' | 'motoboy' | 'caminhao' | 'batedeira' | 'cliente' | 'b2b';

export interface VideoItem {
  id: VideoId;
  title: string;
  badge: string;
  role: string;
  durationSeconds: number;
  description: string;
  ctaText: string;
  ctaLink: string;
  colorScheme: 'purple' | 'pink' | 'amber' | 'blue' | 'emerald';
  videoUrl?: string;
}

export const VIDEO_CATALOG: VideoItem[] = [
  {
    id: 'ciclo_animado',
    title: 'Animação AçaíFood: Personagens & Vozes do Ecossistema',
    badge: '🎭 Vídeo Animado • Personagens & Áudio',
    role: 'A História Viva do Açaí',
    durationSeconds: 88,
    description: 'Animação completa com personagens vivos, balões de fala e narração com áudio: Carlos (Cliente), Seu Manoel (Batedeira), Marcos (Motoboy), Tião (Caminhoneiro), Zé Ribeirinho (Produtor) e Beto (Caçamba)!',
    ctaText: 'Fazer Parte da História',
    ctaLink: '/parceiros',
    colorScheme: 'purple',
    videoUrl: '/videos/ciclo_animado.mp4'
  },
  {
    id: 'ciclo_completo',
    title: 'O Ciclo Completo: Do Fruto à Tigela e ao Descarte do Caroço',
    badge: '🎬 Super Demonstração • Ciclo Completo',
    role: 'O Ecossistema Completo do Açaí',
    durationSeconds: 90,
    description: 'Veja todo o processo: cliente pede, loja imprime comanda, motoboy entrega com PIN, loja compra frutos, caminhoneiro descarrega e valida o PIN B2B com a loja, e a caçamba recolhe o caroço residual!',
    ctaText: 'Fazer Parte do AçaíFood',
    ctaLink: '/parceiros',
    colorScheme: 'purple',
    videoUrl: '/videos/ciclo_completo.mp4'
  },
  {
    id: 'motoboy',
    title: 'No Motoboy: Corrida GPS, PIN Seguro e Saque PIX',
    badge: 'Entrega Rápida (Moto)',
    role: 'Transporte Urbano de Açaí',
    durationSeconds: 38,
    description: 'Radar de corridas em tempo real com distância e valor líquido do frete. Retirada no balcão, rota assistida por GPS e validação do PIN de segurança para saque instantâneo.',
    ctaText: 'Cadastrar como Motoboy',
    ctaLink: '/parceiros',
    colorScheme: 'amber',
    videoUrl: '/videos/motoboy.mp4'
  },
  {
    id: 'caminhao',
    title: 'No Caminhão: Frete Pesado, Latas e Rota B2B',
    badge: 'Frete Pesado (Caminhão)',
    role: 'Carga Pesada & Ribeirinha',
    durationSeconds: 42,
    description: 'Transporte de lotes e toneladas de fruto colhido de açaí. Frete calculado automaticamente por km e peso, manifesto digital e liberação de pagamento na doca.',
    ctaText: 'Cadastrar Meu Caminhão',
    ctaLink: '/parceiros',
    colorScheme: 'blue',
    videoUrl: '/videos/caminhao.mp4'
  },
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
    title: 'O Mercado B2B e Produtores de Açaí',
    badge: 'Mercado do Fruto',
    role: 'Produtores & Batedeiras',
    durationSeconds: 45,
    description: 'Negociação direta de latas de fruto entre produtores ribeirinhos e batedeiras com pagamento em escrow protegido e frete conectado.',
    ctaText: 'Acessar Mercado de Frutos',
    ctaLink: '/parceiros',
    colorScheme: 'emerald',
    videoUrl: '/videos/b2b.mp4'
  }
];

interface InteractiveVideoModalProps {
  initialVideoId: VideoId | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InteractiveVideoModal({ initialVideoId, isOpen, onClose }: InteractiveVideoModalProps) {
  const [currentVideoId, setCurrentVideoId] = useState<VideoId>('ciclo_completo');
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

  // Text-to-Speech narration for animated characters
  const speakNarration = (text: string) => {
    if (isMuted || typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Speech synthesis fallback
    }
  };

  // Web Audio synthesizer for realistic app feedback sound effects
  const playSoundEffect = (type: 'order_bell' | 'printer' | 'pix_success' | 'truck_gear' | 'moto_horn' | 'truck_horn' | 'cacamba' | 'character_pop') => {
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

      const now = ctx.currentTime;

      if (type === 'character_pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'order_bell') {
        // Double ding bell sound
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
      } else if (type === 'moto_horn') {
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(440, now + i * 0.12);
          gain.gain.setValueAtTime(0.14, now + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.12 + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.08);
        }
      } else if (type === 'truck_horn') {
        [185, 233].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.55);
        });
      } else if (type === 'cacamba') {
        // Hydraulic mechanical rumble sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(185, now + 0.35);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio context may be suspended before user action
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

    if (currentVideoId === 'ciclo_animado') {
      if (currentTime < 14) currentSceneIdx = 0;
      else if (currentTime < 26) currentSceneIdx = 1;
      else if (currentTime < 38) currentSceneIdx = 2;
      else if (currentTime < 50) currentSceneIdx = 3;
      else if (currentTime < 62) currentSceneIdx = 4;
      else if (currentTime < 68) currentSceneIdx = 5;
      else if (currentTime < 74) currentSceneIdx = 6;
      else if (currentTime < 81) currentSceneIdx = 7;
      else currentSceneIdx = 8;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        playSoundEffect('character_pop');
        if (currentSceneIdx === 0) {
          setTimeout(() => playSoundEffect('pix_success'), 200);
          speakNarration("Carlos pede açaí grosso pelo aplicativo e paga no PIX.");
        } else if (currentSceneIdx === 1) {
          setTimeout(() => playSoundEffect('printer'), 200);
          speakNarration("Seu Manoel da batedeira aceita e imprime a comanda na hora.");
        } else if (currentSceneIdx === 2) {
          setTimeout(() => playSoundEffect('moto_horn'), 200);
          speakNarration("Marcos motoboy chega na loja e retira a embalagem térmica.");
        } else if (currentSceneIdx === 3) {
          setTimeout(() => playSoundEffect('pix_success'), 200);
          speakNarration("No portão, Carlos informa o PIN quatro oito dois um.");
        } else if (currentSceneIdx === 4) {
          setTimeout(() => playSoundEffect('order_bell'), 200);
          speakNarration("Seu Manoel compra frutos do Zé Ribeirinho com pagamento protegido.");
        } else if (currentSceneIdx === 5) {
          setTimeout(() => playSoundEffect('truck_horn'), 200);
          speakNarration("Tião caminhoneiro encosta na doca e pede o PIN da loja.");
        } else if (currentSceneIdx === 6) {
          setTimeout(() => playSoundEffect('pix_success'), 200);
          speakNarration("PIN nove três cinco quatro validado. Frete liberado para o Tião.");
        } else if (currentSceneIdx === 7) {
          setTimeout(() => playSoundEffect('order_bell'), 200);
          speakNarration("Seu Manoel aciona a caçamba para retirar o caroço de açaí.");
        } else if (currentSceneIdx === 8) {
          setTimeout(() => playSoundEffect('cacamba'), 200);
          speakNarration("Beto da caçamba recolhe o caroço para biomassa. Pátio limpo!");
        }
      }
    } else if (currentVideoId === 'ciclo_completo') {
      if (currentTime < 14) currentSceneIdx = 0;
      else if (currentTime < 26) currentSceneIdx = 1;
      else if (currentTime < 38) currentSceneIdx = 2;
      else if (currentTime < 50) currentSceneIdx = 3;
      else if (currentTime < 62) currentSceneIdx = 4;
      else if (currentTime < 68) currentSceneIdx = 5;
      else if (currentTime < 74) currentSceneIdx = 6;
      else if (currentTime < 83) currentSceneIdx = 7;
      else currentSceneIdx = 8;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('pix_success');
        else if (currentSceneIdx === 1) playSoundEffect('printer');
        else if (currentSceneIdx === 2) playSoundEffect('moto_horn');
        else if (currentSceneIdx === 3) playSoundEffect('pix_success');
        else if (currentSceneIdx === 4) playSoundEffect('order_bell');
        else if (currentSceneIdx === 5) playSoundEffect('truck_horn');
        else if (currentSceneIdx === 6) playSoundEffect('pix_success'); // PIN validado na loja
        else if (currentSceneIdx === 7) playSoundEffect('cacamba');
        else if (currentSceneIdx === 8) playSoundEffect('pix_success');
      }
    } else if (currentVideoId === 'motoboy') {
      if (currentTime < 9) currentSceneIdx = 0;
      else if (currentTime < 18) currentSceneIdx = 1;
      else if (currentTime < 28) currentSceneIdx = 2;
      else currentSceneIdx = 3;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('moto_horn');
        else if (currentSceneIdx === 1) playSoundEffect('order_bell');
        else if (currentSceneIdx === 2) playSoundEffect('moto_horn');
        else if (currentSceneIdx === 3) playSoundEffect('pix_success');
      }
    } else if (currentVideoId === 'caminhao') {
      if (currentTime < 10) currentSceneIdx = 0;
      else if (currentTime < 20) currentSceneIdx = 1;
      else if (currentTime < 31) currentSceneIdx = 2;
      else currentSceneIdx = 3;

      if (currentSceneIdx !== lastSoundSceneRef.current) {
        lastSoundSceneRef.current = currentSceneIdx;
        if (currentSceneIdx === 0) playSoundEffect('truck_horn');
        else if (currentSceneIdx === 1) playSoundEffect('order_bell');
        else if (currentSceneIdx === 2) playSoundEffect('truck_gear');
        else if (currentSceneIdx === 3) playSoundEffect('pix_success');
      }
    } else if (currentVideoId === 'batedeira') {
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
        <div className="relative flex-1 bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 min-h-[400px] sm:min-h-[490px] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          
          {/* SIMULATED HIGH-FIDELITY INTERACTIVE VIDEO SCREEN */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto aspect-[9/16] max-h-[510px] bg-zinc-900 border-4 border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col select-none ring-1 ring-purple-500/20">
            
            {/* Phone Notch */}
            <div className="h-6 bg-zinc-950 flex items-center justify-center relative shrink-0">
              <div className="w-20 h-3 bg-zinc-800 rounded-full" />
              <div className="absolute right-4 text-[9px] font-mono text-zinc-500">100% 🔋</div>
            </div>

            {/* Simulated Phone Screen Content */}
            <div className="flex-1 bg-zinc-950 p-4 flex flex-col justify-between overflow-hidden relative">
              
              {/* VIDEO 0: CICLO ANIMADO COM PERSONAGENS E ÁUDIO */}
              {currentVideoId === 'ciclo_animado' && (
                <div className="h-full flex flex-col justify-between py-1">
                  
                  {/* Header do Episódio Animado */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center border-b border-purple-900/40 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base animate-bounce">🎭</span>
                        <span className="text-xs font-black text-white">Turma do AçaíFood: Ciclo Vivo</span>
                      </div>
                      <span className="text-[10px] bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                        <Sparkles size={10} /> Personagens & Voz
                      </span>
                    </div>

                    {/* Banner do Ato com Personagem Ativo */}
                    <div className="bg-gradient-to-r from-purple-950 via-zinc-900 to-zinc-950 border border-purple-500/50 rounded-xl p-2 shadow-inner flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-pink-400">
                          {currentTime < 14 && "Ato 1 • Carlos (O Cliente)"}
                          {currentTime >= 14 && currentTime < 26 && "Ato 2 • Seu Manoel (Batedeira)"}
                          {currentTime >= 26 && currentTime < 38 && "Ato 3 • Marcos (O Motoboy)"}
                          {currentTime >= 38 && currentTime < 50 && "Ato 4 • Carlos & Marcos (PIN Seguro)"}
                          {currentTime >= 50 && currentTime < 62 && "Ato 5 • Zé Ribeirinho & Seu Manoel"}
                          {currentTime >= 62 && currentTime < 68 && "Ato 6 • Tião Caminhoneiro na Doca"}
                          {currentTime >= 68 && currentTime < 74 && "Ato 6B • PIN da Doca Validado!"}
                          {currentTime >= 74 && currentTime < 81 && "Ato 7 • Seu Manoel & A Caçamba"}
                          {currentTime >= 81 && "Ato 8 • Beto (Motorista da Caçamba)"}
                        </span>
                        <p className="text-[11px] text-white font-bold leading-tight">
                          {currentTime < 14 && "😋 'Hum, que vontade de um açaí grosso com farinha d'água!'"}
                          {currentTime >= 14 && currentTime < 26 && "👨‍🍳 'Pedido aprovado no Asaas! Comanda impressa!'"}
                          {currentTime >= 26 && currentTime < 38 && "🏍️ 'Cheguei na loja, bag pronta e lacrada na mão!'"}
                          {currentTime >= 38 && currentTime < 50 && "🔑 'Meu PIN é 4821!' ➔ 'Entrega liberada, valeu!'"}
                          {currentTime >= 50 && currentTime < 62 && "🌿 'Comprei 50 latas do Zé Ribeirinho em custódia!'"}
                          {currentTime >= 62 && currentTime < 68 && "🚚 'Opa Seu Manoel, cheguei com a carga! Qual o PIN?'"}
                          {currentTime >= 68 && currentTime < 74 && "🔐 'PIN 9354 validado!' ➔ Frete de R$ 280,00 no bolso!"}
                          {currentTime >= 74 && currentTime < 81 && "♻️ 'Hora de dar destino ecológico ao caroço batido!'"}
                          {currentTime >= 81 && "🚜 'Pátio limpo e caroço levado pra queima sustentável!'"}
                        </p>
                      </div>

                      {/* Avatar dinâmico do personagem ativo */}
                      <div className="w-11 h-11 rounded-2xl bg-purple-900/60 border border-purple-400/50 flex items-center justify-center text-2xl shadow-lg shrink-0 animate-pulse">
                        {currentTime < 14 && "🧑‍💻"}
                        {currentTime >= 14 && currentTime < 26 && "👨‍🍳"}
                        {currentTime >= 26 && currentTime < 38 && "🏍️"}
                        {currentTime >= 38 && currentTime < 50 && "🤝"}
                        {currentTime >= 50 && currentTime < 62 && "🛶"}
                        {currentTime >= 62 && currentTime < 74 && "🚚"}
                        {currentTime >= 74 && currentTime < 81 && "♻️"}
                        {currentTime >= 81 && "🚜"}
                      </div>
                    </div>
                  </div>

                  {/* PALCO CENTRAL ANIMADO: CENÁRIOS E DIÁLOGOS */}
                  <div className="my-auto space-y-2.5">
                    
                    {/* ATO 1: CARLOS PEDE AÇAÍ */}
                    {currentTime < 14 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-pink-600 border-2 border-pink-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            🧑‍💻
                          </div>
                          <div className="bg-pink-950/80 border border-pink-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[220px]">
                            <span className="font-black text-pink-300 block text-[10px]">Carlos (Cliente Sedento):</span>
                            "Vou pedir 1 Litro de Açaí Grosso com farinha de Bragança pelo AçaíFood!"
                          </div>
                        </div>

                        {/* Celular do Carlos */}
                        <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-white font-bold">
                            <span className="flex items-center gap-1 text-pink-400">🥣 1L Grosso + Farinha</span>
                            <span className="text-emerald-400 font-mono">R$ 28,00</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-950 p-2 rounded-xl text-[10px]">
                            <span className="text-zinc-400">Pagamento: PIX Automático</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 size={11} /> Confirmado
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATO 2: SEU MANOEL NA BATEDEIRA */}
                    {currentTime >= 14 && currentTime < 26 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-purple-600 border-2 border-purple-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            👨‍🍳
                          </div>
                          <div className="bg-purple-950/80 border border-purple-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-purple-300 block text-[10px]">Seu Manoel (Batedor Raiz):</span>
                            "Ding-dong! Pedido do Carlos apitou aqui. Já apertei 'Aceitar' e o cupom já tá saindo na térmica!"
                          </div>
                        </div>

                        {/* Impressora saindo cupom */}
                        <div className="bg-amber-100 text-zinc-950 p-2.5 rounded-xl font-mono text-[10px] space-y-0.5 shadow border-l-4 border-purple-600 animate-pulse">
                          <div className="font-black text-center border-b border-zinc-400 pb-0.5">🏪 BATEDEIRA DO MANOEL</div>
                          <div className="flex justify-between"><span>PEDIDO #1084</span><span>Carlos E.</span></div>
                          <div className="font-bold text-purple-900">1L AÇAÍ GROSSO C/ FARINHA</div>
                          <div className="bg-zinc-900 text-yellow-300 p-1 rounded font-black text-center mt-1">
                            🔐 PIN CLIENTE: [ 4 8 2 1 ]
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATO 3: MARCOS MOTOBOY CHEGA */}
                    {currentTime >= 26 && currentTime < 38 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-amber-600 border-2 border-amber-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            🏍️
                          </div>
                          <div className="bg-amber-950/80 border border-amber-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-amber-300 block text-[10px]">Marcos (Motoboy Veloz):</span>
                            "Buzinei! Cheguei na loja do Seu Manoel num instante. Bag térmica estalada e pronta pra entrega!"
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-amber-500/40 p-2.5 rounded-2xl space-y-1 text-xs">
                          <div className="flex justify-between items-center text-zinc-200">
                            <span>Destino: Rua dos Açaizeiros</span>
                            <span className="text-amber-400 font-bold">1.4 km (GPS)</span>
                          </div>
                          <div className="bg-zinc-950 p-2 rounded-xl flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400">Frete Líquido do Marcos:</span>
                            <span className="text-emerald-400 font-black">+ R$ 8,50</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATO 4: CARLOS E MARCOS NO PORTÃO (PIN SEGURO) */}
                    {currentTime >= 38 && currentTime < 50 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-pink-600 border border-pink-300 flex items-center justify-center text-xl">
                            🧑‍💻
                          </div>
                          <span className="text-xl font-black text-amber-400">🤝</span>
                          <div className="w-11 h-11 rounded-2xl bg-amber-600 border border-amber-300 flex items-center justify-center text-xl">
                            🏍️
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-emerald-500/60 p-3 rounded-2xl space-y-1.5 text-center">
                          <span className="text-[10px] text-zinc-400 block font-bold">Carlos passa o código ao Marcos:</span>
                          <div className="text-2xl font-mono font-black text-emerald-400 tracking-widest bg-zinc-950 py-1.5 rounded-xl border border-emerald-500/40">
                            4 8 2 1
                          </div>
                          <p className="text-[11px] text-zinc-200 font-bold">
                            ✅ PIN Aprovado! Carlos toma açaí gelado e Marcos recebe o PIX instantâneo!
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ATO 5: SEU MANOEL COMPRA DO ZÉ RIBEIRINHO */}
                    {currentTime >= 50 && currentTime < 62 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-600 border-2 border-emerald-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            🛶
                          </div>
                          <div className="bg-emerald-950/80 border border-emerald-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-emerald-300 block text-[10px]">Zé Ribeirinho (Produtor do Fruto):</span>
                            "Colhi 50 latas de açaí chumbinho graúdo nas ilhas! O Manoel já comprou tudo no B2B com escrow!"
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-purple-500/40 p-2.5 rounded-2xl space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-white font-bold">
                            <span>Lote #8942: 50 Latas (700 kg)</span>
                            <span className="text-emerald-400">Escrow Protegido</span>
                          </div>
                          <div className="bg-purple-950/60 p-2 rounded-xl flex justify-between items-center text-[10px]">
                            <span className="text-purple-300 font-bold">🔑 PIN da Loja do Seu Manoel:</span>
                            <span className="font-mono font-black text-white bg-zinc-900 px-2 py-0.5 rounded border border-purple-500">9 3 5 4</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATO 6: TIÃO CAMINHONEIRO NA DOCA & VALIDAÇÃO DO PIN */}
                    {currentTime >= 62 && currentTime < 74 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-blue-600 border-2 border-blue-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            🚚
                          </div>
                          <div className="bg-blue-950/80 border border-blue-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-blue-300 block text-[10px]">Tião (Caminhoneiro da Carga):</span>
                            {currentTime < 68 
                              ? "'Encostei o bruto na doca do Seu Manoel! Me passa o PIN pra descarregar as 50 latas!'" 
                              : "'Opa, digitou 9354 e deu certinho! Carga conferida e R$ 280 de frete no meu bolso!'"}
                          </div>
                        </div>

                        <div className="bg-zinc-900 border-2 border-blue-400 p-2.5 rounded-2xl text-center space-y-1 text-xs">
                          {currentTime < 68 ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-amber-300 font-bold">Seu Manoel informa o PIN da loja:</span>
                              <div className="text-xl font-mono font-black text-amber-300 tracking-widest animate-pulse">
                                [ 9 3 5 4 ]
                              </div>
                              <span className="text-[10px] text-zinc-400">Tião digitando na doca...</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-emerald-400 font-black text-xs flex items-center justify-center gap-1">
                                <ShieldCheck size={14} /> PIN 9354 CONFIRMADO!
                              </span>
                              <div className="bg-zinc-950 p-1.5 rounded-xl text-emerald-300 font-mono font-black text-sm">
                                Frete Pesado: + R$ 280,00 Liquidado
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ATO 7: SEU MANOEL CHAMA A CAÇAMBA */}
                    {currentTime >= 74 && currentTime < 81 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-purple-600 border-2 border-purple-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            👨‍🍳
                          </div>
                          <div className="bg-purple-950/80 border border-purple-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-purple-300 block text-[10px]">Seu Manoel:</span>
                            "Bati o açaí todo, agora sobraram 35 sacas de caroço. Não deixo nada acumular: chamei a caçamba no app!"
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-amber-500/40 p-2.5 rounded-2xl text-center space-y-1 text-xs">
                          <span className="text-amber-300 font-bold block text-[11px]">♻️ Solicitação de Coleta de Resíduo</span>
                          <div className="bg-amber-600 text-white font-black py-1.5 rounded-xl text-xs animate-pulse">
                            🚜 Ordem de Caçamba Disparada via GPS
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATO 8: BETO DA CAÇAMBA ENCERRA O CICLO */}
                    {currentTime >= 81 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-teal-600 border-2 border-teal-300 flex items-center justify-center text-2xl shadow-lg animate-bounce">
                            🚜
                          </div>
                          <div className="bg-teal-950/80 border border-teal-500/50 p-2.5 rounded-2xl rounded-tl-none shadow text-xs text-white max-w-[230px]">
                            <span className="font-black text-teal-300 block text-[10px]">Beto (Motorista da Caçamba):</span>
                            "Aceitei a ordem! Caçamba cheia, caroços encaminhados pra olaria e biomassa. Pátio 100% limpo!"
                          </div>
                        </div>

                        <div className="bg-gradient-to-r from-emerald-950/90 to-teal-950/90 border-2 border-emerald-400 p-3 rounded-2xl text-center space-y-1">
                          <span className="text-xs font-black text-emerald-300 uppercase flex items-center justify-center gap-1">
                            <CheckCircle2 size={16} /> Ecossistema Sustentável Completo!
                          </span>
                          <p className="text-[10px] text-zinc-300">
                            Do Ribeirinho à Tigela e da Tigela à Reciclagem do Caroço.
                          </p>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Scrub de Personagens / Capítulos Rápidos */}
                  <div className="grid grid-cols-4 gap-1 text-[8px] pt-1">
                    <button onClick={() => setCurrentTime(0)} className={`p-1 rounded text-center truncate ${currentTime < 26 ? 'bg-pink-600 text-white font-black' : 'bg-zinc-900 text-zinc-400'}`}>
                      1. Carlos & Manoel
                    </button>
                    <button onClick={() => setCurrentTime(26)} className={`p-1 rounded text-center truncate ${currentTime >= 26 && currentTime < 50 ? 'bg-amber-600 text-white font-black' : 'bg-zinc-900 text-zinc-400'}`}>
                      2. Marcos Motoboy
                    </button>
                    <button onClick={() => setCurrentTime(50)} className={`p-1 rounded text-center truncate ${currentTime >= 50 && currentTime < 74 ? 'bg-blue-600 text-white font-black' : 'bg-zinc-900 text-zinc-400'}`}>
                      3. Zé & Tião Caminhão
                    </button>
                    <button onClick={() => setCurrentTime(74)} className={`p-1 rounded text-center truncate ${currentTime >= 74 ? 'bg-teal-600 text-white font-black' : 'bg-zinc-900 text-zinc-400'}`}>
                      4. Beto Caçamba
                    </button>
                  </div>

                </div>
              )}

              {/* VIDEO MASTER: CICLO COMPLETO DO ECOSSISTEMA */}
              {currentVideoId === 'ciclo_completo' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-purple-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="text-amber-400" size={16} />
                        <span className="text-xs font-black text-white">AçaíFood: O Ciclo Total</span>
                      </div>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                        Cadeia Completa
                      </span>
                    </div>

                    {/* Step indicator box */}
                    <div className="bg-gradient-to-r from-purple-950/80 to-zinc-900 border border-purple-500/40 rounded-xl p-2.5">
                      <div className="text-[10px] font-black text-amber-300 uppercase tracking-wide flex items-center gap-1">
                        <span>
                          {currentTime < 14 && "Passo 1/8: Cliente Faz Pedido"}
                          {currentTime >= 14 && currentTime < 26 && "Passo 2/8: Loja Aceita & Imprime"}
                          {currentTime >= 26 && currentTime < 38 && "Passo 3/8: Motoboy Coleta na Loja"}
                          {currentTime >= 38 && currentTime < 50 && "Passo 4/8: Entrega Portão com PIN"}
                          {currentTime >= 50 && currentTime < 62 && "Passo 5/8: Loja Compra Frutos B2B"}
                          {currentTime >= 62 && currentTime < 74 && "Passo 6/8: Caminhão & PIN da Loja"}
                          {currentTime >= 74 && currentTime < 83 && "Passo 7/8: Chamando Coleta do Caroço"}
                          {currentTime >= 83 && "Passo 8/8: Caçamba Retira o Caroço"}
                        </span>
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5 leading-tight">
                        {currentTime < 14 && "📱 Cliente escolhe açaí artesanal e paga com PIX automático."}
                        {currentTime >= 14 && currentTime < 26 && "🖨️ Batedeira aceita com 1 toque e impressora térmica emite a comanda."}
                        {currentTime >= 26 && currentTime < 38 && "🏍️ Alerta toca no motoboy, que pilota até a loja e retira a bag térmica."}
                        {currentTime >= 38 && currentTime < 50 && "🔑 Cliente digita o PIN [4821]. Pedido entregue e motoboy pago!"}
                        {currentTime >= 50 && currentTime < 62 && "🍇 Batedeira compra 50 latas de fruto direto do produtor ribeirinho."}
                        {currentTime >= 62 && currentTime < 74 && "🚚 Doca: Loja informa o PIN [9354] ao caminhoneiro para validar descarga!"}
                        {currentTime >= 74 && currentTime < 83 && "♻️ Batedeira aciona o botão 'Solicitar Coleta de Caroço residual'."}
                        {currentTime >= 83 && "🚜 Caçamba aceita a ordem e recolhe os caroços para reciclagem e biomassa!"}
                      </p>
                    </div>
                  </div>

                  {/* Middle Animated Stage: Ciclo Completo */}
                  <div className="my-auto space-y-3">
                    
                    {/* 1. Cliente */}
                    {currentTime < 14 && (
                      <div className="bg-zinc-900 border border-pink-500/50 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-pink-300 font-bold">1. Cliente Pedindo:</span>
                          <span className="text-[10px] text-zinc-400">Cardápio GPS</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-white font-bold">
                            <span>1L Açaí Grosso + Farinha</span>
                            <span className="text-emerald-400">R$ 28,00</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">Entrega: Rua dos Açaizeiros • 1.4km</div>
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 pt-1 font-mono">
                            <CheckCircle2 size={12} /> PIX Aprovado via Asaas
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Loja & Impressora */}
                    {currentTime >= 14 && currentTime < 26 && (
                      <div className="bg-zinc-900 border border-purple-500/50 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-300 font-bold">2. Batedeira Operando:</span>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">Preparando</span>
                        </div>
                        <div className="bg-amber-100 text-zinc-950 p-2.5 rounded-xl font-mono text-[10px] space-y-0.5 shadow">
                          <div className="font-bold text-center border-b border-zinc-400 pb-0.5">*** AÇAÍFOOD COMANDA ***</div>
                          <div>PEDIDO: #1084 • CLIENTE: Carlos E.</div>
                          <div className="font-bold">ITEM: 1L Açaí Grosso + Farinha</div>
                          <div className="text-purple-900 font-bold">PIN SEGURANÇA: [ 4 8 2 1 ]</div>
                        </div>
                      </div>
                    )}

                    {/* 3. Motoboy */}
                    {currentTime >= 26 && currentTime < 38 && (
                      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <Bike size={14} /> 3. Chamando Motoboy:
                          </span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">Retirada</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl space-y-1.5 text-xs">
                          <div className="text-white font-bold">Marcos Motoboy Aceitou a Corrida</div>
                          <div className="text-[11px] text-zinc-300">Chegou na batedeira • Bag lacrada</div>
                          <div className="text-[11px] font-bold text-emerald-400">Frete Líquido: R$ 8,50</div>
                        </div>
                      </div>
                    )}

                    {/* 4. Entrega PIN */}
                    {currentTime >= 38 && currentTime < 50 && (
                      <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-2xl p-4 text-center space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-300 text-xs font-black">
                          <ShieldCheck size={18} /> 4. PIN Validado no Portão!
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl text-xl font-mono font-black text-white tracking-widest">
                          4 8 2 1
                        </div>
                        <p className="text-[11px] text-emerald-200">
                          Cliente informou o PIN ao motoboy. Açaí entregue e dinheiro liberado na conta do piloto!
                        </p>
                      </div>
                    )}

                    {/* 5. Loja Compra Frutos B2B */}
                    {currentTime >= 50 && currentTime < 62 && (
                      <div className="bg-zinc-900 border border-purple-500/50 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-300 font-bold">5. Reposição de Matéria-Prima:</span>
                          <span className="text-[10px] text-amber-400 font-bold">Mercado B2B</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl space-y-1.5 text-xs">
                          <div className="text-white font-bold">50 Latas de Açaí Chumbinho (700 kg)</div>
                          <div className="text-[10px] text-zinc-400">Fornecedor: Produtor Ribeirinho • Igarapé-Miri</div>
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                            <span className="text-[10px] text-zinc-400">Custódia Asaas:</span>
                            <span className="text-[11px] text-emerald-400 font-bold">Escrow Protegido</span>
                          </div>
                          <div className="bg-purple-950/60 p-2 rounded-lg border border-purple-700/50 flex justify-between items-center">
                            <span className="text-[10px] text-purple-300 font-bold">🔑 PIN da Loja Compradora:</span>
                            <span className="font-mono font-black text-white bg-zinc-900 px-2 py-0.5 rounded border border-purple-500/50">9 3 5 4</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. Caminhão B2B & PIN na Loja */}
                    {currentTime >= 62 && currentTime < 74 && (
                      <div className="bg-gradient-to-b from-blue-950/80 to-zinc-900 border-2 border-blue-400 rounded-2xl p-3.5 space-y-2 animate-in fade-in shadow-xl">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-300 font-black flex items-center gap-1">
                            <Truck size={15} /> 6. Doca da Loja & PIN de Descarga:
                          </span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">Chegou na Doca</span>
                        </div>

                        {currentTime < 68 ? (
                          /* Fase A: Caminhão chega e solicita o PIN da Loja */
                          <div className="bg-zinc-950 p-2.5 rounded-xl space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-white font-bold">
                              <span>🚚 Caminhoneiro na Doca</span>
                              <span className="text-[10px] text-blue-400">45 km percorridos</span>
                            </div>
                            <div className="text-[11px] text-zinc-300">Descarregando 50 latas de açaí (700 kg)</div>
                            <div className="bg-amber-950/40 border border-amber-500/50 p-2 rounded-lg text-center space-y-1">
                              <span className="text-[10px] text-amber-300 font-bold block">
                                🔐 Caminhoneiro solicita o PIN à Batedeira:
                              </span>
                              <div className="font-mono font-black text-base text-amber-200 tracking-widest animate-pulse">
                                [ 9 3 5 4 ]
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Fase B: Caminhoneiro valida PIN e recebe frete pesado */
                          <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-xl p-3 text-center space-y-1.5">
                            <div className="flex items-center justify-center gap-1.5 text-emerald-300 text-xs font-black uppercase">
                              <ShieldCheck size={16} /> PIN Validado pela Loja!
                            </div>
                            <div className="text-[11px] text-white font-bold">
                              Descarga aprovada • Matéria-prima recebida
                            </div>
                            <div className="bg-zinc-950 p-1.5 rounded-lg text-emerald-400 font-black text-sm">
                              💰 Frete Pesado: + R$ 280,00 Liquidado
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. Chamar Caçamba para o Caroço */}
                    {currentTime >= 74 && currentTime < 83 && (
                      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <Recycle size={14} /> 7. Descarte do Caroço de Açaí:
                          </span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">Coleta</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl space-y-1.5 text-xs text-center">
                          <div className="text-white font-bold">Batedeira aciona: "Chamar Caçamba"</div>
                          <div className="text-[11px] text-zinc-300">Volume: 35 sacas de caroço batido</div>
                          <button className="w-full bg-amber-600 text-white font-bold py-1.5 rounded-lg text-xs animate-pulse">
                            🚚 Ordem de Caçamba Disparada
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 8. Caçamba Aceita e Conclui o Ciclo */}
                    {currentTime >= 83 && (
                      <div className="bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border-2 border-emerald-400 rounded-2xl p-4 text-center space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-300 text-xs font-black uppercase">
                          <CheckCircle2 size={20} /> 8. Caçamba Recolheu o Caroço!
                        </div>
                        <div className="text-xs text-white font-bold">
                          Pátio da Batedeira 100% Limpo e Regularizado
                        </div>
                        <p className="text-[10px] text-zinc-300">
                          Caroços encaminhados para queima sustentável e biomassa. Ciclo ecológico completo!
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Chapter fast scrub buttons */}
                  <div className="grid grid-cols-4 gap-1 text-[9px] pt-1">
                    <button onClick={() => setCurrentTime(0)} className={`p-1 rounded text-center truncate ${currentTime < 26 ? 'bg-purple-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400'}`}>
                      1. Cliente
                    </button>
                    <button onClick={() => setCurrentTime(26)} className={`p-1 rounded text-center truncate ${currentTime >= 26 && currentTime < 50 ? 'bg-amber-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400'}`}>
                      2. Motoboy
                    </button>
                    <button onClick={() => setCurrentTime(50)} className={`p-1 rounded text-center truncate ${currentTime >= 50 && currentTime < 74 ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400'}`}>
                      3. Caminhão
                    </button>
                    <button onClick={() => setCurrentTime(74)} className={`p-1 rounded text-center truncate ${currentTime >= 74 ? 'bg-emerald-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400'}`}>
                      4. Caçamba
                    </button>
                  </div>
                </div>
              )}

              {/* VIDEO 2: MOTOBOY FLOW */}
              {currentVideoId === 'motoboy' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-amber-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Bike className="text-amber-400" size={16} />
                        <span className="text-xs font-black text-white">AçaíFood Motoboy</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Online • GPS Ativo
                      </span>
                    </div>

                    <div className="bg-amber-950/60 border border-amber-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                        {currentTime < 9 && "Etapa 1: Alerta no Radar de Corridas"}
                        {currentTime >= 9 && currentTime < 18 && "Etapa 2: Retirada na Batedeira"}
                        {currentTime >= 18 && currentTime < 28 && "Etapa 3: Rota até o Portão"}
                        {currentTime >= 28 && "Etapa 4: Validação do PIN & Saque PIX"}
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5">
                        {currentTime < 9 && "🏍️ Corrida apitando no painel com distância e valor de frete líquido."}
                        {currentTime >= 9 && currentTime < 18 && "📦 Batedeira entrega embalagem térmica conferida e lacrada."}
                        {currentTime >= 18 && currentTime < 28 && "🗺️ Navegação GPS rápida até a residência do cliente."}
                        {currentTime >= 28 && "🔑 Cliente informa o PIN [ 4 8 2 1 ]. O frete cai no saldo na hora!"}
                      </p>
                    </div>
                  </div>

                  <div className="my-auto space-y-3">
                    {currentTime < 9 && (
                      <div className="bg-gradient-to-r from-amber-950/90 to-yellow-950/90 border-2 border-amber-500 rounded-2xl p-4 shadow-xl text-center space-y-2 animate-bounce">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl">🏍️</span>
                          <span className="bg-amber-500 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                            Nova Corrida!
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white">PEDIDO #1084 • Batedeira Ponto do Açaí</h4>
                        <div className="text-xs text-zinc-300">Distância: 2.4 km • Bairro Umarizal</div>
                        <div className="text-lg font-black text-emerald-400 bg-zinc-950/70 py-1 rounded-xl border border-emerald-500/30">
                          Frete: R$ 8,50 Líquido
                        </div>
                      </div>
                    )}

                    {currentTime >= 9 && currentTime < 18 && (
                      <div className="bg-zinc-900 border border-amber-600/50 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-300 font-bold">Ponto de Coleta (Loja):</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                            No Balcão
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-950 rounded-xl space-y-1.5 text-xs">
                          <div className="text-white font-bold">Batedeira Ponto do Açaí</div>
                          <div className="text-[11px] text-zinc-400">Pacote térmico: 1L Açaí Médio + Tapioca</div>
                          <div className="text-[10px] text-emerald-400 font-mono">✓ Comanda térmica #1084 conferida</div>
                        </div>
                        <button className="w-full bg-amber-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5">
                          <Navigation size={14} /> Iniciar Rota ao Cliente
                        </button>
                      </div>
                    )}

                    {currentTime >= 18 && currentTime < 28 && (
                      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                            <Navigation size={14} className="text-amber-400 animate-pulse" /> Navegando com GPS
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold">2 min restantes</span>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
                          <div className="text-zinc-400 text-[10px]">Destino Final:</div>
                          <div className="text-white font-bold">Rua dos Açaizeiros, 120 • Casa A</div>
                          <div className="text-[11px] text-zinc-400">Cliente: Carlos Eduardo</div>
                        </div>
                        <div className="bg-amber-950/50 text-amber-300 text-[10px] text-center p-2 rounded-lg border border-amber-900/50 font-bold">
                          🚨 Peça o PIN ao cliente para finalizar a entrega
                        </div>
                      </div>
                    )}

                    {currentTime >= 28 && (
                      <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-2xl p-4 text-center space-y-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 size={24} className="text-emerald-400" />
                          <span className="text-xs font-black text-emerald-300 uppercase">PIN [4821] Validado!</span>
                        </div>
                        <div className="bg-zinc-950/90 p-2.5 rounded-xl border border-emerald-900/50">
                          <div className="text-[10px] text-zinc-400">Saldo Recebido do Frete:</div>
                          <div className="text-xl font-black text-emerald-400">+ R$ 8,50</div>
                          <div className="text-[10px] text-zinc-300 mt-0.5">Saldo Disponível: R$ 94,50</div>
                        </div>
                        <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow">
                          <span>⚡ Resgatar via PIX Agora</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-center text-zinc-500">
                    AçaíFood Entregador Pro • Frete Instantâneo
                  </div>
                </div>
              )}

              {/* VIDEO 3: CAMINHAO FLOW */}
              {currentVideoId === 'caminhao' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-blue-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Truck className="text-blue-400" size={16} />
                        <span className="text-xs font-black text-white">AçaíFood Caminhão & Carga</span>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                        Carga Pesada B2B
                      </span>
                    </div>

                    <div className="bg-blue-950/60 border border-blue-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">
                        {currentTime < 10 && "Etapa 1: Alerta de Carga no Radar"}
                        {currentTime >= 10 && currentTime < 20 && "Etapa 2: Embarque & Romaneio"}
                        {currentTime >= 20 && currentTime < 31 && "Etapa 3: Rota Rodoviária com GPS"}
                        {currentTime >= 31 && "Etapa 4: Descarga na Doca & Frete Pago"}
                      </div>
                      <p className="text-xs text-white font-bold mt-0.5">
                        {currentTime < 10 && "🚚 Carga de latas disponível com cálculo automático por tonelada e km."}
                        {currentTime >= 10 && currentTime < 20 && "📋 Conferência de 50 latas de fruto chumbinho e lacre de segurança."}
                        {currentTime >= 20 && currentTime < 31 && "🛣️ Viagem monitorada com rastreio de frota em tempo real."}
                        {currentTime >= 31 && "💰 Descarga confirmada pelo comprador e frete liberado imediatamente!"}
                      </p>
                    </div>
                  </div>

                  <div className="my-auto space-y-3">
                    {currentTime < 10 && (
                      <div className="bg-gradient-to-r from-blue-950/90 to-cyan-950/90 border-2 border-blue-500 rounded-2xl p-4 shadow-xl text-center space-y-2 animate-bounce">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl">🚚</span>
                          <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                            Carga Pesada Disponível
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white">50 LATAS DE AÇAÍ (700 KG)</h4>
                        <div className="text-xs text-blue-200">Origem: Polo Produtor ➔ Batedeira (42 km)</div>
                        <div className="text-lg font-black text-emerald-400 bg-zinc-950/70 py-1 rounded-xl border border-emerald-500/30">
                          Frete: R$ 280,00 Garantido
                        </div>
                      </div>
                    )}

                    {currentTime >= 10 && currentTime < 20 && (
                      <div className="bg-zinc-900 border border-blue-600/50 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-300 font-bold">Embarque de Fruto:</span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
                            Romaneio Digital
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-950 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-zinc-300">
                            <span>Lote:</span>
                            <span className="text-white font-bold">#LOTE-8942 (50 Latas)</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>Peso estimado:</span>
                            <span className="text-white font-bold">700 kg</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>Safra:</span>
                            <span className="text-amber-400 font-bold">Fruto do Dia</span>
                          </div>
                        </div>
                        <button className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">
                          Confirmar Embarque & Iniciar Rota
                        </button>
                      </div>
                    )}

                    {currentTime >= 20 && currentTime < 31 && (
                      <div className="bg-zinc-900 border border-blue-500/50 rounded-2xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                            <Truck size={14} className="text-blue-400" /> Rota Rodoviária em Curso
                          </span>
                          <span className="text-[10px] text-blue-400 font-bold">42 km • 50 min</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1 text-xs">
                          <div className="text-zinc-400 text-[10px]">Destino de Descarregamento:</div>
                          <div className="text-white font-bold">Doca da Batedeira Ponto do Açaí</div>
                          <div className="text-[11px] text-emerald-400">Rastreamento de carga ativo via GPS</div>
                        </div>
                      </div>
                    )}

                    {currentTime >= 31 && (
                      <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-2xl p-4 text-center space-y-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 size={24} className="text-emerald-400" />
                          <span className="text-xs font-black text-emerald-300 uppercase">Descarga Realizada na Doca!</span>
                        </div>
                        <div className="bg-zinc-950/90 p-2.5 rounded-xl border border-emerald-900/50">
                          <div className="text-[10px] text-zinc-400">Frete Pesado Creditado no Saldo:</div>
                          <div className="text-xl font-black text-emerald-400">+ R$ 280,00</div>
                          <div className="text-[10px] text-zinc-300 mt-0.5">Pagamento seguro Asaas sem taxa de espera</div>
                        </div>
                        <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow">
                          <span>⚡ Resgate PIX Instantâneo</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-center text-zinc-500">
                    AçaíFood Carga Pesada • Logística de Grande Porte
                  </div>
                </div>
              )}

              {/* VIDEO 4: BATEDEIRA FLOW */}
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

              {/* VIDEO 5: CLIENTE FLOW */}
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

              {/* VIDEO 6: B2B PRODUTOR FLOW */}
              {currentVideoId === 'b2b' && (
                <div className="h-full flex flex-col justify-between py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-emerald-900/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Store className="text-emerald-400" size={16} />
                        <span className="text-xs font-black text-white">Mercado B2B do Fruto</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Safra Direta
                      </span>
                    </div>

                    <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-2.5">
                      <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
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

                  <div className="my-auto space-y-3">
                    {currentTime < 12 && (
                      <div className="bg-zinc-900 border border-emerald-700/50 rounded-2xl p-3.5 space-y-2">
                        <div className="text-xs font-bold text-white">Novo Lote Disponível:</div>
                        <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-1">
                          <div className="flex justify-between text-xs font-bold text-emerald-200">
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
                        <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs transition">
                          Contratar Frete & Comprar
                        </button>
                      </div>
                    )}

                    {currentTime >= 24 && currentTime < 36 && (
                      <div className="bg-zinc-900 border border-blue-500/50 rounded-2xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-300 font-bold flex items-center gap-1">
                            <Truck size={14} /> Frete de Carga Pesada
                          </span>
                          <span className="text-[10px] text-zinc-400">Em Trânsito</span>
                        </div>
                        <div className="p-2.5 bg-blue-950/40 border border-blue-800/40 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-zinc-300">
                            <span>Distância Rota:</span>
                            <span className="font-bold text-white">42 km</span>
                          </div>
                          <div className="flex justify-between text-zinc-300">
                            <span>Carga estimada:</span>
                            <span className="font-bold text-white">420 kg (30 latas)</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-bold border-t border-blue-900/40 pt-1">
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
                activeVideo.colorScheme === 'amber' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                activeVideo.colorScheme === 'blue' ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                'bg-gradient-to-r from-emerald-500 to-emerald-400'
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

            {/* Quick Switch Video Tabs - Curated Selection */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
              {VIDEO_CATALOG.slice(0, 4).map((vid) => (
                <button
                  key={vid.id}
                  onClick={() => {
                    setCurrentVideoId(vid.id);
                    setCurrentTime(0);
                    lastSoundSceneRef.current = -1;
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    currentVideoId === vid.id
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {vid.id === 'ciclo_animado' && <span>🎭 Vídeo Animado (Voz)</span>}
                  {vid.id === 'ciclo_completo' && <span>🎬 Telas do App (PIN)</span>}
                  {vid.id === 'motoboy' && <span>🏍️ Motoboy</span>}
                  {vid.id === 'caminhao' && <span>🚚 Caminhão</span>}
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
