import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export const CURRENT_TERMS_VERSION = '2026-10-06';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const userId = auth.user?.id || auth.profile?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const userRole = String(userProfile?.role || 'CLIENT').toUpperCase();
    const isPartner = userRole !== 'CLIENT';

    // Documentos exigidos
    const requiredDocs = isPartner
      ? ['acaifood_terms', 'acaifood_privacy', 'asaas_terms', 'asaas_privacy', 'subaccount_mandate', 'pix_random_key_consent']
      : ['acaifood_terms', 'acaifood_privacy', 'asaas_terms', 'asaas_privacy'];

    const { data: acceptances } = await supabase
      .from('terms_acceptances')
      .select('document, version')
      .eq('user_id', userId);

    const acceptedMap = new Set((acceptances || []).map((a: any) => `${a.document}:${a.version}`));

    const missingDocs = requiredDocs.filter(doc => !acceptedMap.has(`${doc}:${CURRENT_TERMS_VERSION}`));

    return NextResponse.json({
      success: true,
      currentVersion: CURRENT_TERMS_VERSION,
      role: userRole,
      isPartner,
      allAccepted: missingDocs.length === 0,
      missingDocs,
      acceptedCount: (acceptances || []).length
    });

  } catch (error: any) {
    console.error('[Terms Status API] Erro ao verificar aceites:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
