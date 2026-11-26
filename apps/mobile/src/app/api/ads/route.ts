import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export interface AdItem {
  id: string;
  title: string;
  advertiserName: string;
  partnerName?: string;
  partnerId?: string;
  description?: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  placement: 'home_banner' | 'home_story' | 'featured_store' | 'partner_b2b' | 'both' | 'banner' | 'story';
  targetType: 'store' | 'whatsapp' | 'url';
  targetValue: string;
  targetUrl?: string;
  city?: string;
  isActive: boolean;
  active?: boolean;
  viewsCount: number;
  impressionsCount?: number;
  clicksCount: number;
  createdAt: string;
  startsAt?: string;
  endsAt?: string;
  startDate?: string;
  endDate?: string;
  pricePaid?: number;
}

export const DEFAULT_ADS: AdItem[] = [
  {
    id: 'ad-default-1',
    title: 'Açaí Puro da Amazônia - Direto da Batedeira',
    advertiserName: 'AçaíFood Oficial',
    mediaType: 'image',
    mediaUrl: '/banner.png?v=6',
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
  },
  {
    id: 'ad-story-1',
    title: 'Açaí Grosso Especial',
    advertiserName: 'Ponto do Açaí',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=800&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=200&q=60',
    placement: 'home_story',
    targetType: 'url',
    targetValue: 'https://www.acaifood.app.br/',
    city: 'ALL',
    isActive: true,
    viewsCount: 95,
    clicksCount: 19,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ad-story-2',
    title: 'Açaí com Tapioca e Peixe Frito',
    advertiserName: 'Churrasco do B10',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=60',
    placement: 'home_story',
    targetType: 'url',
    targetValue: 'https://www.acaifood.app.br/',
    city: 'ALL',
    isActive: true,
    viewsCount: 88,
    clicksCount: 15,
    createdAt: new Date().toISOString()
  }
];

// Lê anúncios da fonte correta: platform_config (key='ads') com fallback para
// asaas_platform_wallet_id (legado) e depois para DEFAULT_ADS hardcoded.
async function loadAdsFromDb(): Promise<AdItem[]> {
  const supabase = getSupabaseAdmin();

  // 1. Fonte principal: platform_config (tabela dedicada, criada no R16)
  try {
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'ads')
      .maybeSingle();

    if (cfgRow?.value && Array.isArray(cfgRow.value) && cfgRow.value.length > 0) {
      return cfgRow.value as AdItem[];
    }
  } catch (_e) {}

  // 2. Fallback legado: asaas_platform_wallet_id (campo antigo)
  try {
    const { data: legacyRow } = await supabase
      .from('platform_settings')
      .select('asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    if (legacyRow?.asaas_platform_wallet_id) {
      const parsed = JSON.parse(legacyRow.asaas_platform_wallet_id);
      if (parsed && Array.isArray(parsed.ads) && parsed.ads.length > 0) {
        return parsed.ads as AdItem[];
      }
    }
  } catch (_e) {}

  // 3. Fallback final: DEFAULT_ADS hardcoded
  return DEFAULT_ADS;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const placement = searchParams.get('placement');

    const ads = await loadAdsFromDb();

    // Filtra apenas ativos
    let filtered = ads.filter(a => a.isActive !== false && (a as any).active !== false);

    // Filtra por cidade (se informada e não for ALL)
    if (city && city !== 'ALL' && city !== 'all') {
      filtered = filtered.filter(a =>
        !a.city || a.city === 'ALL' || a.city === 'all' ||
        a.city.toLowerCase() === city.toLowerCase()
      );
    }

    // Filtra por placement (se informado)
    if (placement) {
      filtered = filtered.filter(a => {
        const p = a.placement;
        if (!p || p === 'both') return true;
        if (placement === 'home_banner') return p === 'home_banner' || p === 'banner';
        if (placement === 'home_story') return p === 'home_story' || p === 'story';
        return p === placement;
      });
    }

    return NextResponse.json({ success: true, ads: filtered });
  } catch (error: any) {
    console.error('Erro GET /api/ads:', error);
    return NextResponse.json({ success: true, ads: DEFAULT_ADS });
  }
}

// Rota para contabilizar impressões e cliques de anúncios de forma ultraleve
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adId, action } = body; // action: 'view' | 'click'

    if (!adId || !action) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Lê da fonte principal
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'ads')
      .maybeSingle();

    let ads: AdItem[] = cfgRow?.value && Array.isArray(cfgRow.value) && cfgRow.value.length > 0
      ? (cfgRow.value as AdItem[])
      : DEFAULT_ADS;

    ads = ads.map(a => {
      if (a.id === adId) {
        return {
          ...a,
          viewsCount: action === 'view' ? (a.viewsCount || 0) + 1 : (a.viewsCount || 0),
          clicksCount: action === 'click' ? (a.clicksCount || 0) + 1 : (a.clicksCount || 0),
        };
      }
      return a;
    });

    await supabase
      .from('platform_config')
      .upsert({ key: 'ads', value: ads, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    return NextResponse.json({ success: true });
  } catch (_e) {
    return NextResponse.json({ success: true }); // Falha silenciosa para não impactar o cliente
  }
}
