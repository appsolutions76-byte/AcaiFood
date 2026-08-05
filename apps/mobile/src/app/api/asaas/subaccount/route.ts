import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

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
      bairro,
      cidade
    } = body;

    if (!userId || !name || !email || !cpfCnpj) {
      return NextResponse.json(
        { error: 'userId, name, email e cpfCnpj são obrigatórios' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no ambiente' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    // Limpar e formatar dados
    const cleanCpfCnpj = String(cpfCnpj).replace(/\D/g, '');
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const isCpf = cleanCpfCnpj.length === 11;

    // Se já tiver subconta criada no Asaas, tenta buscar primeiro por CPF/CNPJ
    const accountSearchRes = await fetch(`${ASAAS_URL}/accounts?cpfCnpj=${cleanCpfCnpj}`, {
      headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
    });
    const searchData = await accountSearchRes.json();

    let walletId = '';
    let accountId = '';

    if (searchData && searchData.data && searchData.data.length > 0) {
      walletId = searchData.data[0].walletId;
      accountId = searchData.data[0].id;
    }

    if (!walletId) {
      const addressMatch = (endereco || '').match(/,?\s*(\d+[^\s,]*)/);
      const addressNumber = addressMatch ? addressMatch[1] : 'S/N';
      const addressStreet = (endereco || '').replace(/,?\s*\d+[^\s,]*/, '').trim() || endereco || 'Centro';

      const accountPayload: any = {
        name: name,
        email: email,
        cpfCnpj: cleanCpfCnpj,
        companyType: !isCpf ? 'MEI' : undefined,
        phone: cleanPhone || undefined,
        mobilePhone: cleanPhone || undefined,
        address: addressStreet,
        addressNumber: addressNumber,
        province: bairro || 'Centro',
        city: cidade || 'Belém',
        state: 'PA',
        country: 'Brasil',
        postalCode: '66015000',
        birthDate: isCpf ? '1990-01-01' : undefined,
        incomeValue: isCpf ? 3000 : undefined,
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
    }

    // Salva no banco de dados Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && supabaseKey && userId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('users')
        .update({
          asaas_wallet_id: walletId,
          asaas_account_id: accountId,
          asaas_account_status: 'APPROVED',
          split_enabled: true,
          pix_key: walletId
        })
        .eq('id', userId);
    }

    return NextResponse.json({
      success: true,
      walletId,
      accountId,
      isSandbox
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

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no ambiente' }, { status: 400 });
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    let accountId = accountIdParam || '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (userId && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: user } = await supabase
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

    if (userId && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('users')
        .update({
          asaas_wallet_id: null,
          asaas_account_id: null,
          split_enabled: false
        })
        .eq('id', userId);
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
