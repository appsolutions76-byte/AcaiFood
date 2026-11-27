import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['afiliado', 'admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const userId = auth.user?.id || auth.profile?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar registro em partner_affiliates
    let query = supabase
      .from('partner_affiliates')
      .select('*');

    // Se for admin consultando a si mesmo ou passando ?affiliate_id=...
    const { searchParams } = new URL(request.url);
    const targetAffiliateId = searchParams.get('affiliate_id');

    if (auth.profile?.role === 'admin' && targetAffiliateId) {
      query = query.eq('id', targetAffiliateId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: affiliate, error: affErr } = await query.maybeSingle();

    if (affErr || !affiliate) {
      return NextResponse.json(
        { error: 'Cadastro de afiliado não encontrado para este usuário.' },
        { status: 404 }
      );
    }

    if (affiliate.status !== 'active') {
      return NextResponse.json({
        success: true,
        status: affiliate.status,
        message: 'Sua conta de parceiro está em análise ou suspensa.',
        affiliate,
      });
    }

    // 2. Buscar indicações (affiliate_referrals)
    const { data: rawReferrals } = await supabase
      .from('affiliate_referrals')
      .select('id, referred_user_id, referred_role, referred_at, activated_at, bonus_paid, bonus_amount, users!affiliate_referrals_referred_user_id_fkey(name, email)')
      .eq('affiliate_id', affiliate.id)
      .order('referred_at', { ascending: false });

    // Buscar regras de comissão (base da comissão por indicado/perfil)
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_referral_rules')
      .maybeSingle();

    const rules = cfgRow?.value || { referral_basis: {}, affiliate_defaults: {} };
    const referrals = (rawReferrals || []).map((r: any) => {
      const basis =
        rules?.referral_basis?.[r.referred_user_id] ||
        rules?.affiliate_defaults?.[affiliate.id]?.[r.referred_role] ||
        'platform_revenue';
      return {
        ...r,
        commission_basis: basis, // 'platform_revenue' | 'net_revenue'
      };
    });

    // 3. Buscar comissões do ledger (últimos 20)
    const { data: ledger } = await supabase
      .from('affiliate_commission_ledger')
      .select('id, order_id, platform_commission, affiliate_pct, affiliate_amount, credited_at, paid_out')
      .eq('affiliate_id', affiliate.id)
      .order('credited_at', { ascending: false })
      .limit(20);

    // 4. Calcular total acumulado no mês atual
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthLedger } = await supabase
      .from('affiliate_commission_ledger')
      .select('affiliate_amount')
      .eq('affiliate_id', affiliate.id)
      .gte('credited_at', firstDayOfMonth);

    const monthTotal = (monthLedger || []).reduce(
      (sum, row) => sum + Number(row.affiliate_amount || 0),
      0
    );

    // 5. Histórico de solicitações de saque (withdrawal_requests)
    const { data: withdrawals } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('partner_id', userId)
      .order('created_at', { ascending: false });

    const totalWithdrawn = (withdrawals || [])
      .filter((w) => w.status === 'PAGO')
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    const totalEarned = Number(affiliate.total_earned || 0);
    const availableBalance = Math.max(0, Number((totalEarned - totalWithdrawn).toFixed(2)));

    return NextResponse.json({
      success: true,
      affiliate,
      referral_code: affiliate.referral_code,
      status: affiliate.status,
      metrics: {
        total_earned_month: Number(monthTotal.toFixed(2)),
        total_earned_history: totalEarned,
        total_withdrawn: Number(totalWithdrawn.toFixed(2)),
        available_balance: availableBalance,
        referrals_count: (referrals || []).length,
      },
      referrals: referrals || [],
      ledger: ledger || [],
      withdrawals: withdrawals || [],
      rules: {
        bonus_per_store: Number(affiliate.bonus_per_store || 0),
        bonus_per_client: Number(affiliate.bonus_per_client || 0),
        commission_pct: Number(affiliate.commission_pct || 0),
        commission_months: affiliate.commission_months,
        commission_start: affiliate.commission_start,
        withdrawal_mode: affiliate.withdrawal_mode,
      },
    });
  } catch (error: any) {
    console.error('[Affiliate Dashboard] Exceção:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
