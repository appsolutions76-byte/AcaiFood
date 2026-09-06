"use client";

import React, { useEffect, useRef, useState } from "react";
import { haversineKm } from "@/store/useAppStore";

export interface MapPoint {
  lat: number;
  lng: number;
  name: string;
  veiculo?: string;
}

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  origem: MapPoint | null;
  destino: MapPoint | null;
  motorista?: MapPoint | null;
}

export function MapModal({ isOpen, onClose, origem, destino, motorista }: MapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Referências persistentes para evitar oscilação do Leaflet
  const markerOrigemRef = useRef<any>(null);
  const markerDestinoRef = useRef<any>(null);
  const markerMotoristaRef = useRef<any>(null);
  const polylineEntregaRef = useRef<any>(null);
  const polylineRetiradaRef = useRef<any>(null);
  const hasCenteredRef = useRef<boolean>(false);

  // 1. Injetar assets do Leaflet dinamicamente se ainda não presentes
  useEffect(() => {
    if (!isOpen) return;

    const L = (window as any).L;
    if (L) {
      setLeafletLoaded(true);
      return;
    }

    // Injetar CSS do Leaflet
    const cssId = "leaflet-cdn-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Injetar JS do Leaflet
    const jsId = "leaflet-cdn-js";
    if (!document.getElementById(jsId)) {
      const script = document.createElement("script");
      script.id = jsId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      const script = document.getElementById(jsId) as HTMLScriptElement;
      if (script) {
        const checkInterval = setInterval(() => {
          if ((window as any).L) {
            setLeafletLoaded(true);
            clearInterval(checkInterval);
          }
        }, 100);
      }
    }
  }, [isOpen]);

  // 2. Destruir mapa e limpar referências quando o modal fechar
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (_e) {}
        mapInstanceRef.current = null;
      }
      markerOrigemRef.current = null;
      markerDestinoRef.current = null;
      markerMotoristaRef.current = null;
      polylineEntregaRef.current = null;
      polylineRetiradaRef.current = null;
      hasCenteredRef.current = false;
    }
  }, [isOpen]);

  // 3. Montar e atualizar dinamicamente o mapa Leaflet
  useEffect(() => {
    if (!isOpen || !leafletLoaded) return;

    const p1 = origem;
    const p2 = destino;
    const pm = motorista;

    if (!p1 || !p2 || !p1.lat || !p2.lat || !p1.lng || !p2.lng) return;

    const L = (window as any).L;
    if (!L) return;

    // Inicializar mapa se ainda não existir
    if (!mapInstanceRef.current) {
      const map = L.map("acaifood-leaflet-map", {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true
      }).setView([p1.lat, p1.lng], 13);

      mapInstanceRef.current = map;

      // Adicionar tiles elegantes CartoDB Voyager
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
    }

    const map = mapInstanceRef.current;

    // Definir ícone emoji customizado (emoji + tooltip elegante)
    const createEmojiIcon = (emoji: string, label: string) => {
      return L.divIcon({
        html: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; width: 30px; height: 30px;">
                 <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">${emoji}</span>
                 <div style="position: absolute; top: -20px; background: white; color: #1f2937; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #d1d5db; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.15); pointer-events: none;">${label}</div>
               </div>`,
        className: 'custom-leaflet-emoji-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    };

    const iconOrigem = createEmojiIcon(pm?.veiculo === 'Caminhão' ? '🏭' : '🏪', p1.name || 'Retirada');
    const iconDestino = createEmojiIcon('🏁', p2.name || 'Entrega');
    
    // Atualizar ou Criar Marcador de Origem (Loja/Fornecedor)
    if (!markerOrigemRef.current) {
      markerOrigemRef.current = L.marker([p1.lat, p1.lng], { icon: iconOrigem }).addTo(map);
    } else {
      markerOrigemRef.current.setLatLng([p1.lat, p1.lng]).setIcon(iconOrigem);
    }

    // Atualizar ou Criar Marcador de Destino (Cliente)
    if (!markerDestinoRef.current) {
      markerDestinoRef.current = L.marker([p2.lat, p2.lng], { icon: iconDestino }).addTo(map);
    } else {
      markerDestinoRef.current.setLatLng([p2.lat, p2.lng]).setIcon(iconDestino);
    }

    const boundsPoints: any[] = [
      [p1.lat, p1.lng],
      [p2.lat, p2.lng]
    ];

    // Helper para buscar rota via ruas reais OSRM (OpenStreetMap)
    const fetchOSRMRoute = async (latA: number, lngA: number, latB: number, lngB: number) => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lngA},${latA};${lngB},${latB}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
          const coords = data.routes[0].geometry.coordinates; // [lng, lat]
          return coords.map((c: [number, number]) => [c[1], c[0]]); // Converte para [lat, lng]
        }
      } catch (_e) {}
      return null;
    };

    // Atualizar Rota Loja -> Cliente (Linha azul via ruas)
    if (!polylineEntregaRef.current) {
      polylineEntregaRef.current = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85
      }).addTo(map);
    } else {
      polylineEntregaRef.current.setLatLngs([[p1.lat, p1.lng], [p2.lat, p2.lng]]);
    }

    fetchOSRMRoute(p1.lat, p1.lng, p2.lat, p2.lng).then(routePoints => {
      if (routePoints && polylineEntregaRef.current) {
        polylineEntregaRef.current.setLatLngs(routePoints);
      }
    });

    // Atualizar Motorista (se houver)
    if (pm && pm.lat && pm.lng) {
      const motIconEmoji = pm.veiculo === 'Moto' ? '🛵' : pm.veiculo === 'Caminhão' ? '🚚' : '🚛';
      const iconMotorista = createEmojiIcon(motIconEmoji, pm.name || 'Entregador');
      
      if (!markerMotoristaRef.current) {
        markerMotoristaRef.current = L.marker([pm.lat, pm.lng], { icon: iconMotorista }).addTo(map);
      } else {
        markerMotoristaRef.current.setLatLng([pm.lat, pm.lng]).setIcon(iconMotorista);
      }
      boundsPoints.push([pm.lat, pm.lng]);

      // Rota Motorista -> Retirada (Linha tracejada laranja via ruas)
      if (!polylineRetiradaRef.current) {
        polylineRetiradaRef.current = L.polyline([[pm.lat, pm.lng], [p1.lat, p1.lng]], {
          color: '#f97316',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 6'
        }).addTo(map);
      } else {
        polylineRetiradaRef.current.setLatLngs([[pm.lat, pm.lng], [p1.lat, p1.lng]]);
      }

      fetchOSRMRoute(pm.lat, pm.lng, p1.lat, p1.lng).then(routePoints => {
        if (routePoints && polylineRetiradaRef.current) {
          polylineRetiradaRef.current.setLatLngs(routePoints);
        }
      });
    } else {
      // Se sumir o motorista
      if (markerMotoristaRef.current) {
        map.removeLayer(markerMotoristaRef.current);
        markerMotoristaRef.current = null;
      }
      if (polylineRetiradaRef.current) {
        map.removeLayer(polylineRetiradaRef.current);
        polylineRetiradaRef.current = null;
      }
    }

    // Auto-Ajustar enquadramento do mapa
    if (boundsPoints.length >= 2 && !hasCenteredRef.current) {
      try {
        map.fitBounds(boundsPoints, { padding: [40, 40], maxZoom: 16 });
      } catch (_e) {}
      hasCenteredRef.current = true;
    }

    // Múltiplos recálculos de tamanho para garantir renderização perfeita após animação
    const t1 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 100);
    const t2 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 300);
    const t3 = setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };

  }, [isOpen, leafletLoaded, origem, destino, motorista]);

  if (!isOpen) return null;

  const p1 = origem;
  const p2 = destino;
  const pm = motorista;
  const distLojaCliente = (p1?.lat && p2?.lat) ? haversineKm(p1.lat || 0, p1.lng || 0, p2.lat || 0, p2.lng || 0) : 0;
  const distMotoLoja = (pm?.lat && p1?.lat) ? haversineKm(pm.lat || 0, pm.lng || 0, p1.lat || 0, p1.lng || 0) : 0;

  const gmapsLojaUrl = p1?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${p1.lat},${p1.lng}` : '';
  const gmapsClienteUrl = p2?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${p2.lat},${p2.lng}` : '';
  const wazeClienteUrl = p2?.lat ? `https://waze.com/ul?ll=${p2.lat},${p2.lng}&navigate=yes` : '';

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 border border-zinc-200 dark:border-zinc-800">
        
        {/* Header com Legenda da Rota */}
        <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0 shadow-sm">
          <div>
            <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <span>🗺️</span> Rota & Trajeto da Entrega
            </h3>
            <p className="text-[11px] text-purple-200 mt-0.5 flex items-center gap-2 flex-wrap">
              {pm?.lat && <span>🛵 Posição Atual ➔</span>}
              <span>🏪 {p1?.name || 'Retirada'} ➔</span>
              <span>🏁 {p2?.name || 'Entrega'}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-lg flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>
        
        {/* Container do Mapa Leaflet */}
        <div className="relative w-full h-[45vh] sm:h-[420px] bg-zinc-100 dark:bg-zinc-900 shrink-0 overflow-hidden">
          <div id="acaifood-leaflet-map" ref={mapContainerRef} className="w-full h-full z-10" />
          
          {/* Legenda visual flutuante sobre o mapa */}
          <div className="absolute top-3 right-3 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs p-2.5 rounded-xl shadow-md border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold space-y-1">
            {pm?.lat && (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-amber-500"></span>
                <span>🛵 ➔ 🏪 {distMotoLoja.toFixed(1)} km</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-3 h-1 bg-blue-600 rounded"></span>
              <span>🏪 ➔ 🏁 {distLojaCliente.toFixed(1)} km</span>
            </div>
          </div>

          {!leafletLoaded && (
            <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center gap-3 z-20">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando mapa interativo...</p>
            </div>
          )}
        </div>

        {/* Rodapé com Navegação Externa (Google Maps / Waze) e Distâncias */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/90 flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              Distância total entre pontos: <strong className="text-purple-600 dark:text-purple-400 text-sm">{distLojaCliente.toFixed(1)} km</strong>
            </span>
            <button 
              onClick={onClose} 
              className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-bold transition text-xs"
            >
              Fechar
            </button>
          </div>

          {/* Botões de Ação GPS Direta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {gmapsLojaUrl && (
              <a 
                href={gmapsLojaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center active:scale-95"
              >
                🚀 GPS p/ Retirada
              </a>
            )}
            {gmapsClienteUrl && (
              <a 
                href={gmapsClienteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center active:scale-95"
              >
                🏁 GPS p/ Cliente
              </a>
            )}
            {wazeClienteUrl && (
              <a 
                href={wazeClienteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center active:scale-95"
              >
                🚗 Abrir no Waze
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
