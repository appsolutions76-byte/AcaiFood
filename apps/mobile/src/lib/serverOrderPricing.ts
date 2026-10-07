// Preço e distância do pedido calculados no SERVIDOR (C8). Os valores enviados pelo
// app (productsSubtotal, deliveryDistanceKm, items[].price, taxas) são ignorados.

export interface PricedItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface ServerPricingResult {
  ok: boolean;
  error?: string;
  productsSubtotal: number;
  distanceKm: number;
  items: PricedItem[];
}

const B2C_DEFAULTS: Record<string, number> = { popular: 20, medio: 26, grosso: 35, branco: 38 };
const B2C_NAMES: Record<string, string> = {
  popular: 'Açaí Popular (1L)',
  medio: 'Açaí Medio (1L)',
  grosso: 'Açaí Grosso (1L)',
  branco: 'Açaí Branco Especial (1L)'
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseMeta(raw: any): any {
  if (!raw || typeof raw !== 'string') return {};
  try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
}

export async function priceOrderOnServer(params: {
  supabase: any;
  orderType: string;
  sellerStorefrontId: string | null;
  items: any[];
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  buyerId: string;
  clientDistanceKm?: number;
}): Promise<ServerPricingResult> {
  const { supabase, orderType, sellerStorefrontId, items, buyerId } = params;
  const type = String(orderType || 'B2C').toUpperCase();

  // Distância: coordenadas da origem (loja/fornecedor) até o destino da entrega
  let originLat = 0, originLng = 0;
  let sf: any = null;
  if (sellerStorefrontId) {
    const { data } = await supabase
      .from('storefronts')
      .select('id, partner_id, price_b2b, price_b2c_popular, price_b2c_medio, price_b2c_grosso, logo_url')
      .eq('id', sellerStorefrontId)
      .maybeSingle();
    sf = data;
    if (sf?.partner_id) {
      const { data: partner } = await supabase.from('users').select('latitude, longitude').eq('id', sf.partner_id).maybeSingle();
      originLat = Number(partner?.latitude || 0);
      originLng = Number(partner?.longitude || 0);
    }
  }

  let destLat = Number(params.deliveryLat || 0);
  let destLng = Number(params.deliveryLng || 0);
  if (!destLat || !destLng) {
    const { data: buyer } = await supabase.from('users').select('latitude, longitude').eq('id', buyerId).maybeSingle();
    destLat = Number(buyer?.latitude || 0);
    destLng = Number(buyer?.longitude || 0);
  }

  // Mesmo padrão do app quando faltam coordenadas (3 km)
  const distanceKm = (originLat && originLng && destLat && destLng)
    ? Number(haversineKm(originLat, originLng, destLat, destLng).toFixed(2))
    : 3.0;

  if (type === 'COLETA') {
    // Coleta: serviço de frete (sem produto). Sem loja de origem no pedido, a distância
    // informada pelo app é aceita dentro de limites; o valor sai do pricingEngine.
    const d = Number(params.clientDistanceKm || 0);
    const coletaKm = Number.isFinite(d) && d > 0 ? Math.min(Math.max(d, 0.5), 100) : 3.0;
    return { ok: true, productsSubtotal: 0, distanceKm: Number(coletaKm.toFixed(2)), items: [] };
  }

  if (!sf) {
    return { ok: false, error: 'Loja ou fornecedor do pedido não encontrado', productsSubtotal: 0, distanceKm, items: [] };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Carrinho vazio', productsSubtotal: 0, distanceKm, items: [] };
  }

  const meta = parseMeta(sf.logo_url);
  const customIds = items
    .map((it: any) => String(it?.id || it?.product_id || ''))
    .filter(id => id && !['popular', 'medio', 'grosso', 'branco', 'lata'].includes(id));

  let customProducts: Record<string, any> = {};
  if (customIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, price, storefront_id')
      .in('id', customIds)
      .eq('storefront_id', sf.id);
    (prods || []).forEach((p: any) => { customProducts[p.id] = p; });
  }

  const priced: PricedItem[] = [];
  for (const it of items) {
    const id = String(it?.id || it?.product_id || '');
    const qty = Math.floor(Number(it?.quantity || 0));
    if (!id || !Number.isFinite(qty) || qty <= 0 || qty > 999) {
      return { ok: false, error: 'Quantidade inválida no carrinho', productsSubtotal: 0, distanceKm, items: [] };
    }

    let unit = 0;
    let name = '';
    if (type === 'B2C' && B2C_DEFAULTS[id] !== undefined) {
      if (meta?.availabilityB2C && meta.availabilityB2C[id] === false) {
        return { ok: false, error: 'Um item do carrinho está esgotado nesta loja', productsSubtotal: 0, distanceKm, items: [] };
      }
      const col = id === 'branco' ? null : sf[`price_b2c_${id}`];
      unit = Number(col ?? (id === 'branco' ? meta?.priceB2C?.branco : null) ?? B2C_DEFAULTS[id]);
      name = B2C_NAMES[id];
    } else if (type === 'B2B' && id === 'lata') {
      if (meta?.availabilityB2B && meta.availabilityB2B.lata === false) {
        return { ok: false, error: 'Item esgotado neste fornecedor', productsSubtotal: 0, distanceKm, items: [] };
      }
      unit = Number(sf.price_b2b ?? 140);
      name = 'Lata de Açaí Fruto';
    } else if (customProducts[id]) {
      unit = Number(customProducts[id].price);
      name = String(customProducts[id].name || 'Produto');
    } else {
      return { ok: false, error: 'Produto inexistente ou de outra loja no carrinho', productsSubtotal: 0, distanceKm, items: [] };
    }

    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, error: 'Produto sem preço válido', productsSubtotal: 0, distanceKm, items: [] };
    }
    priced.push({ product_id: B2C_DEFAULTS[id] !== undefined || id === 'lata' ? null : id, product_name: name, quantity: qty, unit_price: unit });
  }

  const productsSubtotal = Number(priced.reduce((acc, p) => acc + p.unit_price * p.quantity, 0).toFixed(2));
  return { ok: true, productsSubtotal, distanceKm, items: priced };
}
