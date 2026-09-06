"use client";

import React, { useState, useEffect } from "react";
import { AdItem } from "@/app/api/ads/route";
import { Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

const DEFAULT_CLIENT_BANNERS: AdItem[] = [
  {
    id: 'ad-default-1',
    title: 'Açaí Puro da Amazônia - Direto da Batedeira',
    advertiserName: 'AçaíFood Oficial',
    mediaType: 'image',
    mediaUrl: '/banner.png?v=4',
    placement: 'home_banner',
    targetType: 'url',
    targetValue: 'https://www.acaifood.app.br/',
    city: 'ALL',
    isActive: true,
    viewsCount: 142,
    clicksCount: 28,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ad-banner-2',
    title: 'Açaí Grosso Tradicional & Batido na Hora',
    advertiserName: 'Ponto do Açaí',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=200&q=60',
    placement: 'home_banner',
    targetType: 'url',
    targetValue: 'https://www.acaifood.app.br/',
    city: 'ALL',
    isActive: true,
    viewsCount: 120,
    clicksCount: 34,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ad-banner-3',
    title: 'Açaí Completo com Peixe Frito e Farinha de Bragança',
    advertiserName: 'Churrasco do B10',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=60',
    placement: 'home_banner',
    targetType: 'url',
    targetValue: 'https://www.acaifood.app.br/',
    city: 'ALL',
    isActive: true,
    viewsCount: 105,
    clicksCount: 22,
    createdAt: new Date().toISOString()
  }
];

interface AdBannerCarouselProps {
  city?: string;
  onSelectStore?: (storeId: string) => void;
}

export function AdBannerCarousel({ city, onSelectStore }: AdBannerCarouselProps) {
  const [ads, setAds] = useState<AdItem[]>(DEFAULT_CLIENT_BANNERS);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchBanners = async () => {
      try {
        const query = city ? `?placement=home_banner&city=${encodeURIComponent(city)}` : `?placement=home_banner`;
        const res = await fetch(`/api/ads${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.ads && Array.isArray(data.ads) && data.ads.length > 0 && isMounted) {
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

  // Rotação automática a cada 5 segundos
  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex % ads.length] || ads[0];

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % ads.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  };

  const handleClick = () => {
    if (!currentAd) return;

    // Registra métrica de clique
    try {
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: currentAd.id, action: 'click' })
      }).catch(() => {});
    } catch (_e) {}

    const targetVal = (currentAd.targetValue || (currentAd as any).targetUrl || '').trim();
    const isTargetWa = currentAd.targetType === 'whatsapp' || targetVal.includes('whatsapp') || targetVal.includes('wa.me');
    const isTargetHttp = currentAd.targetType === 'url' || targetVal.startsWith('http://') || targetVal.startsWith('https://');

    if (isTargetWa && targetVal) {
      const cleanNum = targetVal.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleanNum}?text=${encodeURIComponent('Olá! Vi seu anúncio no AçaíFood e gostaria de pedir açaí!')}`, '_blank');
    } else if (isTargetHttp && targetVal && targetVal !== 'https://www.acaifood.app.br/' && targetVal !== 'https://acai-food-mobile.vercel.app/') {
      window.open(targetVal, '_blank');
    } else if (currentAd.targetType === 'store' && targetVal && onSelectStore) {
      onSelectStore(targetVal);
    } else {
      // Se for anúncio institucional ou padrão, clicar em "Ver" avança para a próxima propaganda/comercial
      handleNext();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4 select-none">
      <div 
        onClick={handleClick}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-zinc-900 to-purple-950 border border-purple-500/30 shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] h-44 sm:h-52"
      >
        {/* Imagem de Fundo / Vídeo */}
        {currentAd.mediaType === 'video' ? (
          <video 
            key={currentAd.id || currentIndex}
            src={currentAd.mediaUrl}
            className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-all duration-500"
            autoPlay 
            muted 
            loop 
            playsInline
          />
        ) : (
          <img 
            key={currentAd.id || currentIndex}
            src={currentAd.mediaUrl || '/banner.png?v=4'} 
            alt={currentAd.title}
            className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-all duration-500"
            loading="eager"
          />
        )}

        {/* Gradiente de Alto Contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20" />

        {/* Badge Patrocinado / Destaque */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-amber-400 text-zinc-950 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md z-30 pointer-events-none">
          <Sparkles size={12} className="text-zinc-950" />
          <span>Comercial • Destaque</span>
        </div>

        {/* Setas de Navegação Super Visíveis */}
        {ads.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              type="button"
              aria-label="Comercial anterior"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/75 hover:bg-purple-600 text-white flex items-center justify-center transition-all shadow-xl active:scale-90 z-30 backdrop-blur-md border border-white/30 cursor-pointer"
            >
              <ChevronLeft size={22} className="stroke-[2.5]" />
            </button>
            <button
              onClick={handleNext}
              type="button"
              aria-label="Próximo comercial"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/75 hover:bg-purple-600 text-white flex items-center justify-center transition-all shadow-xl active:scale-90 z-30 backdrop-blur-md border border-white/30 cursor-pointer"
            >
              <ChevronRight size={22} className="stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Informações e Botão "Ver" */}
        <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-3 z-20">
          <div className="text-white max-w-[75%]">
            <p className="text-xs font-bold text-purple-300 uppercase tracking-wide truncate drop-shadow">
              📢 {currentAd.advertiserName || (currentAd as any).partnerName || 'AçaíFood Oficial'}
            </p>
            <h3 className="text-sm sm:text-base font-black leading-tight drop-shadow-md line-clamp-2 mt-0.5">
              {currentAd.title}
            </h3>
            {currentAd.description && (
              <p className="text-[11px] text-zinc-300 line-clamp-1 mt-0.5 font-medium">
                {currentAd.description}
              </p>
            )}
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            type="button"
            className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-purple-400/30"
          >
            <span>Ver</span>
            <ChevronRight size={15} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Indicadores de Paginação Clicáveis */}
        {ads.length > 1 && (
          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md z-30 border border-white/10">
            {ads.map((_, idx) => (
              <button 
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === (currentIndex % ads.length) 
                    ? 'w-6 bg-purple-400 shadow-sm' 
                    : 'w-2 bg-white/40 hover:bg-white/80'
                }`} 
                aria-label={`Ir para comercial ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

