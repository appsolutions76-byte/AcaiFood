import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const { data: payouts, error } = await supabase
      .from('profit_sharing_payouts')
      .select('*, profit_sharing_partners(id, name, pix_key, pix_key_type, share_pct)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, payouts: payouts || [] });
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
      partner_id,
      period_start,
      period_end,
      platform_fees,
      activation_fees,
      gross_revenue,
      asaas_fees,
      affiliate_costs,
      other_costs,
      other_costs_note,
      net_revenue,
      share_pct,
      amount,
    } = body;

    if (!partner_id || !period_start || !period_end || amount === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes para registrar o repasse' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const adminUserId = auth.profile?.id || auth.user?.id || null;

    const { data: inserted, error: insertErr } = await supabase
      .from('profit_sharing_payouts')
      .insert({
        partner_id,
        period_start,
        period_end,
        platform_fees: Number(platform_fees) || 0,
        activation_fees: Number(activation_fees) || 0,
        gross_revenue: Number(gross_revenue) || 0,
        asaas_fees: Number(asaas_fees) || 0,
        affiliate_costs: Number(affiliate_costs) || 0,
        other_costs: Number(other_costs) || 0,
        other_costs_note: other_costs_note ? String(other_costs_note).trim() : null,
        net_revenue: Number(net_revenue) || 0,
        share_pct: Number(share_pct) || 0,
        amount: Number(amount) || 0,
        status: 'pending',
        created_by: adminUserId,
      })
      .select('*, profit_sharing_partners(id, name, pix_key, pix_key_type)')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, payout: inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
