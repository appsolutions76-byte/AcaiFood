import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { pixKey, value, description, orderId, scheduleDate } = body;

    if (!pixKey || !value || value <= 0) {
      return NextResponse.json(
        { error: 'Chave Pix e Valor positivo são obrigatórios para a transferência' },
        { status: 400 }
      );
    }

    // Se a chamada veio de um usuário comum (não-admin e não-internal), exige validação estrita de pedido concluído
    const isAdminOrInternal = auth.source === 'internal_secret' || auth.profile?.role === 'ADMIN' || auth.profile?.role === 'admin';
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
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    // Limpa a chave Pix ou WalletId
    const cleanPixKey = String(pixKey).trim();
    const cleanDigits = cleanPixKey.replace(/\D/g, '');

    const isWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanPixKey) || (cleanPixKey.length >= 20 && !cleanPixKey.match(/^\d+$/));

    const transferBody: any = {
      value: Number(value.toFixed(2)),
      description: description || `Repasse AçaíFood #${String(orderId || '').substring(0, 8)}`
    };

    if (scheduleDate) {
      transferBody.scheduleDate = String(scheduleDate).trim();
    }

    if (isWalletId) {
      transferBody.walletId = cleanPixKey;
    } else {
      if (cleanDigits.length === 11) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CPF';
      } else if (cleanDigits.length === 14) {
        transferBody.pixAddressKey = cleanDigits;
        transferBody.pixAddressKeyType = 'CNPJ';
      } else if (cleanPixKey.includes('@')) {
        transferBody.pixAddressKey = cleanPixKey.toLowerCase();
        transferBody.pixAddressKeyType = 'EMAIL';
      } else if (cleanDigits.length >= 10 && cleanDigits.length <= 11) {
        transferBody.pixAddressKey = cleanPixKey.startsWith('+') ? cleanPixKey : `+55${cleanDigits}`;
        transferBody.pixAddressKeyType = 'PHONE';
      } else {
        transferBody.pixAddressKey = cleanPixKey;
        transferBody.pixAddressKeyType = 'EVP';
      }
    }

    console.log(`Iniciando transferência Pix no Asaas (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}):`, transferBody);

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
      console.error("Resposta não-JSON do Asaas:", resText);
      return NextResponse.json(
        { error: `Status ${res.status}: ${resText || 'Sem resposta do Asaas'}` },
        { status: 400 }
      );
    }

    if (!res.ok || data.errors) {
      const msg = data.errors
        ? data.errors.map((e: any) => e.description).join(', ')
        : (data.message || JSON.stringify(data));
      console.warn("Alerta ao realizar transferência Pix Asaas:", msg);
      return NextResponse.json({ error: `Transferência Pix Asaas: ${msg}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transferId: data.id,
      status: data.status,
      value: data.value
    });

  } catch (error: any) {
    console.error("Erro na API de Transferência Pix do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar transferência Asaas' },
      { status: 500 }
    );
  }
}
