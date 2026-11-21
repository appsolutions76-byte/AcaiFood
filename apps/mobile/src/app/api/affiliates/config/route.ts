import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const DEFAULT_CONFIG = {
  invite_expiry_days: 7,
  cookie_days: 7,
  min_withdrawal: 20.0,
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_settings')
      .maybeSingle();

    const config = cfgRow?.value || DEFAULT_CONFIG;
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { invite_expiry_days, cookie_days, min_withdrawal } = body;

    const newConfig = {
      invite_expiry_days: Number(invite_expiry_days) || 7,
      cookie_days: Number(cookie_days) || 7,
      min_withdrawal: Number(min_withdrawal) || 20.0,
    };

    const supabase = getSupabaseAdmin();

    // Salvar em platform_config
    await supabase.from('platform_config').upsert({
      key: 'affiliate_settings',
      value: newConfig,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    // Salvar também em platform_settings se a coluna existir
    try {
      await supabase.from('platform_settings').upsert({
        key: 'affiliate_settings',
        value: newConfig,
      }, { onConflict: 'key' });
    } catch (_e) {}

    return NextResponse.json({ success: true, config: newConfig });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
