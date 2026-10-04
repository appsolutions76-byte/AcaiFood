import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { validateAndFormatPixKey } from '@/lib/asaasTransferHelpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json(
        { error: auth.error || 'Acesso não autorizado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pixKey, walletId, value, description, orderId, partnerId, role } = body;

    let transferValue = Number(value);
    if (!transferValue || transferValue <= 0 || isNaN(transferValue)) {
      return NextResponse.json(
        { error: 'Valor da transferência inválido ou não informado.' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'Chave de API do Asaas (ASAAS_API_KEY) não configurada no servidor.' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);
    const isSandbox = ASAAS_URL.includes('sandbox');
    const keySuffix = ASAAS_API_KEY.length >= 4 ? ASAAS_API_KEY.slice(-4) : 'none';
    console.log(`[Transfer API] Transferência admin | Ambiente: ${isSandbox ? 'Sandbox' : 'Produção'} | Chave: ***${keySuffix} | Valor: R$ ${transferValue.toFixed(2)}`);

    const rawPixKey = String(pixKey || '').trim();
    const rawWalletId = String(walletId || '').trim();

    if (!rawPixKey && !rawWalletId) {
      return NextResponse.json(
        { error: 'Chave Pix ou WalletId de destino não informada.' },
        { status: 400 }
      );
    }

    const transferBody: any = {
      value: Number(transferValue.toFixed(2)),
      description: description || `Repasse AçaíFood Pix`
    };

    // 1. Se houver Chave Pix informada, priorizar transferência Pix direta
    if (rawPixKey) {
      const valResult = validateAndFormatPixKey(rawPixKey, body.pixKeyType || body.pixAddressKeyType);
      if (!valResult.valid || !valResult.formattedKey || !valResult.type) {
        return NextResponse.json(
          { error: `Chave Pix inválida: ${valResult.error || 'Formato incorreto'}` },
          { status: 400 }
        );
      }
      transferBody.pixAddressKey = valResult.formattedKey;
      transferBody.pixAddressKeyType = valResult.type;
    } else if (rawWalletId && rawWalletId.length >= 10) {
      // 2. Se não houver chave Pix, transferir para a subconta Asaas (walletId)
      transferBody.walletId = rawWalletId;
    } else {
      return NextResponse.json(
        { error: 'Destino de transferência inválido.' },
        { status: 400 }
      );
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
      console.error('[API Asaas Transfer] Resposta não-JSON do Asaas:', resText);
      return NextResponse.json(
        { error: `Status ${res.status}: ${resText || 'Sem resposta do gateway'}` },
        { status: 400 }
      );
    }

    if (!res.ok || data.errors) {
      const msg = data.errors
        ? data.errors.map((e: any) => e.description || e.code).join(', ')
        : (data.message || JSON.stringify(data));
      console.warn('[API Asaas Transfer] Recusa Asaas:', msg);
      return NextResponse.json({ error: `Asaas recusou a transferência: ${msg}` }, { status: 400 });
    }

    // Se a transferência teve sucesso, atualiza pedidos e extrato
    try {
      const supabase = getSupabaseAdmin();

      if (orderId) {
        const isDriverRole = ['motorista', 'courier', 'motoboy', 'caminhao', 'driver'].includes(String(role || '').toLowerCase());
        const updatePayload: any = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
        await supabase.from('orders').update(updatePayload).eq('id', orderId);
      }

      const targetPartnerId = partnerId || auth.profile?.id;
      if (targetPartnerId) {
        const { data: ledgerHistory } = await supabase
          .from('partner_ledger')
          .select('amount, type')
          .eq('partner_id', targetPartnerId);

        const currentBalance = (ledgerHistory || []).reduce((acc: number, item: any) => {
          return item.type === 'credit' ? acc + Number(item.amount || 0) : acc - Number(item.amount || 0);
        }, 0);

        const balanceAfter = Math.max(0, currentBalance - transferValue);

        await supabase.from('partner_ledger').insert({
          partner_id: targetPartnerId,
          order_id: orderId || null,
          type: 'debit',
          amount: transferValue,
          description: `Repasse Pix via Admin #${String(orderId || data.id || '').substring(0, 8)}`,
          balance_after: balanceAfter
        });

        // Atualizar eventuais solicitações de saque pendentes do parceiro
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'PAGO',
            failure_reason: null,
            paid_at: new Date().toISOString(),
            asaas_transfer_id: data.id || null
          })
          .eq('partner_id', targetPartnerId)
          .in('status', ['PENDENTE', 'PROCESSING', 'FALHOU']);
      }
    } catch (upErr) {
      console.warn('[API Asaas Transfer] Aviso ao atualizar tabelas internas:', upErr);
    }

    return NextResponse.json({
      success: true,
      transferId: data.id,
      status: data.status,
      value: data.value,
      message: `Pix de R$ ${transferValue.toFixed(2)} emitido com sucesso!`
    });

  } catch (error: any) {
    console.error('[API Asaas Transfer] Erro interno:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar transferência Pix no Asaas' },
      { status: 500 }
    );
  }
}
