import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { calculateSellerPayout, calculateDriverPayout } from '@/lib/payoutCalc';

export async function POST(request: Request) {
  // Transferências financeiras ativas são permitidas para admin ou parceiros operacionais (loja, fornecedor, motorista)
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista']);
  if (!auth.authorized) {
    console.warn("Acesso negado em /api/asaas/transfer:", auth.error);
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { pixKey, description, orderId, scheduleDate, isWalletId, walletId } = body;

    const role = String(auth.profile?.role || auth.user?.user_metadata?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrador' || auth.source === 'internal_secret';

    if (!pixKey && !walletId) {
      return NextResponse.json(
        { error: 'Chave Pix ou WalletId é obrigatório para a transferência' },
        { status: 400 }
      );
    }

    // P1.1 — Se não houver orderId (saque avulso), desativar temporariamente até P2.1 (ledger de saldo)
    if (!orderId && !isAdmin) {
      return NextResponse.json(
        { error: 'Saque avulso temporariamente indisponível — use o saque vinculado ao pedido.' },
        { status: 400 }
      );
    }

    if (!orderId && isAdmin) {
      if (!body.value || Number(body.value) <= 0) {
        return NextResponse.json({ error: 'O valor da transferência para admin deve ser maior que zero' }, { status: 400 });
      }
    }

    let transferValue = 0;

    // Se houver orderId, recalcula o valor devido no SERVIDOR e valida status
    if (orderId) {
      const supabase = getSupabaseAdmin();
      const { data: dbOrder, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (ordErr || !dbOrder) {
        return NextResponse.json({ error: 'Pedido não encontrado para transferência' }, { status: 404 });
      }

      const isDriverRole = role === 'motorista' || role === 'courier' || role === 'motoboy' || role === 'caminhao' || role === 'driver';

      if (isDriverRole && dbOrder.payout_driver_done) {
        return NextResponse.json(
          { error: 'Este frete já foi liquidado e transferido via PIX anteriormente.' },
          { status: 400 }
        );
      }
      if (!isDriverRole && dbOrder.payout_seller_done) {
        return NextResponse.json(
          { error: 'Este repasse de venda já foi liquidado e transferido via PIX anteriormente.' },
          { status: 400 }
        );
      }

      // Buscar configurações da plataforma e storefront para recalcular repasse líquido
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (isDriverRole) {
        transferValue = calculateDriverPayout(dbOrder, settings);
      } else {
        let freteSubsidyPct = 0;
        if (dbOrder.seller_storefront_id) {
          const { data: sf } = await supabase
            .from('storefronts')
            .select('frete_subsidy_pct')
            .eq('id', dbOrder.seller_storefront_id)
            .maybeSingle();
          if (sf) freteSubsidyPct = Number(sf.frete_subsidy_pct || 0);
        }
        transferValue = calculateSellerPayout(dbOrder, freteSubsidyPct, settings);
      }

      if (transferValue <= 0) {
        return NextResponse.json(
          { error: 'O valor calculado para este repasse é zero ou negativo' },
          { status: 400 }
        );
      }
    } else {
      transferValue = Number(body.value);
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
      value: Number(transferValue.toFixed(2)),
      description: description || `Repasse AçaíFood #${String(orderId || '').substring(0, 8)}`
    };

    if (scheduleDate) {
      transferBody.scheduleDate = String(scheduleDate).trim();
    }

    if (isWalletId || !!walletId) {
      transferBody.walletId = targetKey;
    } else {
      if (targetKey.includes('@')) {
        transferBody.pixAddressKey = targetKey.toLowerCase();
        transferBody.pixAddressKeyType = 'EMAIL';
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetKey)) {
        transferBody.pixAddressKey = targetKey.toLowerCase();
        transferBody.pixAddressKeyType = 'EVP';
      } else if (cleanDigits.length === 14) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CNPJ';
      } else if (targetKey.startsWith('+') || /^\(\d{2}\)/.test(targetKey) || (cleanDigits.length >= 10 && cleanDigits.length <= 11 && (targetKey.includes('(') || targetKey.includes('-') || targetKey.includes(' ')))) {
        const phoneFormatted = cleanDigits.startsWith('55') && cleanDigits.length >= 12 ? `+${cleanDigits}` : `+55${cleanDigits}`;
        transferBody.pixAddressKey = phoneFormatted;
        transferBody.pixAddressKeyType = 'PHONE';
      } else if (cleanDigits.length === 11) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CPF';
      } else if (cleanDigits.length === 10 || cleanDigits.length === 12 || cleanDigits.length === 13) {
        const phoneFormatted = cleanDigits.startsWith('55') ? `+${cleanDigits}` : `+55${cleanDigits}`;
        transferBody.pixAddressKey = phoneFormatted;
        transferBody.pixAddressKeyType = 'PHONE';
      } else {
        transferBody.pixAddressKey = targetKey;
        transferBody.pixAddressKeyType = 'EVP';
      }
    }

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

    // Se houver orderId, marca a flag de repasse no banco de dados via Service Role
    if (orderId) {
      try {
        const supabase = getSupabaseAdmin();
        const updatePayload: any = {};
        const isDriverRole = role === 'motorista' || role === 'courier' || role === 'motoboy' || role === 'caminhao' || role === 'driver';
        if (isDriverRole) {
          updatePayload.payout_driver_done = true;
        } else {
          updatePayload.payout_seller_done = true;
        }
        await supabase.from('orders').update(updatePayload).eq('id', orderId);
      } catch (upErr) {
        console.warn("[API Asaas] Aviso ao atualizar payout_done no pedido:", upErr);
      }
    }

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

