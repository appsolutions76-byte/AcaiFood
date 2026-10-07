import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { saveAccountStatus } from '@/lib/asaasAccountStatus';

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
      .select('id, asaas_account_id, asaas_wallet_id, asaas_account_status, split_enabled')
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

    // Buscar API key da subconta na tabela protegida partner_secrets
    const { data: secretRow } = await supabase
      .from('partner_secrets')
      .select('asaas_account_api_key')
      .eq('user_id', targetUserId)
      .maybeSingle();

    const apiKey = secretRow?.asaas_account_api_key;
    const mainApiKey = await getAsaasApiKey();
    const ASAAS_URL = getAsaasBaseUrl(apiKey || mainApiKey);

    let documents: any[] = [];
    let onboardingUrl: string | null = null;
    let accountStatus: any = null;

    if (apiKey) {
      try {
        const docRes = await fetch(`${ASAAS_URL}/myAccount/documents`, {
          headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
        });
        if (docRes.ok) {
          const docData = await docRes.json();
          documents = Array.isArray(docData?.data) ? docData.data : [];

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
    }

    let effectiveStatus = user.asaas_account_status || 'PENDING_DOCUMENTS';
    if (accountStatus && accountStatus.general) {
      // Aprovação só com general === 'APPROVED' (etapas parciais não aprovam a conta)
      const saved = await saveAccountStatus(targetUserId, accountStatus, 'documents:get');
      if (saved.status) effectiveStatus = saved.status;
    }

    return NextResponse.json({
      success: true,
      hasAccount: true,
      status: effectiveStatus,
      splitEnabled: Boolean(user.split_enabled || effectiveStatus === 'APPROVED'),
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
    const docType = (formData.get('type') as string) || 'IDENTIFICATION';
    const file = (formData.get('documentFile') as Blob) || (formData.get('file') as Blob | null);

    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    const callerId = auth.user?.id || auth.profile?.id;
    if (!isAdmin && callerId !== targetUserId) {
      return NextResponse.json({ error: 'Você só pode enviar documentos para sua própria conta.' }, { status: 403 });
    }

    if (!documentId || !file) {
      return NextResponse.json({ error: 'documentId e arquivo (documentFile) são obrigatórios' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo excede o tamanho máximo de 10 MB' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: secretRow } = await supabase
      .from('partner_secrets')
      .select('asaas_account_api_key')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!secretRow?.asaas_account_api_key) {
      return NextResponse.json({ error: 'Chave de API da subconta indisponível na tabela de segredos' }, { status: 400 });
    }

    const ASAAS_URL = getAsaasBaseUrl(secretRow.asaas_account_api_key);

    const asaasFormData = new FormData();
    asaasFormData.append('documentFile', file);
    asaasFormData.append('type', docType);

    const uploadRes = await fetch(`${ASAAS_URL}/myAccount/documents/${documentId}`, {
      method: 'POST',
      headers: {
        'access_token': secretRow.asaas_account_api_key
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
