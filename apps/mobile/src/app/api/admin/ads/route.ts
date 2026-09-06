import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { AdItem } from '@/app/api/ads/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('platform_settings')
      .select('asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    let ads: AdItem[] = [];

    if (row?.asaas_platform_wallet_id) {
      try {
        const parsed = JSON.parse(row.asaas_platform_wallet_id);
        if (parsed && Array.isArray(parsed.ads) && parsed.ads.length > 0) {
          ads = parsed.ads;
        }
      } catch (_e) {}
    }

    // Se ainda não houver anúncios salvos no banco, inicializa com DEFAULT_ADS
    if (ads.length === 0) {
      const { DEFAULT_ADS } = await import('@/app/api/ads/route');
      ads = DEFAULT_ADS;
    }

    return NextResponse.json({
      success: true,
      ads
    });
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
    const { data: firstRow } = await supabase
      .from('platform_settings')
      .select('id, asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    let currentCfg: any = {};
    if (firstRow?.asaas_platform_wallet_id) {
      try {
        currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
      } catch (_e) {}
    }

    const { DEFAULT_ADS } = await import('@/app/api/ads/route');
    let ads: AdItem[] = Array.isArray(currentCfg.ads) && currentCfg.ads.length > 0 ? currentCfg.ads : [...DEFAULT_ADS];

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

    currentCfg.ads = ads;

    if (firstRow?.id) {
      const { error: updErr } = await supabase
        .from('platform_settings')
        .update({ asaas_platform_wallet_id: JSON.stringify(currentCfg) })
        .eq('id', firstRow.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from('platform_settings')
        .insert({ asaas_platform_wallet_id: JSON.stringify(currentCfg) });
      if (insErr) throw insErr;
    }

    return NextResponse.json({
      success: true,
      ads
    });
  } catch (error: any) {
    console.error('Erro POST /api/admin/ads:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar anúncios' }, { status: 500 });
  }
}
