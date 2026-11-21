import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import WelcomeClient from './WelcomeClient';

interface Props {
  params: Promise<{ codigo: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AffiliateReferralPage({ params }: Props) {
  const resolvedParams = await params;
  const rawCode = resolvedParams?.codigo || '';
  const code = rawCode.trim().toUpperCase();

  if (!code) {
    redirect('/');
  }

  const supabase = getSupabaseAdmin();

  // 1. Consultar partner_affiliates pelo referral_code (status = 'active')
  const { data: affiliate } = await supabase
    .from('partner_affiliates')
    .select('id, name, referral_code, status')
    .ilike('referral_code', code)
    .eq('status', 'active')
    .maybeSingle();

  if (!affiliate) {
    // Redireciona suavemente para home se não encontrado ou inativo
    redirect('/?ref_error=afiliado_invalido');
  }

  // 2. Buscar duração do cookie em platform_settings (chave affiliate_settings)
  let cookieDays = 7;
  try {
    const { data: cfgRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'affiliate_settings')
      .maybeSingle();
    
    if (cfgRow?.value?.cookie_days) {
      cookieDays = Number(cfgRow.value.cookie_days) || 7;
    }
  } catch (_e) {
    // fallback padrão de 7 dias
  }

  return (
    <WelcomeClient 
      partnerName={affiliate.name}
      referralCode={affiliate.referral_code || code}
      cookieDays={cookieDays}
    />
  );
}
