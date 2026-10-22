import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { settleOrderPayouts, syncAndProcessPendingSettlements } from '@/lib/orderSettlements';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleProcessSettlements(request);
}

export async function POST(request: Request) {
  return handleProcessSettlements(request);
}

async function handleProcessSettlements(request: Request) {
  // Autenticação: CRON / internal secret ou parceiro autenticado ou admin JWT
  const isInternal = isAuthorizedRequest(request);
  if (!isInternal) {
    const auth = await authorizeRequest(request, ['admin', 'loja', 'motorista']);
    if (!auth.authorized) {
      return unauthorizedResponse(auth.error);
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const specificOrderId = searchParams.get('orderId');

    // 1. Feature Flag: settlements_enabled
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('settlements_enabled')
      .limit(1)
      .maybeSingle();

    const isEnabled = settings?.settlements_enabled !== false;

    if (!isEnabled && !searchParams.get('force')) {
      return NextResponse.json({
        success: true,
        settlementsEnabled: false,
        message: 'Liquidação de repasses aguardando autorização da plataforma (settlements_enabled=false).'
      });
    }

    // Se passou orderId específico, liquida diretamente esse pedido
    if (specificOrderId) {
      const orderResult = await settleOrderPayouts(specificOrderId);
      return NextResponse.json({
        success: true,
        orderId: specificOrderId,
        result: orderResult
      });
    }

    // 2. Sincronizar pedidos RECEIVED pendentes de liquidação
    const syncRes = await syncAndProcessPendingSettlements();

    const apiKey = await getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 500 });
    }
    const asaasUrl = getAsaasBaseUrl(apiKey);

    // 3. Buscar repasses pendentes de liquidação na tabela settlements
    const { data: pendingSettlements, error: qErr } = await supabase
      .from('settlements')
      .select('id, order_id, partner_id, role, amount, status, attempts, asaas_transfer_id')
      .in('status', ['PENDING', 'FAILED', 'WAITING_ACCOUNT'])
      .lt('attempts', 5)
      .order('created_at', { ascending: true })
      .limit(50);

    if (qErr) {
      console.error("[Settlement Process] Erro ao buscar repasses:", qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const results: any[] = [...syncRes.results];

    for (const settlement of pendingSettlements || []) {
      if (!settlement.amount || Number(settlement.amount) <= 0) {
        await supabase
          .from('settlements')
          .update({ status: 'DONE', last_error: 'Valor zero dispensado' })
          .eq('id', settlement.id);
        results.push({ id: settlement.id, status: 'SKIPPED_ZERO' });
        continue;
      }

      // Buscar dados do parceiro (usuário dono da subconta)
      const { data: partner } = await supabase
        .from('users')
        .select('id, name, asaas_wallet_id, asaas_account_status, split_enabled')
        .eq('id', settlement.partner_id)
        .maybeSingle();

      const walletId = partner?.asaas_wallet_id?.trim();
      const isKycApproved = partner?.asaas_account_status === 'APPROVED';

      if (!walletId || !isKycApproved) {
        await supabase
          .from('settlements')
          .update({
            status: 'WAITING_ACCOUNT',
            last_error: !walletId ? 'Parceiro sem carteira Asaas vinculada' : 'Subconta Asaas aguardando aprovação de KYC (status deve ser APPROVED)'
          })
          .eq('id', settlement.id);

        results.push({
          id: settlement.id,
          partnerId: settlement.partner_id,
          status: 'WAITING_ACCOUNT',
          reason: !walletId ? 'Sem walletId' : 'KYC não aprovado'
        });
        continue;
      }

      // Idempotência: verificar se já existe transferência no Asaas para este externalReference
      let existingTransfer: any = null;
      try {
        const checkRes = await fetch(`${asaasUrl}/transfers?externalReference=${encodeURIComponent(settlement.id)}`, {
          headers: { 'access_token': apiKey }
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (Array.isArray(checkData?.data)) {
            // Filtrar estritamente pelo externalReference exato
            existingTransfer = checkData.data.find((t: any) => t.externalReference === settlement.id);
          }
        }
      } catch (checkErr) {
        console.warn("[Settlement Process] Aviso ao checar idempotência Asaas:", checkErr);
      }

      if (existingTransfer) {
        const isConfirmed = existingTransfer.status === 'DONE' || existingTransfer.status === 'COMPLETED' || existingTransfer.status === 'CONFIRMED';
        const finalSt = isConfirmed ? 'DONE' : 'PROCESSING';

        await supabase
          .from('settlements')
          .update({
            status: finalSt,
            asaas_transfer_id: existingTransfer.id,
            transferred_at: isConfirmed ? new Date().toISOString() : null,
            last_error: null
          })
          .eq('id', settlement.id);

        if (isConfirmed) {
          const updateField = settlement.role === 'driver' ? { payout_driver_done: true } : { payout_seller_done: true };
          await supabase.from('orders').update(updateField).eq('id', settlement.order_id);
        }

        results.push({ id: settlement.id, status: finalSt, transferId: existingTransfer.id });
        continue;
      }

      // Trava atômica condicional: marcar como PROCESSING antes de chamar Asaas
      const { data: lockRow, error: lockErr } = await supabase
        .from('settlements')
        .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
        .eq('id', settlement.id)
        .in('status', ['PENDING', 'FAILED', 'WAITING_ACCOUNT'])
        .select()
        .maybeSingle();

      if (lockErr || !lockRow) {
        continue; // Já travado por outra thread concorrente
      }

      // Executar transferência interna entre contas Asaas (BaaS Cláusula 6.4)
      const transferBody = {
        value: Number(settlement.amount),
        walletId: walletId,
        externalReference: settlement.id,
        description: `Repasse AçaíFood #${String(settlement.order_id).substring(0, 8)} (${settlement.role})`
      };

      try {
        const transferRes = await fetch(`${asaasUrl}/transfers`, {
          method: 'POST',
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transferBody)
        });

        const transferData = await transferRes.json();

        if (transferRes.ok && transferData.id) {
          const isConfirmed = transferData.status === 'DONE' || transferData.status === 'COMPLETED' || transferData.status === 'CONFIRMED';
          const targetStatus = isConfirmed ? 'DONE' : 'PROCESSING';
          const nowIso = new Date().toISOString();

          await supabase
            .from('settlements')
            .update({
              status: targetStatus,
              asaas_transfer_id: transferData.id,
              transferred_at: isConfirmed ? nowIso : null,
              last_error: null
            })
            .eq('id', settlement.id);

          if (isConfirmed) {
            const updateField = settlement.role === 'driver' ? { payout_driver_done: true } : { payout_seller_done: true };
            await supabase.from('orders').update(updateField).eq('id', settlement.order_id);
          }

          results.push({ id: settlement.id, status: targetStatus, transferId: transferData.id });
        } else {
          const errorMsg = transferData.errors
            ? transferData.errors.map((e: any) => e.description).join(', ')
            : (transferData.message || JSON.stringify(transferData));

          const nextAttempts = (settlement.attempts || 0) + 1;
          const nextStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';

          await supabase
            .from('settlements')
            .update({
              status: nextStatus,
              attempts: nextAttempts,
              last_error: errorMsg,
              updated_at: new Date().toISOString()
            })
            .eq('id', settlement.id);

          results.push({ id: settlement.id, status: nextStatus, error: errorMsg, attempts: nextAttempts });
        }
      } catch (tfErr: any) {
        const nextAttempts = (settlement.attempts || 0) + 1;
        const nextStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';

        await supabase
          .from('settlements')
          .update({
            status: nextStatus,
            attempts: nextAttempts,
            last_error: tfErr.message || 'Erro de rede na transferência Asaas',
            updated_at: new Date().toISOString()
          })
          .eq('id', settlement.id);

        results.push({ id: settlement.id, status: nextStatus, error: tfErr.message, attempts: nextAttempts });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error("[Settlement Process] Erro fatal:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
