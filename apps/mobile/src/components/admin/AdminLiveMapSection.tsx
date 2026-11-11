"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeaders } from "@/store/useAppStore";
import { StoreIcon, STORE_EMOJI, storeIconSvg } from "@/components/StoreIcon";

// R45 — Mapa ao vivo do admin: batedeiras, fornecedores, motoboys e caminhões (sem clientes)

type Kind = 'batedeira' | 'fornecedor' | 'motoboy' | 'caminhao';
type Point = {
  id: string;
  kind: Kind;
  name: string;
  online: boolean;
  busy: boolean;
  lat: number;
  lng: number;
  cidade: string;
  bairro: string;
  locationUpdatedAt: string | null;
};

const KINDS: Array<{ id: Kind; label: string; emoji: React.ReactNode }> = [
  { id: 'batedeira', label: 'Batedeiras', emoji: <StoreIcon size={14} /> },
  { id: 'motoboy', label: 'Motoboys', emoji: '🏍️' },
  { id: 'fornecedor', label: 'Fornecedores', emoji: '🏭' },
  { id: 'caminhao', label: 'Caminhões', emoji: '🚛' },
];
const EMOJI: Record<Kind, string> = { batedeira: STORE_EMOJI, motoboy: '🏍️', fornecedor: '🏭', caminhao: '🚛' };
const markerIcon = (kind: Kind) => (kind === 'batedeira' ? storeIconSvg(22) : EMOJI[kind]);
const popupIcon = (kind: Kind) => (kind === 'batedeira' ? storeIconSvg(14) : EMOJI[kind]);
const REFRESH_MS = 30000;
const BELEM: [number, number] = [-1.4558, -48.4908];

const esc = (s: string) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function ago(iso: string | null) {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia(s)`;
}

function statusOf(p: Point) {
  if (p.kind === 'motoboy' || p.kind === 'caminhao') {
    if (p.busy) return { label: 'Em corrida', color: '#f59e0b' };
    return p.online ? { label: 'Online', color: '#16a34a' } : { label: 'Pausado', color: '#9ca3af' };
  }
  return p.online ? { label: 'Aberta', color: '#16a34a' } : { label: 'Fechada', color: '#9ca3af' };
}

function useLeaflet() {
  const [ready, setReady] = useState<boolean>(typeof window !== 'undefined' && Boolean((window as any).L));
  useEffect(() => {
    if ((window as any).L) { setReady(true); return; }
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    let timer: any = null;
    if (!document.getElementById('leaflet-cdn-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-cdn-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setReady(true);
      document.body.appendChild(script);
    } else {
      timer = setInterval(() => { if ((window as any).L) { setReady(true); clearInterval(timer); } }, 150);
    }
    return () => { if (timer) clearInterval(timer); };
  }, []);
  return ready;
}

export function AdminLiveMapSection() {
  const leafletReady = useLeaflet();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const fittedRef = useRef(false);

  const [points, setPoints] = useState<Point[]>([]);
  const [withoutLocation, setWithoutLocation] = useState<Array<{ id: string; kind: Kind; name: string; cidade: string }>>([]);
  const [hasLocationTime, setHasLocationTime] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ batedeira: true, motoboy: true, fornecedor: true, caminhao: true });
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [city, setCity] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/live-map', { headers: await getAuthHeaders(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || `Erro ${res.status}`);
      setPoints(Array.isArray(json.points) ? json.points : []);
      setWithoutLocation(Array.isArray(json.withoutLocation) ? json.withoutLocation : []);
      setHasLocationTime(Boolean(json.hasLocationTime));
      setUpdatedAt(json.generatedAt || new Date().toISOString());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar o mapa');
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualização automática (só com a aba visível)
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const cities = useMemo(() => Array.from(new Set(points.map(p => p.cidade).filter(Boolean))).sort(), [points]);

  const visible = useMemo(() => points.filter(p =>
    kinds[p.kind] && (!onlyOnline || p.online || p.busy) && (city === 'all' || p.cidade === city)
  ), [points, kinds, onlyOnline, city]);

  const counters = useMemo(() => {
    const inCity = points.filter(p => city === 'all' || p.cidade === city);
    return {
      lojasAbertas: inCity.filter(p => p.kind === 'batedeira' && p.online).length,
      lojasTotal: inCity.filter(p => p.kind === 'batedeira').length,
      motoOnline: inCity.filter(p => p.kind === 'motoboy' && (p.online || p.busy)).length,
      motoCorrida: inCity.filter(p => p.kind === 'motoboy' && p.busy).length,
      motoTotal: inCity.filter(p => p.kind === 'motoboy').length,
      fornecedores: inCity.filter(p => p.kind === 'fornecedor').length,
      caminhoesOnline: inCity.filter(p => p.kind === 'caminhao' && (p.online || p.busy)).length,
    };
  }, [points, city]);

  // Cria o mapa uma vez
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapDivRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(BELEM, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => { try { map.invalidateSize(); } catch (_e) { /* ok */ } }, 200);
    return () => {
      try { map.remove(); } catch (_e) { /* ok */ }
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, [leafletReady]);

  // Desenha os marcadores
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    visible.forEach(p => {
      const st = statusOf(p);
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid ${st.color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:${p.online || p.busy ? 1 : 0.6}">${markerIcon(p.kind)}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const when = p.locationUpdatedAt ? `<br/><span style="color:#666">Posição: ${esc(ago(p.locationUpdatedAt))}</span>` : '';
      const where = [p.bairro, p.cidade].filter(Boolean).map(esc).join(' · ');
      L.marker([p.lat, p.lng], { icon })
        .bindPopup(`<b>${esc(p.name || '—')}</b><br/>${popupIcon(p.kind)} ${esc(KINDS.find(k => k.id === p.kind)?.label.replace(/s$/, '') || '')} · <span style="color:${st.color};font-weight:bold">${st.label}</span>${where ? `<br/>${where}` : ''}${when}`)
        .addTo(layerRef.current);
    });
    if (!fittedRef.current && visible.length > 0) {
      const bounds = L.latLngBounds(visible.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [visible, leafletReady]);

  const recenter = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current || visible.length === 0) return;
    mapRef.current.fitBounds(L.latLngBounds(visible.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Mapa ao vivo</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Batedeiras, fornecedores, motoboys e caminhões com localização cadastrada. Clientes não aparecem.
              Atualiza sozinho a cada 30 s{updatedAt ? ` · última: ${new Date(updatedAt).toLocaleTimeString('pt-BR')}` : ''}.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={recenter} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs border border-zinc-200 dark:border-zinc-700 cursor-pointer">🎯 Centralizar</button>
            <button onClick={load} disabled={loading} className="px-3 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs disabled:opacity-50 cursor-pointer">{loading ? 'Atualizando...' : '🔄 Atualizar'}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
            <p className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300"><StoreIcon size={12} /> Lojas abertas</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{counters.lojasAbertas}<span className="text-xs text-zinc-500"> / {counters.lojasTotal}</span></p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
            <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">🏍️ Motoboys online</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{counters.motoOnline}<span className="text-xs text-zinc-500"> / {counters.motoTotal}</span></p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
            <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">🛵 Em corrida</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{counters.motoCorrida}</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">🏭 Fornecedores · 🚛 online</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{counters.fornecedores} · {counters.caminhoesOnline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map(k => (
            <button
              key={k.id}
              onClick={() => setKinds(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${kinds[k.id] ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}
            >
              {k.emoji} {k.label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1 cursor-pointer">
            <input type="checkbox" checked={onlyOnline} onChange={e => setOnlyOnline(e.target.checked)} />
            Só online / abertos agora
          </label>
          {cities.length > 1 && (
            <select value={city} onChange={e => setCity(e.target.value)} className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white">
              <option value="all">Todas as cidades</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: '#16a34a' }} />Online / aberta</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: '#f59e0b' }} />Em corrida</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: '#9ca3af' }} />Pausado / fechada</span>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative z-0">
        <div ref={mapDivRef} style={{ height: '65vh', minHeight: 360, width: '100%' }} />
        {!leafletReady && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 bg-white/70 dark:bg-zinc-900/70">Carregando mapa...</div>}
      </div>

      <div className="text-[11px] text-zinc-500 space-y-1">
        <p>{visible.length} no mapa com os filtros atuais.</p>
        {!hasLocationTime && <p>A hora da última posição aparece depois que a atualização do banco (R45) for aplicada.</p>}
        {withoutLocation.length > 0 && (
          <p>Sem localização cadastrada ({withoutLocation.length}): {withoutLocation.slice(0, 12).map(w => `${EMOJI[w.kind]} ${w.name || '—'}`).join(', ')}{withoutLocation.length > 12 ? '…' : ''}</p>
        )}
      </div>
    </div>
  );
}

export default AdminLiveMapSection;
