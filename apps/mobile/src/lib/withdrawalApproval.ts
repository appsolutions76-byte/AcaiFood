import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { buildAsaasTransferPayload } from '@/lib/asaasTransferHelpers';
import { logAdminAction } from '@/lib/adminAudit';

export interface ProcessApprovalResult {
  success: boolean;
  status: 'PAGO' | 'PROCESSING' | 'FALHOU' | 'REJEITADO';
  transferId?: string;
  amount?: number;
  message?: string;
  error?: string;
}

export async function processWithdrawalApproval(
  requestId: string,
  actorId: string | null
): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const attemptId = `ATTEMPT_${requestId}_${Date.now()}`;

  // 1. Trava atômica condicional (P5 & H2): Marcar como 'PROCESSING' com transfer_attempt_id
  const { data: lockRow, error: lockErr } = await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PROCESSING',
      transfer_attempt_id: attemptId,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .in('status', ['PENDENTE', 'FALHOU'])
    .select('*')
    .maybeSingle();

  if (lockErr || !lockRow) {
    if (lockErr) {
      console.error('[processWithdrawalApproval] Erro na trava atômica:', lockErr);
    }
    return {
      success: false,
      status: 'FALHOU',
      error: lockErr ? `Erro no banco de dados: ${lockErr.message}` : 'Solicitação não encontrada, já finalizada ou em processamento concorrente.'
    };
  }

  const requestRow = lockRow;

  // 2. Buscar dados atualizados do parceiro em users
  const { data: partnerUser, error: pErr } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', requestRow.partner_id)
    .maybeSingle();

  if (pErr || !partnerUser) {
    if (pErr) {
      console.error('[processWithdrawalApproval] Erro ao buscar parceiro em users:', pErr);
    }
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

  // 3. Validar se o parceiro possui destino válido (Subconta Asaas ou Chave Pix / CPF / Email)
  const rawPixKey = String(partnerUser.pix_key || requestRow.pix_key_used || '').trim();
  const rawCpfCnpj = String(partnerUser.cpf_cnpj || '').replace(/\D/g, '');
  const rawEmail = String(partnerUser.email || '').trim();
  const rawWalletId = String(partnerUser.asaas_wallet_id || '').trim();
  const isAccountActive = partnerUser.asaas_account_status === 'APPROVED' && Boolean(rawWalletId);
  const hasPixDestination = Boolean(rawPixKey) || Boolean(rawCpfCnpj) || (rawEmail.includes('@') && rawEmail.includes('.'));

  if (!isAccountActive && !hasPixDestination && !rawWalletId) {
    const failMsg = 'O parceiro não possui Chave Pix, CPF/CNPJ ou subconta Asaas configurada para recebimento.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: failMsg,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    await logAdminAction({
      actorId,
      action: 'WITHDRAWAL_FAILED_NO_PAYOUT_DESTINATION',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: requestRow.status, requested_amount: requestRow.requested_amount },
      afterState: { status: 'FALHOU', reason: failMsg }
    });

    return { success: false, status: 'FALHOU', error: failMsg };
  }


  // 4. Determinar o valor do saque e ordens vinculadas
  const requestedAmount = Number(requestRow.requested_amount || 0);
  const balanceResult = await getPartnerAvailableBalance(requestRow.partner_id, requestRow.role || partnerUser.role);
  
  const finalAmount = requestedAmount > 0 ? requestedAmount : balanceResult.totalDisponivel;
  const finalOrderIds = (Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0)
    ? requestRow.order_ids 
    : balanceResult.orderIds;

  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());

  // 4.1 Validação de duplicidade de ordens (Recusa se algum pedido estiver em outro saque aberto/pago)
  if (finalOrderIds && finalOrderIds.length > 0) {
    const { data: otherWithdrawals } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, order_ids, status')
      .in('status', ['PAGO', 'PROCESSING'])
      .neq('id', requestId);

    if (otherWithdrawals && otherWithdrawals.length > 0) {
      const alreadyUsedOrderIds = new Set<string>();
      for (const ow of otherWithdrawals) {
        if (Array.isArray(ow.order_ids)) {
          ow.order_ids.forEach((oid: string) => alreadyUsedOrderIds.add(oid));
        }
      }

      const duplicateOrderId = finalOrderIds.find((id: string) => alreadyUsedOrderIds.has(id));
      if (duplicateOrderId) {
        const failMsg = `O pedido ${duplicateOrderId} já está vinculado a outro saque aberto ou liquidado.`;
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
    }
  }

  if (finalAmount <= 0) {
    if (finalOrderIds && finalOrderIds.length > 0) {
      const { data: checkOrders } = await adminSupabase
        .from('orders')
        .select('id, payout_seller_done, payout_driver_done')
        .in('id', finalOrderIds);

      const allPaid = checkOrders && checkOrders.length > 0 && checkOrders.every((o: any) => isDriverRole ? o.payout_driver_done : o.payout_seller_done);
      if (allPaid) {
        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'PAGO',
            failure_reason: null,
            reviewed_by: actorId,
            reviewed_at: new Date().toISOString(),
            paid_at: new Date().toISOString()
          })
          .eq('id', requestId);

        return {
          success: true,
          status: 'PAGO',
          message: 'Solicitação já liquidada anteriormente via Pix Asaas.'
        };
      }
    }

    const failMsg = 'O valor do saque é R$ 0,00 ou os pedidos referentes a esta solicitação já foram liquidados.';
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
  const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
  const asaasApiKey = await getAsaasApiKey();
  const baseUrl = getAsaasBaseUrl(asaasApiKey);
  const isSandbox = baseUrl.includes('sandbox');
  const keySuffix = asaasApiKey.length >= 4 ? asaasApiKey.slice(-4) : 'none';
  console.log(`[WithdrawalApproval] Processando saque #${requestId.substring(0, 8)} | Tentativa: ${attemptId} | Ambiente: ${isSandbox ? 'Sandbox' : 'Produção'} | Chave: ***${keySuffix}`);

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

  // 6. Consulta de Idempotência no Asaas antes de transferir (H2)
  try {
    const prevAttempt = requestRow.transfer_attempt_id || requestId;
    const checkRes = await fetch(`${baseUrl}/transfers?externalReference=${encodeURIComponent(prevAttempt)}`, {
      headers: { 'access_token': asaasApiKey }
    });
    if (checkRes.ok) {
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
            failure_reason: null
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
          message: isDone ? 'Transferência já havia sido liquidada no Asaas.' : 'Transferência em processamento no Asaas.'
        };
      }
    }
  } catch (chkErr) {
    console.warn('[WithdrawalApproval] Aviso ao checar idempotência prévia:', chkErr);
  }

  // 7. Resolver payload de transferência Asaas com externalReference
  const partnerUserToUse = {
    ...partnerUser,
    pix_key: partnerUser.pix_key || requestRow.pix_key_used
  };
  const transferPayload: any = buildAsaasTransferPayload(
    partnerUserToUse,
    finalAmount,
    `Saque AçaíFood - #${requestId.substring(0, 8)}`
  );

  if (!transferPayload) {
    const failMsg = 'Não foi possível construir o payload de transferência Asaas.';
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

  // 8. Realizar transferência via API Asaas
  let asaasTransferId = '';
  let transferStatus = '';
  let apiSuccess = false;
  let apiErrorMsg = '';

  try {
    const res = await fetch(`${baseUrl}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey
      },
      body: JSON.stringify(transferPayload)
    });

    const data = await res.json();

    if (res.ok && data?.id) {
      apiSuccess = true;
      asaasTransferId = data.id;
      transferStatus = data.status || 'PENDING';
    } else {
      apiErrorMsg = data?.errors?.[0]?.description || data?.message || 'Erro na resposta do Asaas ao efetuar transferência';
    }
  } catch (err: any) {
    apiErrorMsg = err.message || 'Exceção de rede ao comunicar com Asaas';
  }

  const nowIso = new Date().toISOString();

  if (apiSuccess) {
    const isDone = transferStatus === 'DONE' || transferStatus === 'COMPLETED' || transferStatus === 'CONFIRMED';
    const finalRequestStatus = isDone ? 'PAGO' : 'PROCESSING';
    
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: finalRequestStatus,
        requested_amount: finalAmount,
        order_ids: finalOrderIds,
        asaas_transfer_id: asaasTransferId,
        pix_key_used: transferPayload.pixAddressKey || null,
        wallet_id_used: transferPayload.walletId || null,
        paid_at: isDone ? nowIso : null,
        reviewed_by: actorId,
        reviewed_at: nowIso,
        processed_automatically: (actorId === null)
      })
      .eq('id', requestId);

    if (isDone && finalOrderIds.length > 0) {
      const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
      await adminSupabase
        .from('orders')
        .update(updateField)
        .in('id', finalOrderIds);
    }

    // Registrar extrato/ledger
    try {
      const { data: history } = await adminSupabase
        .from('partner_ledger')
        .select('amount, type')
        .eq('partner_id', requestRow.partner_id);

      const currentBal = (history || []).reduce((acc: number, item: any) => {
        return item.type === 'credit' ? acc + Number(item.amount || 0) : acc - Number(item.amount || 0);
      }, 0);

      const newBal = Math.max(0, currentBal - finalAmount);

      await adminSupabase.from('partner_ledger').insert({
        partner_id: requestRow.partner_id,
        type: 'debit',
        amount: finalAmount,
        balance_after: newBal,
        description: `Saque aprovado #${requestId.substring(0, 8)} via Pix Asaas (Transf: ${asaasTransferId})`
      });
    } catch (_lErr) {}

    await logAdminAction({
      actorId,
      action: 'WITHDRAWAL_APPROVED',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: 'PENDENTE', amount: finalAmount },
      afterState: { status: finalRequestStatus, asaas_transfer_id: asaasTransferId, attemptId }
    });

    return {
      success: true,
      status: finalRequestStatus,
      transferId: asaasTransferId,
      amount: finalAmount,
      message: `Saque de R$ ${finalAmount.toFixed(2)} processado com sucesso via Asaas (Status: ${finalRequestStatus}).`
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

    try {
      await adminSupabase.from('payout_failures').insert({
        partner_id: requestRow.partner_id,
        amount: finalAmount,
        reason: apiErrorMsg,
        gateway_response: { error: apiErrorMsg, requestId, attemptId }
      });
    } catch (_fErr) {}

    await logAdminAction({
      actorId,
      action: 'WITHDRAWAL_REJECTED_API_ERROR',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: 'PENDENTE', amount: finalAmount },
      afterState: { status: 'FALHOU', error: apiErrorMsg, attemptId }
    });

    return {
      success: false,
      status: 'FALHOU',
      error: `Erro no Asaas: ${apiErrorMsg}`
    };
  }
}
