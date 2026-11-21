import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { partner_id, period_start, period_end } = body;

    if (!partner_id || !period_start || !period_end) {
      return NextResponse.json({ error: 'Sócio e período são obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar percentual de participação do sócio
    const { data: partner, error: partnerErr } = await supabase
      .from('profit_sharing_partners')
      .select('id, name, share_pct, pix_key, pix_key_type')
      .eq('id', partner_id)
      .single();

    if (partnerErr || !partner) {
      return NextResponse.json({ error: 'Sócio investidor não encontrado' }, { status: 404 });
    }

    const sharePct = Number(partner.share_pct || 0);

    // Ajuste de timestamp para abranger o período completo
    const startIso = `${period_start}T00:00:00.000Z`;
    const endIso = `${period_end}T23:59:59.999Z`;

    // 2. Calcular taxas de plataforma dos pedidos entregues (RECEIVED) no período
    const { data: orders } = await supabase
      .from('orders')
      .select('applied_platform_fee, applied_platform_fee_driver')
      .eq('status', 'RECEIVED')
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    const platformFees = Number(
      (orders || [])
        .reduce((sum, o: any) => sum + Number(o.applied_platform_fee || 0) + Number(o.applied_platform_fee_driver || 0), 0)
        .toFixed(2)
    );

    // 3. Calcular taxas de ativação (store_activations se houver)
    let activationFees = 0;
    try {
      const { data: activations } = await supabase
        .from('store_activations')
        .select('activation_fee')
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      if (activations) {
        activationFees = Number(
          activations.reduce((sum, a: any) => sum + Number(a.activation_fee || 0), 0).toFixed(2)
        );
      }
    } catch (_e) {
      activationFees = 0;
    }

    const grossRevenue = Number((platformFees + activationFees).toFixed(2));

    // 4. Custos com afiliados no período (affiliate_commission_ledger)
    let affiliateCosts = 0;
    try {
      const { data: ledger } = await supabase
        .from('affiliate_commission_ledger')
        .select('affiliate_amount')
        .gte('credited_at', startIso)
        .lte('credited_at', endIso);

      if (ledger) {
        affiliateCosts = Number(
          ledger.reduce((sum, l: any) => sum + Number(l.affiliate_amount || 0), 0).toFixed(2)
        );
      }
    } catch (_e) {
      affiliateCosts = 0;
    }

    // 5. Custos Asaas (estimado como 0 para edição manual pelo admin)
    const asaasFees = 0;
    const otherCosts = 0;

    const netRevenue = Number((grossRevenue - asaasFees - affiliateCosts - otherCosts).toFixed(2));
    const amount = Number((netRevenue * sharePct).toFixed(2));

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        share_pct: sharePct,
        pix_key: partner.pix_key,
        pix_key_type: partner.pix_key_type,
      },
      calculation: {
        period_start,
        period_end,
        platform_fees: platformFees,
        activation_fees: activationFees,
        gross_revenue: grossRevenue,
        asaas_fees: asaasFees,
        affiliate_costs: affiliateCosts,
        other_costs: otherCosts,
        other_costs_note: '',
        net_revenue: netRevenue,
        share_pct: sharePct,
        amount: Math.max(0, amount),
      },
    });
  } catch (error: any) {
    console.error('[Profit Sharing Calculate] Exceção:', error);
    return NextResponse.json({ error: error.message || 'Erro ao calcular repasse' }, { status: 500 });
  }
}
