import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const callerId = auth.user?.id || auth.profile?.id;
    const targetUserId = searchParams.get('userId') || callerId;

    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId !== targetUserId) {
      return NextResponse.json({ error: 'Você só pode consultar os documentos da sua própria conta.' }, { status: 403 });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('id, asaas_account_id, asaas_wallet_id, asaas_account_api_key, asaas_account_status, split_enabled')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!user || !user.asaas_account_id) {
      return NextResponse.json({
        success: true,
        hasAccount: false,
        status: 'NO_ACCOUNT',
        documents: [],
        onboardingUrl: null
      });
    }

    const apiKey = user.asaas_account_api_key;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        hasAccount: true,
        status: user.asaas_account_status || 'PENDING_DOCUMENTS',
        documents: [],
        onboardingUrl: null,
        message: 'Subconta vinculada, mas chave de API individual indisponível para consulta direta.'
      });
    }

    const ASAAS_URL = 'https://www.asaas.com/api/v3';

    // 1. Consultar lista de documentos exigidos pela subconta
    let documents: any[] = [];
    let onboardingUrl: string | null = null;
    let accountStatus: any = null;

    try {
      const docRes = await fetch(`${ASAAS_URL}/myAccount/documents`, {
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
      });
      if (docRes.ok) {
        const docData = await docRes.json();
        documents = Array.isArray(docData?.data) ? docData.data : [];

        // Procurar se algum documento ou resposta geral contém onboardingUrl
        for (const doc of documents) {
          if (doc?.onboardingUrl) {
            onboardingUrl = doc.onboardingUrl;
            break;
          }
        }
      }
    } catch (docErr) {
      console.warn("Aviso ao buscar documentos em /myAccount/documents:", docErr);
    }

    // 2. Consultar status detalhado da conta
    try {
      const statusRes = await fetch(`${ASAAS_URL}/myAccount/status`, {
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
      });
      if (statusRes.ok) {
        accountStatus = await statusRes.json();
        if (accountStatus?.onboardingUrl && !onboardingUrl) {
          onboardingUrl = accountStatus.onboardingUrl;
        }
      }
    } catch (stErr) {
      console.warn("Aviso ao buscar status em /myAccount/status:", stErr);
    }

    return NextResponse.json({
      success: true,
      hasAccount: true,
      status: user.asaas_account_status || 'PENDING_DOCUMENTS',
      splitEnabled: Boolean(user.split_enabled),
      documents,
      onboardingUrl,
      accountStatus
    });

  } catch (error: any) {
    console.error("Erro na API GET /api/asaas/documents:", error);
    return NextResponse.json({ error: error.message || 'Erro ao consultar documentos da subconta' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const formData = await request.formData();
    const targetUserId = (formData.get('userId') as string) || auth.user?.id || auth.profile?.id;
    const documentId = formData.get('documentId') as string;
    const file = formData.get('file') as Blob | null;

    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    const callerId = auth.user?.id || auth.profile?.id;
    if (!isAdmin && callerId !== targetUserId) {
      return NextResponse.json({ error: 'Você só pode enviar documentos para sua própria conta.' }, { status: 403 });
    }

    if (!documentId || !file) {
      return NextResponse.json({ error: 'documentId e arquivo são obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('asaas_account_api_key')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!user?.asaas_account_api_key) {
      return NextResponse.json({ error: 'Chave de API da subconta indisponível' }, { status: 400 });
    }

    const ASAAS_URL = 'https://www.asaas.com/api/v3';

    // Repassar o upload multipart para a API do Asaas
    const asaasFormData = new FormData();
    asaasFormData.append('file', file);

    const uploadRes = await fetch(`${ASAAS_URL}/myAccount/documents/${documentId}`, {
      method: 'POST',
      headers: {
        'access_token': user.asaas_account_api_key
      },
      body: asaasFormData
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      const errMsg = uploadData.errors
        ? uploadData.errors.map((e: any) => e.description).join(', ')
        : (uploadData.message || 'Erro no envio do documento');
      return NextResponse.json({ error: `Erro Asaas: ${errMsg}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result: uploadData
    });

  } catch (error: any) {
    console.error("Erro na API POST /api/asaas/documents:", error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar documento' }, { status: 500 });
  }
}
