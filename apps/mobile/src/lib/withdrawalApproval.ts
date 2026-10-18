import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { buildAsaasTransferPayload, buildSubaccountPixTransferPayload } from '@/lib/asaasTransferHelpers';
import { logAdminAction } from '@/lib/adminAudit';

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

  // 0. Tentativa anterior (para a checagem de idempotência no Asaas): precisa ser lida
  //    ANTES da trava, que sobrescreve transfer_attempt_id com a tentativa nova.
  const { data: previousRow } = await adminSupabase
    .from('withdrawal_requests')
    .select('status, transfer_attempt_id')
    .eq('id', requestId)
    .maybeSingle();
  const previousAttemptId: string | null = previousRow?.transfer_attempt_id || null;

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

  // 3. Destino: SOMENTE a subconta Asaas do parceiro, aprovada (cl. 2.1, 6.3 e 6.4 do
  //    contrato BaaS). Nada de Pix para chave digitada, CPF ou e-mail.
  const rawWalletId = String(partnerUser.asaas_wallet_id || '').trim();
  const isAccountActive = String(partnerUser.asaas_account_status || '').toUpperCase() === 'APPROVED' && Boolean(rawWalletId);

  if (!isAccountActive) {
    const failMsg = 'A conta de pagamento Asaas do parceiro ainda não foi aprovada. O saque só é pago na subconta aprovada.';
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
  
  const hasExplicitOrders = Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0;
  const finalOrderIds = hasExplicitOrders ? requestRow.order_ids : balanceResult.orderIds;
  // Nunca paga acima do saldo calculado no servidor
  const finalAmount = Number((hasExplicitOrders && requestedAmount > 0
    ? Math.min(requestedAmount, balanceResult.totalDisponivel)
    : balanceResult.totalDisponivel).toFixed(2));

  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());

  // 4.1 Validação de duplicidade de ordens (Recusa se algum pedido estiver em outro saque aberto/pago do MESMO papel)
  if (finalOrderIds && finalOrderIds.length > 0) {
    const { data: otherWithdrawals } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, order_ids, status, role')
      .in('status', ['PAGO', 'PROCESSING', 'PENDENTE', 'APROVADO'])
      .neq('id', requestId);

    if (otherWithdrawals && otherWithdrawals.length > 0) {
      const alreadyUsedOrderIds = new Set<string>();
      for (const ow of otherWithdrawals) {
        const owIsDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(ow.role || '').toLowerCase());
        // Só considera duplicidade se o saque pertencer ao mesmo grupo de papel:
        // motorista conflita com motorista; loja/fornecedor conflita com loja/fornecedor.
        // O mesmo pedido possui payout_driver e payout_seller independentes.
        if (owIsDriver === isDriverRole) {
          if (Array.isArray(ow.order_ids)) {
            ow.order_ids.forEach((oid: string) => alreadyUsedOrderIds.add(String(oid)));
          }
        }
      }

      const duplicateOrderId = finalOrderIds.find((id: string) => alreadyUsedOrderIds.has(String(id)));
      if (duplicateOrderId) {
        const papelStr = isDriverRole ? 'motorista' : 'loja/fornecedor';
        const failMsg = `O pedido ${duplicateOrderId} já está vinculado a outro saque de ${papelStr} aberto ou liquidado.`;
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
    // Só faz sentido quando houve tentativa anterior (reprocessamento de FALHOU/timeout)
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
  const transferPayload: any = buildAsaasTransferPayload(
    partnerUser,
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
  // true = o Asaas respondeu com erro de negócio (4xx); false = rede/timeout/5xx (resultado incerto)
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
    } else {
      apiErrorMsg = data?.errors?.[0]?.description || data?.message || `Erro HTTP ${res.status} do Asaas ao efetuar transferência`;
      definitiveFailure = res.status >= 400 && res.status < 500 && Array.isArray(data?.errors);
    }
  } catch (err: any) {
    apiErrorMsg = err?.message || 'Exceção de rede ao comunicar com Asaas';
  }

  const nowIso = new Date().toISOString();

  if (apiSuccess) {
    const isDone = transferStatus === 'DONE' || transferStatus === 'COMPLETED' || transferStatus === 'CONFIRMED';
    const effectivePixKey = partnerUser.pix_key || partnerUser.cpf_cnpj;

    // Tempo 1: Gravar a solicitação com a transferência Master -> Subconta iniciada
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'PROCESSING',
        requested_amount: finalAmount,
        order_ids: finalOrderIds,
        asaas_transfer_id: asaasTransferId,
        pix_key_used: effectivePixKey || null,
        wallet_id_used: transferPayload.walletId || null,
        reviewed_by: actorId,
        reviewed_at: nowIso,
        processed_automatically: (actorId === null),
        failure_reason: 'Aguardando liquidação do saldo na subconta Asaas'
      })
      .eq('id', requestId);

    await logAdminAction({
      actorId,
      action: 'WITHDRAWAL_STAGE1_MASTER_TO_SUBCONT_SUCCESS',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: 'PENDENTE', amount: finalAmount },
      afterState: { 
        status: 'PROCESSING', 
        asaas_transfer_id: asaasTransferId, 
        attemptId,
        walletId: transferPayload.walletId
      }
    });

    // Se a transferência interna Master -> Subconta já retornou DONE de imediato:
    if (isDone) {
      console.log(`[WithdrawalApproval] Transferência interna #${asaasTransferId} já retornou ${transferStatus}. Executando Tempo 2 imediatamente...`);
      const pixResult = await executeSubaccountPixPayout(requestId);
      if (pixResult.success && pixResult.status === 'PAGO') {
        return {
          success: true,
          status: 'PAGO',
          transferId: pixResult.pixTransferId || asaasTransferId,
          amount: finalAmount,
          netAmount: pixResult.netAmount,
          pixFee: pixResult.pixFee,
          pixKeyUsed: pixResult.pixKeyUsed,
          message: pixResult.message || `Saque de R$ ${finalAmount.toFixed(2)} aprovado e liquidado via Pix!`
        };
      }
    }

    // Caso padrão (PENDING no Asaas): Conclui o Tempo 1.
    // O Tempo 2 (Pix da subconta para o parceiro) será executado assim que a transferência interna for confirmada
    // (via webhook TRANSFER_DONE ou via reconciliação assíncrona).
    return {
      success: true,
      status: 'PROCESSING',
      transferId: asaasTransferId,
      amount: finalAmount,
      message: `Saque de R$ ${finalAmount.toFixed(2)} aprovado! O valor foi transferido para a subconta Asaas do parceiro (ID: ${asaasTransferId}) e o Pix externo será enviado automaticamente assim que a liquidação for concluída.`
    };
  } else if (!definitiveFailure) {
    // Resultado incerto (rede/timeout/5xx): a transferência pode ter sido criada no Asaas.
    // Fica PROCESSING; o webhook TRANSFER_* ou o reprocessamento (que consulta pelo
    // externalReference desta tentativa) fecha o status sem pagar em dobro.
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

    await logAdminAction({
      actorId,
      action: 'WITHDRAWAL_TRANSFER_UNCERTAIN',
      targetType: 'WITHDRAWAL_REQUEST',
      targetId: requestId,
      beforeState: { status: 'PENDENTE', amount: finalAmount },
      afterState: { status: 'PROCESSING', error: apiErrorMsg, attemptId }
    });

    return {
      success: false,
      status: 'PROCESSING',
      amount: finalAmount,
      error: `Sem confirmação do Asaas (${apiErrorMsg}). O saque ficou "em processamento"; confira no painel do Asaas antes de tentar de novo.`
    };
  } else {
    // O Asaas recusou porque a subconta de destino ainda não foi aprovada por ele:
    // a situação "APPROVED" gravada no app estava errada. Volta para "em análise"
    // (some o botão de saque do parceiro) e registra no log.
    const destinationNotApproved = /aprova[çc][ãa]o do cadastro|conta de destino/i.test(apiErrorMsg);
    if (destinationNotApproved) {
      apiErrorMsg = `${apiErrorMsg} (a conta Asaas do parceiro ainda está em análise no Asaas; reprocesse este saque depois da aprovação)`;
      try {
        await adminSupabase
          .from('users')
          .update({ asaas_account_status: 'AWAITING_APPROVAL', split_enabled: false })
          .eq('id', requestRow.partner_id);
        await logAdminAction({
          actorId,
          action: 'ASAAS_DESTINATION_NOT_APPROVED',
          targetType: 'USER',
          targetId: String(requestRow.partner_id),
          beforeState: { status: 'APPROVED' },
          afterState: { status: 'AWAITING_APPROVAL', withdrawalRequestId: requestId }
        });
      } catch (_stErr) {}
    }

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

export interface ExecutePixPayoutResult {
  success: boolean;
  status: 'PAGO' | 'PROCESSING' | 'FALHOU';
  netAmount?: number;
  pixFee?: number;
  pixTransferId?: string;
  pixKeyUsed?: string;
  message?: string;
  error?: string;
}

/**
 * Tempo 2 da Liquidação Asaas (Opção 2):
 * Executa a transferência Pix externa diretamente a partir da subconta Asaas do parceiro
 * para a sua chave Pix bancária de mesma titularidade, descontando a taxa Asaas de R$ 0,99.
 */
export async function executeSubaccountPixPayout(
  requestId: string
): Promise<ExecutePixPayoutResult> {
  const adminSupabase = getSupabaseAdmin();

  // 1. Buscar a solicitação de saque
  const { data: requestRow, error: reqErr } = await adminSupabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (reqErr || !requestRow) {
    return { success: false, status: 'FALHOU', error: 'Solicitação de saque não encontrada.' };
  }

  // Se já estiver PAGO, não duplica
  if (requestRow.status === 'PAGO') {
    return {
      success: true,
      status: 'PAGO',
      message: 'Solicitação já foi liquidada via Pix anteriormente.',
      pixKeyUsed: requestRow.pix_key_used,
      pixTransferId: requestRow.asaas_transfer_id
    };
  }

  // Só processa se estiver em PROCESSING
  if (requestRow.status !== 'PROCESSING') {
    return {
      success: false,
      status: requestRow.status,
      error: `Solicitação não está em processamento (status atual: ${requestRow.status}).`
    };
  }

  const masterTransferId = requestRow.asaas_transfer_id;
  if (!masterTransferId) {
    return { success: false, status: 'PROCESSING', error: 'Sem ID de transferência interna Master -> Subconta.' };
  }

  // 2. Chaves e URLs do Asaas
  const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
  const masterApiKey = await getAsaasApiKey();
  const masterBaseUrl = getAsaasBaseUrl(masterApiKey);

  // 3. Consultar status da transferência interna (Master -> Subconta) no Asaas
  try {
    const tRes = await fetch(`${masterBaseUrl}/transfers/${masterTransferId}`, {
      headers: { 'access_token': masterApiKey }
    });

    if (tRes.ok) {
      const tData = await tRes.json();
      const tStatus = String(tData.status || '').toUpperCase();

      // Se falhou ou foi cancelada no Asaas
      if (['FAILED', 'CANCELLED', 'REJECTED', 'REFUSED'].includes(tStatus)) {
        const failMsg = tData.failReason || tData.description || `Transferência para a subconta foi ${tStatus.toLowerCase()} no Asaas.`;
        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'FALHOU',
            failure_reason: failMsg,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);

        return { success: false, status: 'FALHOU', error: failMsg };
      }

      // Se ainda estiver PENDING ou BANK_PROCESSING
      if (!['DONE', 'COMPLETED', 'CONFIRMED'].includes(tStatus)) {
        return {
          success: false,
          status: 'PROCESSING',
          message: `Transferência Master -> Subconta ainda está com status '${tStatus}' no Asaas. Aguardando confirmação.`
        };
      }
    } else if (tRes.status !== 404) {
      return { success: false, status: 'PROCESSING', error: `Erro HTTP ${tRes.status} ao consultar Asaas.` };
    }
  } catch (chkErr: any) {
    console.warn(`[executeSubaccountPixPayout] Falha de rede ao consultar Master -> Subconta:`, chkErr);
    return { success: false, status: 'PROCESSING', error: 'Falha temporária de rede ao consultar o Asaas.' };
  }

  // 4. Transferência interna confirmada (DONE)! Disparar Pix da subconta (Tempo 2)

  // 4.1 Buscar parceiro
  const { data: partnerUser, error: pErr } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', requestRow.partner_id)
    .maybeSingle();

  if (pErr || !partnerUser) {
    return { success: false, status: 'PROCESSING', error: 'Parceiro não encontrado para envio do Pix.' };
  }

  // 4.2 Buscar chave da subconta em partner_secrets
  const { data: secretRow } = await adminSupabase
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', requestRow.partner_id)
    .maybeSingle();

  const subaccountApiKey = secretRow?.asaas_account_api_key;
  if (!subaccountApiKey) {
    const err = 'Chave da subconta não encontrada em partner_secrets.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({ failure_reason: err })
      .eq('id', requestId);
    return { success: false, status: 'PROCESSING', error: err };
  }

  // 4.3 Calcular tarifa Pix e valor líquido (Opção 1: parceiro arca com taxa de R$ 0,99)
  const { data: psSettings } = await adminSupabase
    .from('platform_settings')
    .select('asaas_pix_fee_fixed')
    .limit(1)
    .maybeSingle();

  const pixFeeFixed = Number(psSettings?.asaas_pix_fee_fixed ?? 0.99);
  const requestedAmount = Number(requestRow.requested_amount || 0);
  const netPixAmount = Number(Math.max(0, requestedAmount - pixFeeFixed).toFixed(2));

  if (netPixAmount <= 0) {
    const err = `Valor do saque (R$ ${requestedAmount.toFixed(2)}) é menor ou igual à tarifa Pix de R$ ${pixFeeFixed.toFixed(2)}.`;
    await adminSupabase
      .from('withdrawal_requests')
      .update({ status: 'FALHOU', failure_reason: err })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: err };
  }

  // 4.4 Construir payload Pix a partir da subconta
  const pixBuild = buildSubaccountPixTransferPayload(
    partnerUser,
    netPixAmount,
    `Saque AçaíFood Pix #${requestId.substring(0, 8)}`
  );

  if (pixBuild.error || !pixBuild.payload) {
    const err = pixBuild.error || 'Erro ao validar chave Pix do parceiro.';
    await adminSupabase
      .from('withdrawal_requests')
      .update({ failure_reason: err })
      .eq('id', requestId);
    return { success: false, status: 'PROCESSING', error: err };
  }

  const subBaseUrl = getAsaasBaseUrl(subaccountApiKey);
  const pixAttemptRef = `${requestRow.transfer_attempt_id || requestId}_PIX`;

  // 4.5 Checagem de idempotência na subconta antes de transferir
  let subaccountPixTransferId = '';
  try {
    const chkPixRes = await fetch(`${subBaseUrl}/transfers?externalReference=${encodeURIComponent(pixAttemptRef)}`, {
      headers: { 'access_token': subaccountApiKey }
    });
    if (chkPixRes.ok) {
      const chkPixData = await chkPixRes.json();
      if (chkPixData?.data && chkPixData.data.length > 0) {
        subaccountPixTransferId = chkPixData.data[0].id;
        console.log(`[executeSubaccountPixPayout] Pix idempotente já existente encontrado: ${subaccountPixTransferId}`);
      }
    }
  } catch (_chkPixErr) {}

  // 4.6 Se não existir, disparar a transferência Pix na subconta
  if (!subaccountPixTransferId) {
    try {
      const pixRes = await fetch(`${subBaseUrl}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': subaccountApiKey
        },
        body: JSON.stringify({
          ...pixBuild.payload,
          externalReference: pixAttemptRef
        })
      });

      const pixData = await pixRes.json().catch(() => null);
      if (pixRes.ok && pixData?.id) {
        subaccountPixTransferId = pixData.id;
        console.log(`[executeSubaccountPixPayout] ✅ Pix da subconta enviado: ID ${pixData.id} | Líquido: R$ ${netPixAmount} | Destino: ${pixBuild.formattedKey}`);
      } else {
        const pixErr = pixData?.errors?.[0]?.description || pixData?.message || `Erro HTTP ${pixRes.status} no Pix da subconta`;
        console.error(`[executeSubaccountPixPayout] Falha ao disparar Pix na subconta:`, pixErr);
        await adminSupabase
          .from('withdrawal_requests')
          .update({ failure_reason: `Transferência interna concluída. Falha no envio Pix externo: ${pixErr}` })
          .eq('id', requestId);

        return {
          success: false,
          status: 'PROCESSING',
          error: `Crédito na subconta realizado, mas envio do Pix retornou: ${pixErr}`
        };
      }
    } catch (dispErr: any) {
      console.error(`[executeSubaccountPixPayout] Exceção ao disparar Pix:`, dispErr);
      return {
        success: false,
        status: 'PROCESSING',
        error: `Exceção de rede no envio Pix da subconta: ${dispErr?.message || dispErr}`
      };
    }
  }

  // 5. Finalização: atualizar para PAGO, baixar pedidos e registrar no ledger
  const nowIso = new Date().toISOString();
  const effectivePixKey = pixBuild.formattedKey || partnerUser.pix_key || partnerUser.cpf_cnpj;
  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());

  await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PAGO',
      paid_at: nowIso,
      failure_reason: null,
      pix_key_used: effectivePixKey || null
    })
    .eq('id', requestId);

  // Baixar pedidos no banco
  if (Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0) {
    const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
    await adminSupabase
      .from('orders')
      .update(updateField)
      .in('id', requestRow.order_ids);
  }

  // Inserir registro no extrato / ledger
  try {
    const { data: history } = await adminSupabase
      .from('partner_ledger')
      .select('amount, type')
      .eq('partner_id', requestRow.partner_id);

    const currentBal = (history || []).reduce((acc: number, item: any) => {
      return item.type === 'credit' ? acc + Number(item.amount || 0) : acc - Number(item.amount || 0);
    }, 0);

    const newBal = Math.max(0, currentBal - requestedAmount);

    await adminSupabase.from('partner_ledger').insert({
      partner_id: requestRow.partner_id,
      type: 'debit',
      amount: requestedAmount,
      balance_after: newBal,
      description: `Saque finalizado #${requestId.substring(0, 8)} via Pix Asaas (Subconta -> Pix: ${subaccountPixTransferId})`
    });
  } catch (_lErr) {}

  await logAdminAction({
    actorId: requestRow.reviewed_by || null,
    action: 'WITHDRAWAL_STAGE2_PIX_COMPLETED',
    targetType: 'WITHDRAWAL_REQUEST',
    targetId: requestId,
    beforeState: { status: 'PROCESSING', amount: requestedAmount },
    afterState: {
      status: 'PAGO',
      masterTransferId,
      subaccountPixTransferId,
      netPixAmount,
      pixFeeFixed,
      pixKeyUsed: effectivePixKey
    }
  });

  return {
    success: true,
    status: 'PAGO',
    netAmount: netPixAmount,
    pixFee: pixFeeFixed,
    pixTransferId: subaccountPixTransferId,
    pixKeyUsed: effectivePixKey,
    message: `Saque liquidado com sucesso! R$ ${netPixAmount.toFixed(2)} transferidos via Pix para ${effectivePixKey} (Taxa Asaas: R$ ${pixFeeFixed.toFixed(2)}).`
  };
}

