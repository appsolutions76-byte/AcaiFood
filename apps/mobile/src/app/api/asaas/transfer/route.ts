import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) {
    console.warn("Acesso negado em /api/asaas/transfer:", auth.error);
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { pixKey, value, description, orderId, scheduleDate, isWalletId, walletId } = body;

    if (!pixKey && !walletId) {
      return NextResponse.json(
        { error: 'Chave Pix ou WalletId é obrigatório para a transferência' },
        { status: 400 }
      );
    }

    if (!value || Number(value) <= 0) {
      return NextResponse.json(
        { error: 'O valor da transferência deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Se a chamada veio de um usuário comum (não-admin e não-internal), exige validação de pedido concluído
    const isAdminOrInternal = auth.source === 'internal_secret' || 
                              auth.source === 'webhook_secret' || 
                              auth.profile?.role === 'ADMIN' || 
                              auth.profile?.role === 'admin' ||
                              String(auth.user?.user_metadata?.role || '').toLowerCase() === 'admin';

    if (!isAdminOrInternal) {
      if (!orderId) {
        return NextResponse.json(
          { error: 'Acesso negado: Transferências diretas só podem ser disparadas vinculadas a um pedido concluído.' },
          { status: 403 }
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = getSupabaseAdmin();
        const { data: dbOrder } = await supabase
          .from('orders')
          .select('id, status, buyer_id, driver_id, seller_storefront_id')
          .eq('id', orderId)
          .maybeSingle();

        if (!dbOrder) {
          return NextResponse.json({ error: 'Pedido informado não encontrado.' }, { status: 404 });
        }

        const validStatuses = ['RECEIVED', 'COMPLETED'];
        if (!validStatuses.includes(dbOrder.status)) {
          return NextResponse.json({ error: 'Transferência não permitida: O pedido ainda não foi concluído com PIN de 4 dígitos.' }, { status: 400 });
        }
      }
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'Chave de API do Asaas (ASAAS_API_KEY) não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    const targetKey = String(walletId || pixKey).trim();
    const cleanDigits = targetKey.replace(/\D/g, '');

    const transferBody: any = {
      value: Number(Number(value).toFixed(2)),
      description: description || `Repasse AçaíFood #${String(orderId || '').substring(0, 8)}`
    };

    if (scheduleDate) {
      transferBody.scheduleDate = String(scheduleDate).trim();
    }

    // Se for explicitamente informado como subconta Asaas (walletId)
    if (isWalletId || !!walletId) {
      transferBody.walletId = targetKey;
    } else {
      // É Chave Pix do Banco Central
      if (cleanDigits.length === 11 && !targetKey.includes('@') && !targetKey.includes('-')) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CPF';
      } else if (cleanDigits.length === 14 && !targetKey.includes('@')) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CNPJ';
      } else if (targetKey.includes('@')) {
        transferBody.pixAddressKey = targetKey.toLowerCase();
        transferBody.pixAddressKeyType = 'EMAIL';
      } else if (cleanDigits.length >= 10 && cleanDigits.length <= 13 && (targetKey.startsWith('+') || targetKey.startsWith('(') || /^\d+$/.test(targetKey))) {
        transferBody.pixAddressKey = targetKey.startsWith('+') ? targetKey : `+55${cleanDigits}`;
        transferBody.pixAddressKeyType = 'PHONE';
      } else {
        // Chave Aleatória EVP
        transferBody.pixAddressKey = targetKey;
        transferBody.pixAddressKeyType = 'EVP';
      }
    }

    console.log(`[API Asaas] Disparando transferência para ${ASAAS_URL}/transfers:`, JSON.stringify(transferBody));

    const res = await fetch(`${ASAAS_URL}/transfers`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transferBody)
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch (_e) {
      console.error("[API Asaas] Resposta não-JSON do Asaas:", resText);
      return NextResponse.json(
        { error: `Status ${res.status}: ${resText || 'Sem resposta do Asaas'}` },
        { status: 400 }
      );
    }

    if (!res.ok || data.errors) {
      const msg = data.errors
        ? data.errors.map((e: any) => e.description || e.code).join(', ')
        : (data.message || JSON.stringify(data));
      console.warn("[API Asaas] Erro retornado pelo Asaas:", msg);
      return NextResponse.json({ error: `Asaas recusou transferência: ${msg}` }, { status: 400 });
    }

    console.log(`[API Asaas] Transferência Pix autorizada com sucesso! ID: ${data.id}`);

    return NextResponse.json({
      success: true,
      transferId: data.id,
      status: data.status,
      value: data.value
    });

  } catch (error: any) {
    console.error("Erro interno ao processar transferência Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar transferência Asaas' },
      { status: 500 }
    );
  }
}
