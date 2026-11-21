import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();

    // 1. Buscar todos os afiliados com dados do usuário vinculado
    const { data: affiliates, error } = await supabase
      .from('partner_affiliates')
      .select('*, users!partner_affiliates_user_id_fkey(id, name, email, phone, created_at)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Buscar contagem de indicações por afiliado
    const { data: referrals } = await supabase
      .from('affiliate_referrals')
      .select('affiliate_id, id, bonus_paid, bonus_amount');

    const referralCounts: Record<string, number> = {};
    (referrals || []).forEach((r: any) => {
      referralCounts[r.affiliate_id] = (referralCounts[r.affiliate_id] || 0) + 1;
    });

    // 3. Opcional: Buscar saldo Asaas para os ativos com subconta
    const apiKey = await getAsaasApiKey();
    const asaasBalances: Record<string, number> = {};

    // Mapear dados agregados
    const enriched = (affiliates || []).map((aff: any) => {
      return {
        ...aff,
        referrals_count: referralCounts[aff.id] || 0,
        asaas_balance: asaasBalances[aff.id] ?? (Number(aff.total_earned || 0) - Number(aff.total_withdrawn || 0)),
      };
    });

    return NextResponse.json({
      success: true,
      pending: enriched.filter((a: any) => a.status === 'pending'),
      active: enriched.filter((a: any) => a.status === 'active'),
      suspended: enriched.filter((a: any) => a.status === 'suspended' || a.status === 'revoked'),
      all: enriched,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
