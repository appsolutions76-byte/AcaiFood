"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAppStore, haversineKm } from "@/store/useAppStore";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  origemId: string;
  destinoId: string;
  motoristaId?: string | null;
}

export function MapModal({ isOpen, onClose, origemId, destinoId, motoristaId }: MapModalProps) {
  const users = useAppStore(state => state.users);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

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

  // 2. Montar e desenhar o mapa Leaflet
  useEffect(() => {
    if (!isOpen || !leafletLoaded) return;

    const p1 = users[origemId];
    const p2 = users[destinoId];
    const pm = motoristaId ? users[motoristaId] : null;

    if (!p1 || !p2 || !p1.lat || !p2.lat || !p1.lng || !p2.lng) return;

    const L = (window as any).L;
    if (!L) return;

    // Destruir mapa anterior se houver
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (_e) {}
      mapInstanceRef.current = null;
    }

    // Inicializar mapa
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

    // Definir ícones customizados (emojis + tooltip elegante)
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
    
    // Adicionar marcadores
    L.marker([p1.lat, p1.lng], { icon: iconOrigem }).addTo(map);
    L.marker([p2.lat, p2.lng], { icon: iconDestino }).addTo(map);

    const boundsPoints: any[] = [
      [p1.lat, p1.lng],
      [p2.lat, p2.lng]
    ];

    // Rota Loja -> Cliente (Linha azul premium)
    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.85,
      dashArray: '2, 6'
    }).addTo(map);

    // Se houver motorista ativo
    if (pm && pm.lat && pm.lng) {
      const motIconEmoji = pm.veiculo === 'Moto' ? '🛵' : pm.veiculo === 'Caminhão' ? '🚚' : '🚛';
      const iconMotorista = createEmojiIcon(motIconEmoji, pm.name || 'Entregador');
      L.marker([pm.lat, pm.lng], { icon: iconMotorista }).addTo(map);
      boundsPoints.push([pm.lat, pm.lng]);

      // Rota Motorista -> Retirada (Linha tracejada laranja)
      L.polyline([[pm.lat, pm.lng], [p1.lat, p1.lng]], {
        color: '#f97316',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 5'
      }).addTo(map);
    }

    // Auto-Ajustar enquadramento do mapa
    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [50, 50] });
    }

    // Forçar recálculo de tamanho do container
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (_e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, leafletLoaded, users, origemId, destinoId, motoristaId]);

  if (!isOpen) return null;

  const p1 = users[origemId];
  const p2 = users[destinoId];
  const dist = (p1?.lat && p2?.lat) ? haversineKm(p1.lat || 0, p1.lng || 0, p2.lat || 0, p2.lng || 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="bg-blue-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg">🗺️ Trajeto da Entrega (OSM)</h3>
          <button onClick={onClose} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
        </div>
        
        <div className="relative w-full h-[45vh] sm:h-[400px] bg-zinc-100 dark:bg-zinc-900 shrink-0 overflow-hidden">
          <div id="acaifood-leaflet-map" ref={mapContainerRef} className="w-full h-full z-10" />
          
          {!leafletLoaded && (
            <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center gap-3 z-20">
              <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando mapa interativo...</p>
            </div>
          )}
        </div>

        <div className="p-5 bg-gray-50 dark:bg-zinc-900 flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 shrink-0 pb-8 sm:pb-5">
          <div className="text-sm font-bold text-gray-700 dark:text-zinc-300">
            Distância: <span className="text-blue-700 dark:text-blue-400 text-lg">{dist.toFixed(1)} km</span>
          </div>
          <button onClick={onClose} className="px-5 py-3 bg-gray-800 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl font-bold transition active:scale-95">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
