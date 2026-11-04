import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * R45 — Mapa ao vivo do admin (somente leitura).
 * Parceiros com localização cadastrada: batedeiras, fornecedores, motoboys e caminhões.
 * Clientes NÃO entram (endereço residencial é dado pessoal — LGPD).
 * Bloqueados não aparecem. "Em corrida" = entregador com pedido em rota.
 */

const SELLER_ROLES = ['PARTNER', 'LOJA', 'BATEDEIRA', 'SUPPLIER', 'FORNECEDOR'];
const DRIVER_ROLES = ['COURIER', 'MOTORISTA', 'MOTOBOY', 'DRIVER', 'CAMINHAO'];
const IN_ROUTE = ['IN_TRANSIT', 'DELIVERING', 'DELIVERED'];

function kindOf(role: string, vehicle: string) {
  const r = role.toUpperCase();
  if (r === 'PARTNER' || r === 'LOJA' || r === 'BATEDEIRA') return 'batedeira';
  if (r === 'SUPPLIER' || r === 'FORNECEDOR') return 'fornecedor';
  const v = vehicle.toUpperCase();
  if (v === 'TRUCK' || v === 'DUMP_TRUCK') return 'caminhao';
  return 'motoboy';
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const roles = [...SELLER_ROLES, ...DRIVER_ROLES];
    const roleFilter = roles.map(r => `role.eq.${r}`).concat(roles.map(r => `role.eq.${r.toLowerCase()}`)).join(',');

    const baseFields = 'id, name, role, vehicle_type, status, is_online, latitude, longitude, cidade, bairro, storefronts(store_name, is_active)';
    // A coluna location_updated_at vem da migration R45; se ainda não existir, segue sem ela.
    let rows: any[] = [];
    let hasLocationTime = true;
    {
      const res = await supabase.from('users').select(`${baseFields}, location_updated_at`).or(roleFilter);
      if (res.error) {
        hasLocationTime = false;
        const res2 = await supabase.from('users').select(baseFields).or(roleFilter);
        if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });
        rows = res2.data || [];
      } else {
        rows = res.data || [];
      }
    }

    // Entregadores com corrida em andamento
    const driverIds = rows.filter(u => DRIVER_ROLES.includes(String(u.role || '').toUpperCase())).map(u => u.id);
    const busy = new Set<string>();
    for (let i = 0; i < driverIds.length; i += 200) {
      const { data } = await supabase.from('orders').select('driver_id').in('status', IN_ROUTE).in('driver_id', driverIds.slice(i, i + 200));
      (data || []).forEach((o: any) => o.driver_id && busy.add(o.driver_id));
    }

    const points = rows
      .filter(u => String(u.status || '').toLowerCase() !== 'blocked')
      .map(u => {
        const lat = Number(u.latitude);
        const lng = Number(u.longitude);
        const kind = kindOf(String(u.role || ''), String(u.vehicle_type || ''));
        const sf = Array.isArray(u.storefronts) ? u.storefronts[0] : u.storefronts;
        const rawStatus = String(u.status || '').toLowerCase();
        let online: boolean;
        if (rawStatus === 'paused') online = false;
        else if (rawStatus === 'active') online = true;
        else if (typeof u.is_online === 'boolean') online = u.is_online;
        else if (typeof sf?.is_active === 'boolean') online = sf.is_active;
        else online = true;
        return {
          id: u.id,
          kind,
          name: (kind === 'batedeira' || kind === 'fornecedor') ? (sf?.store_name || u.name || '') : (u.name || ''),
          online,
          busy: busy.has(u.id),
          lat: Number.isFinite(lat) ? lat : 0,
          lng: Number.isFinite(lng) ? lng : 0,
          cidade: u.cidade || '',
          bairro: u.bairro || '',
          locationUpdatedAt: hasLocationTime ? (u.location_updated_at || null) : null,
        };
      });

    const withLocation = points.filter(p => p.lat !== 0 && p.lng !== 0);
    const withoutLocation = points.filter(p => p.lat === 0 || p.lng === 0).map(p => ({ id: p.id, kind: p.kind, name: p.name, cidade: p.cidade }));

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      hasLocationTime,
      points: withLocation,
      withoutLocation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar o mapa' }, { status: 500 });
  }
}
