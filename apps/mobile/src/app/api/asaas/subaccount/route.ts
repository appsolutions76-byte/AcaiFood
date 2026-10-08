import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { CURRENT_TERMS_VERSION, SUBACCOUNT_REQUIRED_DOCS } from '@/lib/legalVersions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { loadSubaccountUser, countOpenWithdrawals, closeSubaccountInAsaas, unlinkSubaccount } from '@/lib/asaasSubaccountClose';

export const dynamic = 'force-dynamic';

// Eventos de situação da conta (docs.asaas.com → "Eventos para verificar situação da conta")
const ACCOUNT_STATUS_EVENTS = [
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
  'ACCOUNT_STATUS_DOCUMENT_APPROVED',
  'ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_DOCUMENT_PENDING',
  'ACCOUNT_STATUS_DOCUMENT_REJECTED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED'
];

function getAppBaseUrl(request: Request): string {
  const fromEnv = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return new URL(request.url).origin;
}

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

    // Celular obrigatório no POST /v3/accounts (DDD + número)
    const mobileDigits = cleanPhone.startsWith('55') && cleanPhone.length >= 12 ? cleanPhone.slice(2) : cleanPhone;
    if (mobileDigits.length !== 10 && mobileDigits.length !== 11) {
      return NextResponse.json({ error: 'Celular com DDD é obrigatório para abrir a subconta (ex.: 91 98888-7777)' }, { status: 400 });
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

    // Endereço: nada de valores inventados (cl. 8.2.3). O Asaas exige rua, número,
    // bairro e CEP; cidade e UF são deduzidas do CEP pelo próprio Asaas.
    const rawStreet = String(endereco || '').trim();
    const addressMatch = rawStreet.match(/,?\s*(\d+[^\s,]*)/);
    const effectiveAddressNumber = String(addressNumber || (addressMatch ? addressMatch[1] : '') || '').trim();
    const addressStreet = rawStreet.replace(/,?\s*\d+[^\s,]*/, '').trim() || rawStreet;
    const effectiveProvince = String(bairro || '').trim();
    const userState = String(estado || uf || '').trim().toUpperCase();
    const missingAddress: string[] = [];
    if (!addressStreet) missingAddress.push('endereço (rua)');
    if (!effectiveAddressNumber) missingAddress.push('número');
    if (!effectiveProvince) missingAddress.push('bairro');
    if (missingAddress.length > 0) {
      return NextResponse.json({ error: `Dados de endereço obrigatórios para a subconta: ${missingAddress.join(', ')}` }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();

    const callerRole = String(auth.profile?.role || '').toUpperCase();
    const isAdmin = callerRole === 'ADMIN' || auth.profile?.role === 'admin';
    const callerId = auth.user?.id || auth.profile?.id;

    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode vincular uma subconta ao seu próprio perfil de usuário.' }, { status: 403 });
    }

    // 1. Aceites obrigatórios na versão vigente (cl. 8.2.4)
    const { data: acceptedTerms } = await supabase
      .from('terms_acceptances')
      .select('document')
      .eq('user_id', userId)
      .eq('version', CURRENT_TERMS_VERSION);

    const acceptedDocs = new Set((acceptedTerms || []).map((t: any) => t.document));
    const missingDocs = SUBACCOUNT_REQUIRED_DOCS.filter(d => !acceptedDocs.has(d));

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
      // A apiKey da subconta só é devolvida na criação. Subconta já existente:
      // só reaproveita se já for deste usuário e a chave estiver guardada.
      const found = searchData.data[0];
      const { data: currentUser } = await supabase
        .from('users')
        .select('asaas_account_id')
        .eq('id', userId)
        .maybeSingle();
      const { data: secretRow } = await supabase
        .from('partner_secrets')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (currentUser?.asaas_account_id === found.id && secretRow) {
        return NextResponse.json({
          success: true,
          walletId: found.walletId,
          accountId: found.id,
          status: 'EXISTING',
          isSandbox: ASAAS_URL.includes('sandbox')
        });
      }

      await supabase
        .from('users')
        .update({ asaas_account_status: 'NEEDS_ADMIN' })
        .eq('id', userId);

      return NextResponse.json({
        error: 'Já existe uma subconta Asaas com este CPF/CNPJ. Nossa equipe vai concluir a vinculação; fale com o suporte.',
        status: 'NEEDS_ADMIN'
      }, { status: 409 });
    }

    if (!walletId) {
      const accountPayload: any = {
        name: name,
        email: email,
        cpfCnpj: cleanCpfCnpj,
        companyType: effectiveCompanyType,
        mobilePhone: mobileDigits,
        address: addressStreet,
        addressNumber: effectiveAddressNumber,
        province: effectiveProvince,
        city: String(cidade || '').trim() || undefined,
        state: userState || undefined,
        postalCode: effectivePostalCode,
        birthDate: effectiveBirthDate,
        incomeValue: effectiveIncome,
      };

      // Webhook de situação da conta da subconta → /api/asaas/account-webhook
      const webhookToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
      const webhookEmail = (process.env.ASAAS_WEBHOOK_EMAIL || '').trim();
      if (webhookToken && webhookEmail) {
        accountPayload.webhooks = [{
          name: 'AcaiFood - situacao da conta',
          url: `${getAppBaseUrl(request)}/api/asaas/account-webhook`,
          email: webhookEmail,
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: webhookToken,
          sendType: 'SEQUENTIALLY',
          events: ACCOUNT_STATUS_EVENTS
        }];
      } else {
        console.warn('[Subaccount] ASAAS_WEBHOOK_TOKEN/ASAAS_WEBHOOK_EMAIL ausentes: webhook de situação da conta não cadastrado (o cron de reserva sincroniza o status).');
      }

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
          address_number: effectiveAddressNumber || undefined,
          province: effectiveProvince || undefined
        })
        .eq('id', userId);

      // A chave da subconta só vem nesta resposta: sem ela o app não consegue mostrar
      // os documentos (link do Asaas) nem consultar a aprovação. Falha aqui = admin.
      let keySaved = false;
      if (accountApiKey) {
        const { error: keyErr } = await supabase
          .from('partner_secrets')
          .upsert({
            user_id: userId,
            asaas_account_api_key: accountApiKey,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        keySaved = !keyErr;
        if (keyErr) console.error('[Subaccount] Falha ao guardar a chave da subconta:', keyErr.message);
      }
      if (!keySaved) {
        await supabase.from('users').update({ asaas_account_status: 'NEEDS_ADMIN' }).eq('id', userId);
        try {
          await supabase.from('admin_audit_log').insert({
            action: 'ASAAS_SUBACCOUNT_KEY_MISSING',
            target_type: 'USER',
            target_id: String(userId),
            after_state: { accountId, motivo: accountApiKey ? 'erro ao gravar a chave' : 'Asaas não devolveu apiKey' }
          });
        } catch (_e) {}
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
    console.error("Erro na API /api/asaas/subaccount:", error?.message);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao criar subconta Asaas' },
      { status: 500 }
    );
  }
}

// Encerramento de subconta (admin com MFA). Só remove o vínculo no banco quando o Asaas
// confirma o encerramento. Mesma regra da aba Conformidade (/api/admin/subaccounts).
export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '';
  const reason = (searchParams.get('reason') || 'Encerramento solicitado pelo administrador AçaíFood').slice(0, 200);
  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
  }

  const actorId = auth.user?.id || auth.profile?.id || null;
  const user = await loadSubaccountUser(userId);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  if (!user.asaas_account_id) {
    return NextResponse.json({ success: true, message: 'Usuário sem subconta vinculada.' });
  }

  if (await countOpenWithdrawals(userId) > 0) {
    return NextResponse.json({ error: 'Parceiro com saque em aberto. Conclua ou rejeite o saque antes de encerrar a subconta.' }, { status: 409 });
  }

  const before = { accountId: user.asaas_account_id, status: user.asaas_account_status };
  const result = await closeSubaccountInAsaas(user, reason);
  if (!result.ok) {
    await logAdminAction({
      actorId, action: 'ASAAS_SUBACCOUNT_CLOSE_REFUSED', targetType: 'USER', targetId: userId,
      beforeState: before, afterState: { mode: result.mode, error: result.error }, request
    });
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }

  const unlinked = await unlinkSubaccount(user);
  await logAdminAction({
    actorId, action: unlinked.ok ? 'ASAAS_SUBACCOUNT_CLOSED' : 'ASAAS_SUBACCOUNT_UNLINK_FAILED',
    targetType: 'USER', targetId: userId, beforeState: before,
    afterState: { mode: result.mode, unlinked: unlinked.ok, reason }, request
  });
  if (!unlinked.ok) {
    return NextResponse.json({ error: 'O Asaas encerrou a subconta, mas houve erro ao atualizar o banco. Use "Desvincular" na aba Conformidade.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, deletedAccountId: result.accountId });
}
