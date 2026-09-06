"use client";

import React, { useState, useEffect } from "react";
import { AdItem } from "@/app/api/ads/route";
import { Sparkles, ChevronRight } from "lucide-react";

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
    }, 5500);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];

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
    } else if (currentAd.targetType === 'url' && currentAd.targetValue) {
      window.open(currentAd.targetValue, '_blank');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4">
      <div 
        onClick={handleClick}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-zinc-900 to-purple-950 border border-purple-500/20 shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] h-36 sm:h-44"
      >
        {/* Background Image / Banner */}
        <img 
          src={currentAd.mediaUrl || '/banner.png?v=4'} 
          alt={currentAd.title}
          className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity duration-300"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Badge Patrocinado / Destaque */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500/90 text-zinc-950 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
          <Sparkles size={11} className="animate-spin text-zinc-950" />
          <span>Destaque</span>
        </div>

        {/* Conteúdo do Banner */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="text-white max-w-[80%]">
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide truncate">
              {currentAd.advertiserName}
            </p>
            <h3 className="text-sm sm:text-base font-black leading-tight drop-shadow-md line-clamp-2">
              {currentAd.title}
            </h3>
          </div>

          <button className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md shrink-0 transition-transform group-hover:translate-x-0.5">
            <span>Ver</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Indicadores de Paginação */}
        {ads.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
            {ads.map((_, idx) => (
              <span 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-purple-400' : 'w-1.5 bg-white/40'}`} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
