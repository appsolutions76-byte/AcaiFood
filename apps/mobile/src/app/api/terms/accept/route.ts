import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { CURRENT_TERMS_VERSION, LEGAL_DOCUMENTS } from '@/lib/legalVersions';

export const dynamic = 'force-dynamic';

// Registra o aceite dos textos legais (cl. 8.2.4 do contrato BaaS).
// A versão é SEMPRE a vigente no servidor; a enviada pelo navegador é ignorada.
export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { document, documents } = body || {};
    const userId = auth.user?.id || auth.profile?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const rawList: any[] = Array.isArray(documents) ? documents : (document ? [document] : []);
    const docNames = Array.from(new Set(
      rawList.map((item: any) => String(typeof item === 'string' ? item : item?.document || '').trim())
    )).filter(Boolean);

    if (docNames.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento especificado para aceite' }, { status: 400 });
    }

    for (const docName of docNames) {
      if (!(LEGAL_DOCUMENTS as readonly string[]).includes(docName)) {
        return NextResponse.json({ error: `Documento inválido: ${docName}` }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    // Evita linhas duplicadas para a mesma versão
    const { data: existing } = await supabase
      .from('terms_acceptances')
      .select('document')
      .eq('user_id', userId)
      .eq('version', CURRENT_TERMS_VERSION)
      .in('document', docNames);

    const already = new Set((existing || []).map((r: any) => r.document));
    const nowIso = new Date().toISOString();
    const recordsToInsert = docNames
      .filter(d => !already.has(d))
      .map(d => ({
        user_id: userId,
        document: d,
        version: CURRENT_TERMS_VERSION,
        accepted_at: nowIso,
        ip,
        user_agent: userAgent
      }));

    if (recordsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('terms_acceptances')
        .insert(recordsToInsert);

      if (insertErr) {
        console.error('[Terms Acceptance] Erro ao gravar aceite:', insertErr.message);
        return NextResponse.json({ error: 'Erro ao registrar aceite de termos' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      version: CURRENT_TERMS_VERSION,
      registeredCount: recordsToInsert.length,
      timestamp: nowIso
    });

  } catch (error: any) {
    console.error('[Terms Acceptance] Erro fatal:', error?.message);
    return NextResponse.json({ error: 'Erro interno ao registrar aceite' }, { status: 500 });
  }
}
