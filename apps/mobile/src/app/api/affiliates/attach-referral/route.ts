import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { userId, referralCode } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Se referralCode não veio no body, tenta ler dos cookies da requisição
    if (!referralCode || typeof referralCode !== 'string') {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)affiliate_ref=([^;]*)/);
      if (match) {
        referralCode = decodeURIComponent(match[1]);
      }
    }

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json({ success: false, reason: 'no_referral_code' });
    }

    const cleanCode = referralCode.trim().toUpperCase();
    if (!cleanCode) {
      return NextResponse.json({ success: false, reason: 'empty_referral_code' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar afiliado ativo correspondente
    const { data: affiliate, error: affErr } = await supabase
      .from('partner_affiliates')
      .select('id, user_id, name, referral_code, status, bonus_per_store, bonus_per_client')
      .ilike('referral_code', cleanCode)
      .eq('status', 'active')
      .maybeSingle();

    if (affErr || !affiliate) {
      return NextResponse.json({ success: false, reason: 'affiliate_not_found_or_inactive' });
    }

    // 2. Prevenir auto-indicação
    if (affiliate.user_id && affiliate.user_id === userId) {
      return NextResponse.json({ success: false, reason: 'self_referral_blocked' });
    }

    // 3. Buscar perfil do usuário indicado em users
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, role, referred_by_affiliate')
      .eq('id', userId)
      .maybeSingle();

    if (uErr || !user) {
      return NextResponse.json({ error: 'Usuário indicado não encontrado' }, { status: 404 });
    }

    // Se o usuário já possui um afiliado associado, mantém o primeiro
    if (user.referred_by_affiliate && user.referred_by_affiliate !== affiliate.id) {
      return NextResponse.json({
        success: true,
        alreadyLinked: true,
        affiliateId: user.referred_by_affiliate,
        message: 'Usuário já vinculado a outro afiliado anteriormente.'
      });
    }

    // 4. Atualizar users com referred_by_affiliate
    await supabase
      .from('users')
      .update({ referred_by_affiliate: affiliate.id })
      .eq('id', userId);

    // 5. Calcular valor do bônus conforme o perfil
    const normalizedRole = String(user.role || '').toUpperCase();
    const isStoreOrSupplier = ['PARTNER', 'SUPPLIER', 'LOJA', 'FORNECEDOR', 'BATEDEIRA'].includes(normalizedRole);
    const bonusAmount = isStoreOrSupplier
      ? Number(affiliate.bonus_per_store || 0)
      : Number(affiliate.bonus_per_client || 0);

    // 6. Inserir ou atualizar na tabela affiliate_referrals
    const { data: existingRef } = await supabase
      .from('affiliate_referrals')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('referred_user_id', userId)
      .maybeSingle();

    if (!existingRef) {
      const { error: insErr } = await supabase
        .from('affiliate_referrals')
        .insert({
          affiliate_id: affiliate.id,
          referred_user_id: userId,
          referred_role: user.role,
          bonus_amount: bonusAmount,
          bonus_paid: false
        });

      if (insErr) {
        console.error('[Affiliate Attach] Erro ao inserir affiliate_referrals:', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      affiliateId: affiliate.id,
      affiliateName: affiliate.name,
      referralCode: affiliate.referral_code
    });
  } catch (err: any) {
    console.error('[Affiliate Attach] Exceção:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
