import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { getFounderQuotaStatus } from '@/lib/founderQuota';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const {
      userId,
      name,
      email,
      cpfCnpj,
      phone,
      endereco,
      addressNumber,
      bairro,
      cidade,
      estado,
      uf,
      cep,
      postalCode,
      birthDate,
      monthlyIncome,
      incomeValue,
      companyType
    } = body;

    if (!userId || !name || !email || !cpfCnpj) {
      return NextResponse.json(
        { error: 'userId, name, email e cpfCnpj são obrigatórios' },
        { status: 400 }
      );
    }

    const cleanCpfCnpj = String(cpfCnpj).replace(/\D/g, '');
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const isCpf = cleanCpfCnpj.length === 11;
    const isCnpj = cleanCpfCnpj.length === 14;

    if (!isCpf && !isCnpj) {
      return NextResponse.json({ error: 'CPF deve conter 11 dígitos ou CNPJ 14 dígitos válidos' }, { status: 400 });
    }

    const effectivePostalCode = String(postalCode || cep || '').replace(/\D/g, '');
    if (!effectivePostalCode || effectivePostalCode.length !== 8) {
      return NextResponse.json({ error: 'CEP válido com 8 dígitos é obrigatório para abertura da subconta bancária' }, { status: 400 });
    }

    let effectiveBirthDate: string | undefined = undefined;
    let effectiveIncome: number = Number(incomeValue || monthlyIncome || 0);
    let effectiveCompanyType: string | undefined = undefined;

    if (effectiveIncome <= 0 || isNaN(effectiveIncome)) {
      return NextResponse.json({ error: 'Renda/Faturamento mensal declarado é obrigatório para conformidade bancária (Asaas BaaS)' }, { status: 400 });
    }

    if (isCpf) {
      if (!birthDate || !String(birthDate).match(/^\d{4}-\d{2}-\d{2}$/)) {
        return NextResponse.json({ error: 'Data de nascimento real (AAAA-MM-DD) é obrigatória para cadastro com CPF' }, { status: 400 });
      }
      const bDate = new Date(birthDate);
      const ageYears = (Date.now() - bDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (isNaN(ageYears) || ageYears < 18 || ageYears > 120) {
        return NextResponse.json({ error: 'Titular da subconta deve possuir no mínimo 18 anos completos' }, { status: 400 });
      }
      effectiveBirthDate = birthDate;
    } else {
      const allowedCompanyTypes = ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'];
      const cType = String(companyType || '').toUpperCase().trim();
      if (!allowedCompanyTypes.includes(cType)) {
        return NextResponse.json({ error: `Tipo societário inválido para CNPJ. Escolha entre: ${allowedCompanyTypes.join(', ')}` }, { status: 400 });
      }
      effectiveCompanyType = cType;
    }

    const userState = String(estado || uf || 'PA').trim().toUpperCase();
    const supabase = getSupabaseAdmin();

    const callerRole = String(auth.profile?.role || '').toUpperCase();
    const isAdmin = callerRole === 'ADMIN' || auth.profile?.role === 'admin';
    const callerId = auth.user?.id || auth.profile?.id;

    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode vincular uma subconta ao seu próprio perfil de usuário.' }, { status: 403 });
    }

    // 1. Checagem obrigatória dos termos Asaas na versão atual (2026-10-06)
    const { data: acceptedTerms } = await supabase
      .from('terms_acceptances')
      .select('document, version')
      .eq('user_id', userId);

    const acceptedDocs = new Set((acceptedTerms || []).map((t: any) => `${t.document}:${t.version}`));
    const requiredDocs = ['asaas_terms:2026-10-06', 'subaccount_mandate:2026-10-06', 'pix_random_key_consent:2026-10-06'];
    const missingDocs = requiredDocs.filter(d => !acceptedDocs.has(d));

    if (missingDocs.length > 0) {
      return NextResponse.json(
        { 
          error: `Aceites regulatórios Asaas pendentes na versão atual (${missingDocs.join(', ')}). É obrigatório aceitar os Termos do Asaas, o Mandato de Subconta e o Consentimento de Chave Pix para abrir a subconta bancária.` 
        }, 
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no ambiente' },
        { status: 500 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    // Buscar por subconta existente por CPF/CNPJ
    const accountSearchRes = await fetch(`${ASAAS_URL}/accounts?cpfCnpj=${cleanCpfCnpj}`, {
      headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
    });
    const searchData = await accountSearchRes.json();

    let walletId = '';
    let accountId = '';
    let accountApiKey = '';

    if (searchData && searchData.data && searchData.data.length > 0) {
      walletId = searchData.data[0].walletId;
      accountId = searchData.data[0].id;
      accountApiKey = searchData.data[0].apiKey || '';
    }

    if (!walletId) {
      const addressMatch = (endereco || '').match(/,?\s*(\d+[^\s,]*)/);
      const effectiveAddressNumber = addressNumber || (addressMatch ? addressMatch[1] : 'S/N');
      const addressStreet = (endereco || '').replace(/,?\s*\d+[^\s,]*/, '').trim() || endereco || 'Centro';

      const accountPayload: any = {
        name: name,
        email: email,
        cpfCnpj: cleanCpfCnpj,
        companyType: effectiveCompanyType,
        phone: cleanPhone || undefined,
        mobilePhone: cleanPhone || undefined,
        address: addressStreet,
        addressNumber: effectiveAddressNumber,
        province: bairro || 'Centro',
        city: cidade || 'Belém',
        state: userState || 'PA',
        country: 'Brasil',
        postalCode: effectivePostalCode,
        birthDate: effectiveBirthDate,
        incomeValue: effectiveIncome,
      };

      Object.keys(accountPayload).forEach(k => {
        if (accountPayload[k] === undefined) delete accountPayload[k];
      });

      const createRes = await fetch(`${ASAAS_URL}/accounts`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountPayload)
      });

      const accountData = await createRes.json();
      if (!accountData.walletId && !accountData.id) {
        const errMsg = accountData.errors
          ? accountData.errors.map((e: any) => e.description).join(', ')
          : (accountData.message || JSON.stringify(accountData));
        return NextResponse.json({ error: `Falha Asaas Subconta: ${errMsg}` }, { status: 400 });
      }

      walletId = accountData.walletId;
      accountId = accountData.id;
      accountApiKey = accountData.apiKey || '';
    }

    // Gravação segura no Supabase
    if (userId) {
      await supabase
        .from('users')
        .update({
          asaas_wallet_id: walletId,
          asaas_account_id: accountId,
          asaas_account_status: 'PENDING_DOCUMENTS',
          split_enabled: false, // split_enabled nasce FALSE até o status virar APPROVED via Webhook
          birth_date: effectiveBirthDate || undefined,
          monthly_income: effectiveIncome || undefined,
          company_type: effectiveCompanyType || undefined,
          postal_code: effectivePostalCode || undefined,
          address_number: addressNumber || undefined,
          province: bairro || undefined
        })
        .eq('id', userId);

      if (accountApiKey) {
        await supabase
          .from('partner_secrets')
          .upsert({
            user_id: userId,
            asaas_account_api_key: accountApiKey,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    }

    return NextResponse.json({
      success: true,
      walletId,
      accountId,
      status: 'PENDING_DOCUMENTS',
      splitEnabled: false,
      isSandbox: ASAAS_URL.includes('sandbox')
    });

  } catch (error: any) {
    console.error("Erro na API /api/asaas/subaccount:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao criar subconta Asaas' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const accountIdParam = searchParams.get('accountId');

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no ambiente' }, { status: 500 });
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);
    let accountId = accountIdParam || '';

    const supabaseAdmin = getSupabaseAdmin();

    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('asaas_account_id, asaas_wallet_id, cpf_cnpj')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        if (!accountId && user.asaas_account_id) {
          accountId = user.asaas_account_id;
        }

        if (!accountId && user.cpf_cnpj) {
          const cleanCpfCnpj = String(user.cpf_cnpj).replace(/\D/g, '');
          if (cleanCpfCnpj) {
            const searchRes = await fetch(`${ASAAS_URL}/accounts?cpfCnpj=${cleanCpfCnpj}`, {
              headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
            });
            const searchData = await searchRes.json();
            if (searchData && searchData.data && searchData.data.length > 0) {
              accountId = searchData.data[0].id;
            }
          }
        }
      }
    }

    let asaasResult: any = null;
    if (accountId) {
      console.log(`Excluindo subconta Asaas ${accountId}...`);
      const deleteRes = await fetch(`${ASAAS_URL}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      asaasResult = await deleteRes.json();
    }

    if (userId) {
      await supabaseAdmin
        .from('users')
        .update({
          asaas_wallet_id: null,
          asaas_account_id: null,
          split_enabled: false
        })
        .eq('id', userId);

      await supabaseAdmin
        .from('partner_secrets')
        .delete()
        .eq('user_id', userId);
    }

    return NextResponse.json({
      success: true,
      deletedAccountId: accountId,
      asaasResult
    });

  } catch (error: any) {
    console.error("Erro na API DELETE /api/asaas/subaccount:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao excluir subconta Asaas' },
      { status: 500 }
    );
  }
}
