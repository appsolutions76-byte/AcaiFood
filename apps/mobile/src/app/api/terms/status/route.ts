import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { CURRENT_TERMS_VERSION, CLIENT_REQUIRED_DOCS, PARTNER_REQUIRED_DOCS, isPartnerDbRole } from '@/lib/legalVersions';

export const dynamic = 'force-dynamic';

// Diz quais textos legais o usuário logado ainda precisa aceitar na versão vigente.
// Obs.: arquivos route.ts do Next só podem exportar handlers e configs de rota;
// a constante de versão fica em '@/lib/legalVersions'.
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
    const isPartner = isPartnerDbRole(userRole);
    const requiredDocs = isPartner ? PARTNER_REQUIRED_DOCS : CLIENT_REQUIRED_DOCS;

    const { data: acceptances } = await supabase
      .from('terms_acceptances')
      .select('document')
      .eq('user_id', userId)
      .eq('version', CURRENT_TERMS_VERSION);

    const accepted = new Set((acceptances || []).map((a: any) => a.document));
    const missingDocs = requiredDocs.filter(doc => !accepted.has(doc));

    return NextResponse.json({
      success: true,
      currentVersion: CURRENT_TERMS_VERSION,
      role: userRole,
      isPartner,
      allAccepted: missingDocs.length === 0,
      missingDocs
    });

  } catch (error: any) {
    console.error('[Terms Status API] Erro ao verificar aceites:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
