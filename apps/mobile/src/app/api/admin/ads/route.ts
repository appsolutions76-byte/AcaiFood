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

    if (!firstRow?.id) {
      return NextResponse.json({ error: 'Configuração da plataforma não encontrada' }, { status: 404 });
    }

    let currentCfg: any = {};
    if (firstRow.asaas_platform_wallet_id) {
      try {
        currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
      } catch (_e) {}
    }

    const { DEFAULT_ADS } = await import('@/app/api/ads/route');
    let ads: AdItem[] = Array.isArray(currentCfg.ads) && currentCfg.ads.length > 0 ? currentCfg.ads : [...DEFAULT_ADS];

    if (action === 'save' && ad) {
      const existingIdx = ads.findIndex(a => a.id === ad.id);
      const isAct = ad.active !== false && ad.isActive !== false;
      const newAd: AdItem = {
        ...ad,
        id: ad.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        isActive: isAct,
        viewsCount: ad.viewsCount || 0,
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

    const { error: updErr } = await supabase
      .from('platform_settings')
      .update({ asaas_platform_wallet_id: JSON.stringify(currentCfg) })
      .eq('id', firstRow.id);

    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      ads
    });
  } catch (error: any) {
    console.error('Erro POST /api/admin/ads:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar anúncios' }, { status: 500 });
  }
}
