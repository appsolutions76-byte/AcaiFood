// Serviço de Cálculo de Distância Real por Ruas (OSRM / OpenStreetMap) com Fallback Inteligente

// Cache em memória de distâncias calculadas por coordenadas (arredondadas para ~10m)
const routeCache = new Map<string, { km: number; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora de cache por par de coordenadas

/**
 * Fórmula clássica de Haversine para cálculo de distância esférica em linha reta.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

function getCacheKey(lat1: number, lon1: number, lat2: number, lon2: number): string {
  return `${lat1.toFixed(4)},${lon1.toFixed(4)}->${lat2.toFixed(4)},${lon2.toFixed(4)}`;
}

/**
 * Retorna a distância real pelas ruas via OSRM (OpenStreetMap Routing).
 * Se a API falhar, demorar mais de 3s ou estiver offline, usa a distância em linha reta
 * com fator urbano de 1.25x (25% a mais) como fallback seguro, garantindo alta disponibilidade.
 */
export async function getRouteDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (!nLat1 || !nLon1 || !nLat2 || !nLon2) return 3.0;

  // Se a origem e o destino forem o mesmo local (menos de 5 metros)
  if (Math.abs(nLat1 - nLat2) < 0.00005 && Math.abs(nLon1 - nLon2) < 0.00005) {
    return 0.1;
  }

  const key = getCacheKey(nLat1, nLon1, nLat2, nLon2);
  const cached = routeCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.km;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    // OSRM espera coordenadas no formato: longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/driving/${nLon1},${nLat1};${nLon2},${nLat2}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && typeof data.routes[0].distance === 'number') {
        const meters = data.routes[0].distance;
        const realKm = Number((meters / 1000).toFixed(2));
        if (realKm > 0) {
          routeCache.set(key, { km: realKm, timestamp: Date.now() });
          return realKm;
        }
      }
    }
  } catch (_err) {
    // Falha de rede ou timeout -> prossegue para o fallback com fator viário
  }

  // Fallback seguro: Haversine com fator de rota urbana (1.25x para compensar curvas de quarteirão)
  const lineKm = haversineKm(nLat1, nLon1, nLat2, nLon2);
  const fallbackKm = Number(Math.max(0.5, lineKm * 1.25).toFixed(2));
  routeCache.set(key, { km: fallbackKm, timestamp: Date.now() });
  return fallbackKm;
}

/**
 * Versão síncrona para renderização imediata de feeds/listas.
 * Usa o valor em cache (se já consultado via OSRM) ou o valor estimado com fator urbano de 1.25x.
 */
export function getEstimatedRouteDistanceSync(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (!nLat1 || !nLon1 || !nLat2 || !nLon2) return 3.0;

  const key = getCacheKey(nLat1, nLon1, nLat2, nLon2);
  const cached = routeCache.get(key);
  if (cached) return cached.km;

  const lineKm = haversineKm(nLat1, nLon1, nLat2, nLon2);
  return Number(Math.max(0.5, lineKm * 1.25).toFixed(2));
}
