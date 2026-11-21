import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token ausente' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: affiliate, error } = await supabase
      .from('partner_affiliates')
      .select('id, name, contact, referral_code, status, invite_expires_at')
      .eq('invite_token', token.trim())
      .gt('invite_expires_at', nowIso)
      .eq('status', 'pending')
      .maybeSingle();

    if (error || !affiliate) {
      return NextResponse.json({ valid: false, error: 'Convite inválido, já utilizado ou expirado.' }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      partner: {
        id: affiliate.id,
        name: affiliate.name,
        contact: affiliate.contact,
        referral_code: affiliate.referral_code,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: 'Erro ao validar token' }, { status: 500 });
  }
}
