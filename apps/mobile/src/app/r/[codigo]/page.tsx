import React from 'react';
import { cookies } from 'next/headers';
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
    .eq('referral_code', code)
    .eq('status', 'active')
    .maybeSingle();

  if (!affiliate) {
    // Redireciona suavemente para home se não encontrado ou inativo
    redirect('/?ref_error=afiliado_invalido');
  }

  // 2. Buscar duração do cookie em affiliate_settings
  let cookieDays = 7;
  try {
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_settings')
      .maybeSingle();
    
    if (cfgRow?.value?.cookie_days) {
      cookieDays = Number(cfgRow.value.cookie_days) || 7;
    }
  } catch (_e) {
    // fallback padrão de 7 dias
  }

  // 3. Salvar cookie affiliate_ref=CODIGO
  const cookieStore = await cookies();
  cookieStore.set('affiliate_ref', code, {
    maxAge: cookieDays * 24 * 60 * 60,
    path: '/',
    httpOnly: false, // Disponível para JS no cliente para o momento do cadastro
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return (
    <WelcomeClient 
      partnerName={affiliate.name}
      referralCode={code}
    />
  );
}
