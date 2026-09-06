"use client";

import React, { useState, useEffect } from "react";
import { AdItem } from "@/app/api/ads/route";
import { Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

interface AdBannerCarouselProps {
  city?: string;
  onSelectStore?: (storeId: string) => void;
}

export function AdBannerCarousel({ city, onSelectStore }: AdBannerCarouselProps) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchBanners = async () => {
      try {
        const query = city ? `?placement=home_banner&city=${encodeURIComponent(city)}` : `?placement=home_banner`;
        const res = await fetch(`/api/ads${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.ads && Array.isArray(data.ads) && isMounted) {
            setAds(data.ads);
          }
        }
      } catch (_e) {}
    };

    fetchBanners();
    return () => {
      isMounted = false;
    };
  }, [city]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (ads.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (ads.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
    }
  };

  const handleClick = () => {
    if (!currentAd) return;

    // Registra clique em segundo plano
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: currentAd.id, action: 'click' })
    }).catch(() => {});

    if (currentAd.targetType === 'store' && currentAd.targetValue && onSelectStore) {
      onSelectStore(currentAd.targetValue);
    } else if (currentAd.targetType === 'whatsapp' && currentAd.targetValue) {
      const cleanNum = currentAd.targetValue.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleanNum}?text=${encodeURIComponent('Olá! Vi seu anúncio no AçaíFood e gostaria de pedir açaí!')}`, '_blank');
    } else if (currentAd.targetType === 'url' && currentAd.targetValue && currentAd.targetValue !== 'https://www.acaifood.app.br/') {
      window.open(currentAd.targetValue, '_blank');
    } else if (ads.length > 1) {
      // Se for anúncio geral, clicar em "Ver" avança para a próxima propaganda/comercial
      handleNext();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4">
      <div 
        onClick={handleClick}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-zinc-900 to-purple-950 border border-purple-500/20 shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] h-40 sm:h-48"
      >
        {/* Background Image / Banner */}
        <img 
          key={currentAd.id || currentIndex}
          src={currentAd.mediaUrl || '/banner.png?v=4'} 
          alt={currentAd.title}
          className="w-full h-full object-cover opacity-65 group-hover:opacity-80 transition-all duration-500 animate-in fade-in zoom-in-95"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Badge Patrocinado / Destaque */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500/90 text-zinc-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow z-10">
          <Sparkles size={11} className="text-zinc-950" />
          <span>Destaque</span>
        </div>

        {/* Setas de Navegação (Anterior / Próximo) */}
        {ads.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Comercial anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 z-20 backdrop-blur-xs"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              aria-label="Próximo comercial"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 z-20 backdrop-blur-xs"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Conteúdo do Banner */}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 z-10">
          <div className="text-white max-w-[78%]">
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide truncate">
              {currentAd.advertiserName || 'AçaíFood'}
            </p>
            <h3 className="text-sm sm:text-base font-black leading-tight drop-shadow-md line-clamp-2">
              {currentAd.title}
            </h3>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-md shrink-0 transition-all hover:scale-105 active:scale-95"
          >
            <span>Ver</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Indicadores de Paginação Clicáveis */}
        {ads.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
            {ads.map((_, idx) => (
              <button 
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-5 bg-purple-400' : 'w-2 bg-white/40 hover:bg-white/70'}`} 
                aria-label={`Ir para comercial ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
