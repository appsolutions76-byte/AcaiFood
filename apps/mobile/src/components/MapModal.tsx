"use client";

import React from "react";
import { useAppStore } from "@/store/useAppStore";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  origemId: string;
  destinoId: string;
  motoristaId?: string | null;
}

const MAP_BOUNDS = { latMin: -1.51, latMax: -1.38, lonMin: -48.55, lonMax: -48.41 };

function latLngToMapPct(lat: number, lng: number) {
  const x = ((lng - MAP_BOUNDS.lonMin) / (MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin)) * 100;
  const y = ((lat - MAP_BOUNDS.latMax) / (MAP_BOUNDS.latMin - MAP_BOUNDS.latMax)) * 100;
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(90, y)) };
}

export function MapModal({ isOpen, onClose, origemId, destinoId, motoristaId }: MapModalProps) {
  const users = useAppStore(state => state.users);

  if (!isOpen) return null;

  const p1 = users[origemId];
  const p2 = users[destinoId];
  const pm = motoristaId ? users[motoristaId] : null;

  if (!p1 || !p2 || !p1.lat || !p2.lat) return null;

  // Import local de haversine
  const { haversineKm } = require("@/store/useAppStore");
  const dist = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);

  const pos1 = latLngToMapPct(p1.lat, p1.lng!);
  const pos2 = latLngToMapPct(p2.lat, p2.lng!);
  const posM = (pm && pm.lat) ? latLngToMapPct(pm.lat, pm.lng!) : null;

  const motIcon = pm?.veiculo === 'Moto' ? '🛵' : pm?.veiculo === 'Caminhão' ? '🚚' : '🚛';

  return (
    <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="bg-blue-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg">🗺️ Trajeto da Entrega</h3>
          <button onClick={onClose} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
        </div>
        
        <div className="relative w-full h-[45vh] sm:h-[400px] bg-blue-50 dark:bg-blue-950 shrink-0 overflow-hidden" 
             style={{ backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1={`${pos1.x}%`} y1={`${pos1.y}%`} x2={`${pos2.x}%`} y2={`${pos2.y}%`} stroke="#3b82f6" strokeWidth="3" strokeDasharray="8,8" opacity="0.7"/>
            {posM && (
              <line x1={`${posM.x}%`} y1={`${posM.y}%`} x2={`${pos1.x}%`} y2={`${pos1.y}%`} stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,6" opacity="0.6"/>
            )}
          </svg>

          {posM && pm && (
            <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: `${posM.x}%`, top: `${posM.y}%` }}>
              <span className="text-2xl drop-shadow-md">{motIcon}</span>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded border border-yellow-300 shadow-sm whitespace-nowrap">{pm.name}</span>
            </div>
          )}

          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: `${pos1.x}%`, top: `${pos1.y}%` }}>
            <span className="text-3xl drop-shadow-md">📍</span>
            <span className="bg-white text-zinc-800 text-xs font-bold px-2 py-0.5 rounded border shadow-sm whitespace-nowrap">{p1.name}</span>
          </div>

          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: `${pos2.x}%`, top: `${pos2.y}%` }}>
            <span className="text-3xl drop-shadow-md animate-bounce">🏁</span>
            <span className="bg-white text-zinc-800 text-xs font-bold px-2 py-0.5 rounded border shadow-sm whitespace-nowrap">{p2.name}</span>
          </div>

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
