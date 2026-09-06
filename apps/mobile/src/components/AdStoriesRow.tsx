"use client";

import React, { useState, useEffect, useRef } from "react";
import { AdItem } from "@/app/api/ads/route";
import { X, Volume2, VolumeX, ShoppingBag, Sparkles, Store } from "lucide-react";

interface AdStoriesRowProps {
  city?: string;
  onSelectStore?: (storeId: string) => void;
}

export function AdStoriesRow({ city, onSelectStore }: AdStoriesRowProps) {
  const [stories, setStories] = useState<AdItem[]>([]);
  const [activeStory, setActiveStory] = useState<AdItem | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStories = async () => {
      try {
        const query = city ? `?placement=home_story&city=${encodeURIComponent(city)}` : `?placement=home_story`;
        const res = await fetch(`/api/ads${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.ads && Array.isArray(data.ads) && isMounted) {
            setStories(data.ads);
          }
        }
      } catch (_e) {}
    };

    fetchStories();
    return () => {
      isMounted = false;
    };
  }, [city]);

  // Gerenciamento de progresso e fechamento automático do story
  useEffect(() => {
    if (!activeStory) {
      setProgress(0);
      return;
    }

    // Registra visualização em segundo plano
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: activeStory.id, action: 'view' })
    }).catch(() => {});

    const duration = activeStory.mediaType === 'video' ? 12000 : 6000;
    const intervalTime = 100;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setActiveStory(null);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStory]);

  if (stories.length === 0) return null;

  const handleOpenStory = (story: AdItem) => {
    setActiveStory(story);
    setProgress(0);
  };

  const handleAction = () => {
    if (!activeStory) return;

    // Registra clique em segundo plano
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: activeStory.id, action: 'click' })
    }).catch(() => {});

    const target = activeStory.targetValue;
    const type = activeStory.targetType;
    setActiveStory(null);

    if (type === 'store' && target && onSelectStore) {
      onSelectStore(target);
    } else if (type === 'whatsapp' && target) {
      const cleanNum = target.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleanNum}?text=${encodeURIComponent('Olá! Vi seu anúncio no AçaíFood e quero fazer um pedido!')}`, '_blank');
    } else if (type === 'url' && target) {
      window.open(target, '_blank');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-3">
      {/* Linha de Círculos de Stories */}
      <div className="flex items-center gap-3.5 overflow-x-auto pb-2 scrollbar-none">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => handleOpenStory(s)}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
          >
            {/* Anel Gradiente Estilo Instagram / Stories */}
            <div className="w-16 h-16 sm:w-18 sm:h-18 p-[2.5px] rounded-full bg-gradient-to-tr from-purple-600 via-amber-400 to-fuchsia-500 shadow-md group-hover:scale-105 group-active:scale-95 transition-transform duration-200">
              <div className="w-full h-full rounded-full border-2 border-white dark:border-zinc-950 overflow-hidden bg-zinc-900 flex items-center justify-center">
                <img
                  src={s.thumbnailUrl || s.mediaUrl || '/banner.png?v=4'}
                  alt={s.advertiserName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[68px] text-center">
              {s.advertiserName}
            </span>
          </button>
        ))}
      </div>

      {/* Modal Player de Stories Ultraleve em Tela Cheia */}
      {activeStory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-0 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-md h-full sm:h-[85vh] sm:rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl flex flex-col justify-between">
            {/* Barra de Progresso Superior */}
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1">
              <div className="w-full bg-white/30 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-100 ease-linear rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Cabeçalho do Anunciante */}
            <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border border-white/40 overflow-hidden bg-zinc-800">
                  <img
                    src={activeStory.thumbnailUrl || activeStory.mediaUrl || '/banner.png?v=4'}
                    alt={activeStory.advertiserName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-white text-xs font-black drop-shadow flex items-center gap-1">
                    <span>{activeStory.advertiserName}</span>
                    <Sparkles size={11} className="text-amber-400" />
                  </p>
                  <p className="text-[10px] text-zinc-300 font-medium">{activeStory.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeStory.mediaType === 'video' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (videoRef.current) videoRef.current.muted = !isMuted;
                    }}
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
                <button
                  onClick={() => setActiveStory(null)}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Mídia: Vídeo Curto ou Imagem de Alta Resolução */}
            <div className="w-full h-full flex items-center justify-center bg-black">
              {activeStory.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={activeStory.mediaUrl}
                  poster={activeStory.thumbnailUrl}
                  playsInline
                  autoPlay
                  muted={isMuted}
                  loop
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={activeStory.mediaUrl}
                  alt={activeStory.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Rodapé com Botão de Ação Direta (CTA) */}
            <div className="absolute bottom-4 left-4 right-4 z-30">
              <button
                onClick={handleAction}
                className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all"
              >
                <ShoppingBag size={18} />
                <span>Pedir Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
