import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { document, version, documents } = body;
    const userId = auth.user?.id || auth.profile?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'App Client';

    const supabase = getSupabaseAdmin();

    const allowedDocs = [
      'acaifood_terms', 'acaifood_privacy', 'asaas_terms',
      'asaas_privacy', 'subaccount_mandate', 'pix_random_key_consent'
    ];

    const recordsToInsert: any[] = [];
    const docList = Array.isArray(documents) ? documents : (document ? [{ document, version: version || '2026-10-02' }] : []);

    if (docList.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento especificado para aceite' }, { status: 400 });
    }

    for (const item of docList) {
      const docName = String(item.document || item).trim();
      const docVer = String(item.version || version || '2026-10-02').trim();

      if (!allowedDocs.includes(docName)) {
        return NextResponse.json({ error: `Documento inválido: ${docName}` }, { status: 400 });
      }

      recordsToInsert.push({
        user_id: userId,
        document: docName,
        version: docVer,
        accepted_at: new Date().toISOString(),
        ip,
        user_agent: userAgent
      });
    }

    const { error: insertErr } = await supabase
      .from('terms_acceptances')
      .insert(recordsToInsert);

    if (insertErr) {
      console.error("[Terms Acceptance] Erro ao gravar aceite:", insertErr);
      return NextResponse.json({ error: 'Erro ao registrar aceite de termos' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      registeredCount: recordsToInsert.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[Terms Acceptance] Erro fatal:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
