import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'afiliado']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_referral_rules')
      .maybeSingle();

    return NextResponse.json({
      success: true,
      rules: cfgRow?.value || { referral_basis: {}, affiliate_defaults: {} },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const {
      referred_user_id,
      basis, // 'platform_revenue' | 'net_revenue'
      affiliate_id,
      role_defaults, // { CLIENT?: string, COURIER?: string, SELLER?: string, SUPPLIER?: string }
    } = body;

    const supabase = getSupabaseAdmin();
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_referral_rules')
      .maybeSingle();

    const currentRules = cfgRow?.value || { referral_basis: {}, affiliate_defaults: {} };
    if (!currentRules.referral_basis) currentRules.referral_basis = {};
    if (!currentRules.affiliate_defaults) currentRules.affiliate_defaults = {};

    // Atualização pontual por indicado
    if (referred_user_id && basis) {
      if (basis === 'platform_revenue' || basis === 'net_revenue') {
        currentRules.referral_basis[referred_user_id] = basis;
      }
    }

    // Atualização padrão por afiliado / perfil
    if (affiliate_id && role_defaults) {
      currentRules.affiliate_defaults[affiliate_id] = {
        ...(currentRules.affiliate_defaults[affiliate_id] || {}),
        ...role_defaults,
      };
    }

    await supabase.from('platform_config').upsert(
      {
        key: 'affiliate_referral_rules',
        value: currentRules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    return NextResponse.json({
      success: true,
      rules: currentRules,
      message: 'Regra de base de comissão atualizada com sucesso.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
