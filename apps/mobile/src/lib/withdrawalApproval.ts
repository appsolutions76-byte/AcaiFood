import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { buildAsaasTransferPayload } from '@/lib/asaasTransferHelpers';
import { logAdminAction } from '@/lib/adminAudit';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export interface ProcessApprovalResult {
  success: boolean;
  status: 'PAGO' | 'PROCESSING' | 'FALHOU' | 'REJEITADO';
  transferId?: string;
  amount?: number;
  netAmount?: number;
  pixFee?: number;
  pixKeyUsed?: string;
  message?: string;
  error?: string;
}

export async function processWithdrawalApproval(
  requestId: string,
  actorId: string | null
): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const attemptId = `ATTEMPT_${requestId}_${Date.now()}`;

  // 0. Tentativa anterior (para checagem de idempotência no Asaas)
  const { data: previousRow } = await adminSupabase
    .from('withdrawal_requests')
    .select('status, transfer_attempt_id, asaas_transfer_id')
    .eq('id', requestId)
    .maybeSingle();
  const previousAttemptId: string | null = previousRow?.transfer_attempt_id || null;

  // 1. Trava atômica: Marcar como 'PROCESSING' com transfer_attempt_id
  const { data: lockRow, error: lockErr } = await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PROCESSING',
      transfer_attempt_id: attemptId,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .in('status', ['PENDENTE', 'FALHOU', 'PROCESSING'])
    .select('*')
    .maybeSingle();

  if (lockErr || !lockRow) {
    if (lockErr) {
      console.error('[processWithdrawalApproval] Erro na trava atômica:', lockErr);
    }
    return {
      success: false,
      status: 'FALHOU',
      error: lockErr ? `Erro no banco de dados: ${lockErr.message}` : 'Solicitação não encontrada ou em processamento concorrente.'
    };
  }

  const requestRow = lockRow;

  // 2. Buscar dados do parceiro em users
  const { data: partnerUser, error: pErr } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', requestRow.partner_id)
    .maybeSingle();

  if (pErr || !partnerUser) {
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: 'Usuário parceiro não foi encontrado no banco de dados.',
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: 'Parceiro não encontrado.' };
  }

  // 3. Destino do saque
  const rawKey = String(partnerUser.pix_key || partnerUser.pixKey || partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').trim();
  const rawWalletId = String(partnerUser.asaas_wallet_id || '').trim();

  if (!rawKey && !rawWalletId) {
    const failMsg = 'O parceiro não possui chave Pix nem subconta Asaas vinculada para receber a transferência.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: failMsg,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 4. Determinar o valor do saque e ordens vinculadas
  const requestedAmount = Number(requestRow.requested_amount || 0);
  const balanceResult = await getPartnerAvailableBalance(requestRow.partner_id, requestRow.role || partnerUser.role);
  
  const hasExplicitOrders = Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0;
  const finalOrderIds = hasExplicitOrders ? requestRow.order_ids : balanceResult.orderIds;

  // Valor a transferir: nunca menor ou igual a zero
  const finalAmount = Number((hasExplicitOrders && requestedAmount > 0
    ? requestedAmount
    : (balanceResult.totalDisponivel > 0 ? balanceResult.totalDisponivel : requestedAmount)).toFixed(2));

  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());

  if (finalAmount <= 0) {
    const failMsg = 'O valor do saque deve ser maior que R$ 0,00.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: failMsg,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 5. Configuração e chaves Asaas
  const asaasApiKey = await getAsaasApiKey();
  const baseUrl = getAsaasBaseUrl(asaasApiKey);
  const isSandbox = baseUrl.includes('sandbox');
  console.log(`[WithdrawalApproval] Processando saque #${requestId.substring(0, 8)} | Valor: R$ ${finalAmount} | Tentativa: ${attemptId} | Ambiente: ${isSandbox ? 'Sandbox' : 'Produção'}`);

  if (!asaasApiKey) {
    const failMsg = 'Chave ASAAS_API_KEY não configurada no servidor.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: failMsg,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 6. Idempotência no Asaas antes de transferir
  try {
    const checkRes = previousAttemptId
      ? await fetch(`${baseUrl}/transfers?externalReference=${encodeURIComponent(previousAttemptId)}`, {
          headers: { 'access_token': asaasApiKey }
        })
      : null;
    if (checkRes && checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData?.data && checkData.data.length > 0) {
        const existingTransfer = checkData.data[0];
        const isDone = existingTransfer.status === 'DONE' || existingTransfer.status === 'COMPLETED' || existingTransfer.status === 'CONFIRMED';
        const finalStatus = isDone ? 'PAGO' : 'PROCESSING';

        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: finalStatus,
            asaas_transfer_id: existingTransfer.id,
            paid_at: isDone ? new Date().toISOString() : null,
            failure_reason: isDone ? null : 'Aguardando autorização bancária no app do Asaas pelo administrador'
          })
          .eq('id', requestId);

        if (isDone && finalOrderIds.length > 0) {
          const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
          await adminSupabase.from('orders').update(updateField).in('id', finalOrderIds);
        }

        return {
          success: true,
          status: finalStatus,
          transferId: existingTransfer.id,
          amount: finalAmount,
          message: isDone ? 'Transferência já havia sido liquidada no Asaas.' : 'Transferência Pix aguardando autorização no app Asaas.'
        };
      }
    }
  } catch (chkErr) {
    console.warn('[WithdrawalApproval] Aviso ao checar idempotência prévia:', chkErr);
  }

  // 7. Construir payload de transferência Pix a partir da conta Master
  const transferPayload: any = buildAsaasTransferPayload(
    partnerUser,
    finalAmount,
    `Saque AçaíFood #${requestId.substring(0, 8)}`
  );

  if (!transferPayload) {
    const failMsg = 'Não foi possível construir o payload de transferência Pix (verifique a chave Pix do parceiro).';
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: failMsg,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  transferPayload.externalReference = attemptId;

  // 8. Disparar transferência na API Asaas
  let asaasTransferId = '';
  let transferStatus = '';
  let isAuthorized = false;
  let apiSuccess = false;
  let apiErrorMsg = '';
  let definitiveFailure = false;

  try {
    const res = await fetch(`${baseUrl}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey
      },
      body: JSON.stringify(transferPayload)
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.id) {
      apiSuccess = true;
      asaasTransferId = data.id;
      transferStatus = data.status || 'PENDING';
      isAuthorized = Boolean(data.authorized);
      console.log(`[WithdrawalApproval] ✅ Transferência Pix criada no Asaas: ID ${data.id} | Status: ${transferStatus} | Authorized: ${isAuthorized}`);
    } else {
      apiErrorMsg = data?.errors?.[0]?.description || data?.message || `Erro HTTP ${res.status} do Asaas ao efetuar transferência`;
      definitiveFailure = res.status >= 400 && res.status < 500 && Array.isArray(data?.errors);
      console.error(`[WithdrawalApproval] ❌ Falha no Asaas:`, apiErrorMsg, data);
    }
  } catch (err: any) {
    apiErrorMsg = err?.message || 'Exceção de rede ao comunicar com Asaas';
  }

  const nowIso = new Date().toISOString();

  if (apiSuccess) {
    const isDone = (transferStatus === 'DONE' || transferStatus === 'COMPLETED' || transferStatus === 'CONFIRMED') && isAuthorized;
    const effectivePixKey = transferPayload.pixAddressKey || partnerUser.pix_key || partnerUser.cpf_cnpj;

    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: isDone ? 'PAGO' : 'PROCESSING',
        requested_amount: finalAmount,
        order_ids: finalOrderIds,
        asaas_transfer_id: asaasTransferId,
        pix_key_used: effectivePixKey || null,
        wallet_id_used: transferPayload.walletId || rawWalletId || null,
        reviewed_by: actorId,
        reviewed_at: nowIso,
        paid_at: isDone ? nowIso : null,
        processed_automatically: (actorId === null),
        failure_reason: isDone ? null : 'Aguardando autorização bancária no aplicativo do Asaas pelo administrador'
      })
      .eq('id', requestId);

    if (isDone && finalOrderIds && finalOrderIds.length > 0) {
      const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
      await adminSupabase.from('orders').update(updateField).in('id', finalOrderIds);
    }

    await logAdminAction({
      actorId,
      action: isDone ? 'WITHDRAWAL_PIX_DONE_IMMEDIATE' : 'WITHDRAWAL_PIX_PENDING_ASAAS_AUTH',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: 'PENDENTE', amount: finalAmount },
      afterState: { 
        status: isDone ? 'PAGO' : 'PROCESSING', 
        asaas_transfer_id: asaasTransferId, 
        pixKey: effectivePixKey,
        attemptId 
      }
    });

    if (isDone) {
      return {
        success: true,
        status: 'PAGO',
        transferId: asaasTransferId,
        amount: finalAmount,
        pixKeyUsed: effectivePixKey,
        message: `Saque de R$ ${finalAmount.toFixed(2)} liquidado via Pix!`
      };
    }

    return {
      success: true,
      status: 'PROCESSING',
      transferId: asaasTransferId,
      amount: finalAmount,
      pixKeyUsed: effectivePixKey,
      message: `Transferência Pix de R$ ${finalAmount.toFixed(2)} enviada para o Asaas (ID: ${asaasTransferId.substring(0, 8)}...)! Acesse o aplicativo do Asaas no celular para realizar a autorização bancária final.`
    };
  } else if (!definitiveFailure) {
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'PROCESSING',
        requested_amount: finalAmount,
        order_ids: finalOrderIds,
        failure_reason: `A confirmar no Asaas: ${apiErrorMsg}`,
        reviewed_by: actorId,
        reviewed_at: nowIso
      })
      .eq('id', requestId);

    return {
      success: false,
      status: 'PROCESSING',
      amount: finalAmount,
      error: `Sem confirmação imediata do Asaas (${apiErrorMsg}). O saque ficou "em processamento"; confira no app do Asaas.`
    };
  } else {
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: apiErrorMsg,
        reviewed_by: actorId,
        reviewed_at: nowIso
      })
      .eq('id', requestId);

    return {
      success: false,
      status: 'FALHOU',
      error: `Erro no Asaas: ${apiErrorMsg}`
    };
  }
}

/**
 * Reconciliação de Saque Individual ou em Lote:
 * Consulta a transferência na API do Asaas e atualiza para PAGO quando autorizada.
 */
export async function executeSubaccountPixPayout(requestId: string): Promise<any> {
  const adminSupabase = getSupabaseAdmin();
  const { data: requestRow } = await adminSupabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (!requestRow) {
    return { success: false, status: 'FALHOU', error: 'Solicitação não encontrada' };
  }

  if (requestRow.status === 'PAGO') {
    return { success: true, status: 'PAGO', message: 'Saque já liquidado anteriormente.' };
  }

  const transferId = requestRow.asaas_transfer_id;
  if (!transferId) {
    return { success: false, status: 'PROCESSING', error: 'Transferência Asaas não iniciada' };
  }

  const asaasApiKey = await getAsaasApiKey();
  const baseUrl = getAsaasBaseUrl(asaasApiKey);

  try {
    const tRes = await fetch(`${baseUrl}/transfers/${transferId}`, {
      headers: { 'access_token': asaasApiKey }
    });

    if (tRes.ok) {
      const tData = await tRes.json();
      const status = String(tData.status || '').toUpperCase();
      const isDone = ['DONE', 'COMPLETED', 'CONFIRMED'].includes(status) || (status === 'PENDING' && tData.authorized === true);

      if (isDone) {
        const nowIso = new Date().toISOString();
        const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || '').toLowerCase());

        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'PAGO',
            paid_at: nowIso,
            failure_reason: null
          })
          .eq('id', requestId);

        if (Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0) {
          const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
          await adminSupabase.from('orders').update(updateField).in('id', requestRow.order_ids);
        }

        try {
          await adminSupabase.from('partner_ledger').insert({
            partner_id: requestRow.partner_id,
            type: 'debit',
            amount: requestRow.requested_amount,
            description: `Saque finalizado #${requestId.substring(0, 8)} via Pix Asaas (ID: ${transferId})`
          });
        } catch (_lErr) {}

        return { success: true, status: 'PAGO', message: 'Saque autorizado e liquidado com sucesso!' };
      } else if (['FAILED', 'CANCELLED', 'REJECTED', 'REFUSED'].includes(status)) {
        const failReason = tData.failReason || tData.description || `Transferência ${status.toLowerCase()} no Asaas.`;
        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'FALHOU',
            failure_reason: failReason,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);

        return { success: false, status: 'FALHOU', error: failReason };
      } else {
        return {
          success: true,
          status: 'PROCESSING',
          message: `Transferência ainda pendente de autorização no app Asaas (status: ${status}).`
        };
      }
    }
  } catch (err: any) {
    return { success: false, status: 'PROCESSING', error: err?.message || 'Falha ao consultar Asaas' };
  }

  return { success: false, status: 'PROCESSING', message: 'Aguardando autorização no Asaas.' };
}
