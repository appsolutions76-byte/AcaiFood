import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { AdItem, DEFAULT_ADS } from '@/app/api/ads/route';

export const dynamic = 'force-dynamic';

// Lê anúncios da fonte correta: platform_config (key='ads') com fallback legado
async function loadAdsAdmin(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<AdItem[]> {
  // 1. Fonte principal: platform_config
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

  // 2. Fallback legado: asaas_platform_wallet_id
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

  // 3. Fallback final: DEFAULT_ADS
  return [...DEFAULT_ADS];
}

// Salva anúncios na fonte principal: platform_config (key='ads')
async function saveAdsAdmin(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ads: AdItem[]
): Promise<void> {
  await supabase
    .from('platform_config')
    .upsert({ key: 'ads', value: ads, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const ads = await loadAdsAdmin(supabase);
    return NextResponse.json({ success: true, ads });
  } catch (error: any) {
    console.error('Erro GET /api/admin/ads:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar anúncios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { action, ad, adId } = body; // action: 'save' | 'delete' | 'toggle'

    const supabase = getSupabaseAdmin();
    let ads = await loadAdsAdmin(supabase);

    if (action === 'save' && ad) {
      const existingIdx = ads.findIndex(a => a.id === ad.id);
      const isAct = ad.active !== false && ad.isActive !== false;
      const targetVal = (ad.targetUrl || ad.targetValue || '').trim();
      const isWa = targetVal.includes('whatsapp') || targetVal.includes('wa.me');
      const isHttp = targetVal.startsWith('http') || targetVal.startsWith('/');
      const targetType = isWa ? 'whatsapp' : isHttp ? 'url' : 'store';
      const advName = ad.partnerName || ad.advertiserName || 'AçaíFood Oficial';

      const newAd: AdItem = {
        ...ad,
        id: ad.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: ad.title || 'Comercial Especial',
        advertiserName: advName,
        partnerName: advName,
        partnerId: ad.partnerId || '',
        description: ad.description || '',
        mediaType: ad.mediaType || 'image',
        mediaUrl: ad.mediaUrl || '',
        targetUrl: targetVal,
        targetValue: targetVal,
        targetType: (ad.targetType || targetType) as any,
        placement: (ad.placement || 'both') as any,
        city: ad.city || 'ALL',
        startDate: ad.startDate || ad.startsAt || new Date().toISOString().slice(0, 10),
        endDate: ad.endDate || ad.endsAt || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        pricePaid: Number(ad.pricePaid) || 0,
        isActive: isAct,
        viewsCount: ad.viewsCount || ad.impressionsCount || 0,
        clicksCount: ad.clicksCount || 0,
        createdAt: ad.createdAt || new Date().toISOString()
      };
      (newAd as any).active = isAct;

      if (existingIdx >= 0) {
        ads[existingIdx] = newAd;
      } else {
        ads.unshift(newAd);
      }
    } else if (action === 'delete' && adId) {
      ads = ads.filter(a => a.id !== adId);
    } else if (action === 'toggle' && adId) {
      ads = ads.map(a => {
        if (a.id === adId) {
          const nextVal = !(a.isActive !== false && (a as any).active !== false);
          return { ...a, isActive: nextVal, active: nextVal };
        }
        return a;
      });
    }

    await saveAdsAdmin(supabase, ads);

    return NextResponse.json({ success: true, ads });
  } catch (error: any) {
    console.error('Erro POST /api/admin/ads:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar anúncios' }, { status: 500 });
  }
}
