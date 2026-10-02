import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleProcessSettlements(request);
}

export async function POST(request: Request) {
  return handleProcessSettlements(request);
}

async function handleProcessSettlements(request: Request) {
  // Autenticação: CRON / internal secret ou admin JWT
  const isInternal = isAuthorizedRequest(request);
  if (!isInternal) {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized) {
      return unauthorizedResponse(auth.error);
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Feature Flag: settlements_enabled mantida estritamente desligada (false) até aprovação formal (Regra R12 Fase 4)
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('settlements_enabled')
      .limit(1)
      .maybeSingle();

    const isEnabled = settings?.settlements_enabled === true;

    if (!isEnabled) {
      return NextResponse.json({
        success: true,
        settlementsEnabled: false,
        message: 'Liquidação de repasses aguardando autorização da plataforma (settlements_enabled=false). Registros mantidos para execução controlada.'
      });
    }

    const apiKey = await getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 500 });
    }
    const asaasUrl = getAsaasBaseUrl(apiKey);

    // 2. Buscar repasses pendentes de liquidação
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

    if (!pendingSettlements || pendingSettlements.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: 'Nenhum repasse pendente para liquidação.'
      });
    }

    const results: any[] = [];

    for (const settlement of pendingSettlements) {
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
      const isKycApproved = partner?.asaas_account_status === 'APPROVED' || partner?.split_enabled === true;

      if (!walletId || !isKycApproved) {
        await supabase
          .from('settlements')
          .update({
            status: 'WAITING_ACCOUNT',
            last_error: !walletId ? 'Parceiro sem carteira Asaas vinculada' : 'Subconta Asaas aguardando aprovação de KYC'
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
      try {
        const checkRes = await fetch(`${asaasUrl}/transfers?externalReference=${encodeURIComponent(settlement.id)}`, {
          headers: { 'access_token': apiKey }
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData?.data && checkData.data.length > 0) {
            const existingTransfer = checkData.data[0];
            await supabase
              .from('settlements')
              .update({
                status: 'DONE',
                asaas_transfer_id: existingTransfer.id,
                transferred_at: new Date().toISOString(),
                last_error: null
              })
              .eq('id', settlement.id);

            results.push({ id: settlement.id, status: 'ALREADY_TRANSFERRED', transferId: existingTransfer.id });
            continue;
          }
        }
      } catch (checkErr) {
        console.warn("[Settlement Process] Aviso ao checar idempotência Asaas:", checkErr);
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
          await supabase
            .from('settlements')
            .update({
              status: 'DONE',
              asaas_transfer_id: transferData.id,
              transferred_at: new Date().toISOString(),
              last_error: null
            })
            .eq('id', settlement.id);

          results.push({ id: settlement.id, status: 'DONE', transferId: transferData.id });
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
