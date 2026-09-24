import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { buildAsaasTransferPayload } from '@/lib/asaasTransferHelpers';

export interface ProcessApprovalResult {
  success: boolean;
  status: 'PAGO' | 'FALHOU' | 'REJEITADO';
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

  // 1. Trava atômica (P5): Tentar atualizar status para 'APROVADO' de forma atômica
  const { data: lockRow, error: lockErr } = await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'APROVADO',
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
    .single();

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

  // 3. Revalidar subconta/status Asaas do parceiro (P2)
  const isAccountActive = partnerUser.split_enabled === true || 
                          partnerUser.asaas_account_status === 'APPROVED' || 
                          Boolean(partnerUser.asaas_wallet_id || partnerUser.pix_key || partnerUser.cpf_cnpj);
  if (partnerUser.asaas_account_status === 'REJECTED' || !isAccountActive) {
    const failMsg = partnerUser.asaas_account_status === 'REJECTED'
      ? 'A subconta do parceiro no Asaas foi rejeitada pela instituição financeira.'
      : 'A subconta do parceiro no Asaas ainda não está aprovada/ativa (split_enabled desativado).';

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
  
  const finalAmount = requestedAmount > 0 ? requestedAmount : balanceResult.totalDisponivel;
  const finalOrderIds = (Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0)
    ? requestRow.order_ids 
    : balanceResult.orderIds;

  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());

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

  // 5. Resolver payload de transferência Asaas (exclusivamente do cadastro do banco)
  const transferPayload = buildAsaasTransferPayload(
    partnerUser,
    finalAmount,
    `Saque AçaíFood - Solicitação ${requestId.substring(0, 8)}`
  );

  if (!transferPayload) {
    const failMsg = 'Nenhuma chave Pix (CPF, CNPJ, e-mail, telefone) ou WalletId cadastrada no perfil do parceiro.';
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

  // 6. Realizar transferência via API Asaas unificada
  let asaasTransferId = '';
  let transferStatus = '';
  let apiSuccess = false;
  let apiErrorMsg = '';

  const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
  const asaasApiKey = await getAsaasApiKey();
  const baseUrl = getAsaasBaseUrl(asaasApiKey);
  const isSandbox = baseUrl.includes('sandbox');
  const keySuffix = asaasApiKey.length >= 4 ? asaasApiKey.slice(-4) : 'none';
  console.log(`[WithdrawalApproval] Processando saque #${requestId.substring(0, 8)} | Ambiente: ${isSandbox ? 'Sandbox' : 'Produção'} | Chave: ***${keySuffix}`);

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

  // 6.1 Pré-validação de saldo disponível na conta Asaas
  try {
    const balRes = await fetch(`${baseUrl}/finance/balance`, {
      headers: { 'access_token': asaasApiKey }
    });
    if (balRes.ok) {
      const balData = await balRes.json();
      const currentAsaasBalance = typeof balData.balance === 'number' ? balData.balance : (typeof balData.totalBalance === 'number' ? balData.totalBalance : null);
      if (currentAsaasBalance !== null && currentAsaasBalance < finalAmount) {
        const failMsg = 'Saldo insuficiente na conta Asaas';
        console.warn(`[WithdrawalApproval] Saldo insuficiente no Asaas. Disponível: R$ ${currentAsaasBalance}, Solicitado: R$ ${finalAmount}`);
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
  } catch (balErr) {
    console.warn('[WithdrawalApproval] Aviso ao consultar saldo Asaas:', balErr);
  }

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

  // 7. Em caso de Sucesso ou Processamento no Asaas
  if (apiSuccess) {
    const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier'].includes(String(requestRow.role || partnerUser.role).toLowerCase());
    const isDone = transferStatus === 'DONE' || transferStatus === 'COMPLETED' || transferStatus === 'CONFIRMED';
    const finalRequestStatus = isDone ? 'PAGO' : 'PROCESSING';
    
    // Atualizar status da solicitação
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

    // Marcar pedidos cobertos como pagos se transferência liquidada
    if (isDone && finalOrderIds.length > 0) {
      const updateField = isDriver ? { payout_driver_done: true } : { payout_seller_done: true };
      await adminSupabase
        .from('orders')
        .update(updateField)
        .in('id', finalOrderIds);
    }

    // Registrar extrato/ledger respeitando os CHECK constraints (P4)
    try {
      const { data: history } = await adminSupabase
        .from('partner_ledger')
        .select('amount, type')
        .eq('partner_id', requestRow.partner_id);

      const currentBal = (history || []).reduce((acc: number, item: any) => {
        return item.type === 'credit' ? acc + Number(item.amount || 0) : acc - Number(item.amount || 0);
      }, 0);

      const balanceAfter = Number(Math.max(0, currentBal - finalAmount).toFixed(2));

      await adminSupabase
        .from('partner_ledger')
        .insert({
          partner_id: requestRow.partner_id,
          order_id: finalOrderIds?.[0] || null,
          amount: finalAmount,
          type: 'debit',
          reason: `Saque ${isDone ? 'processado' : 'enviado'} Pix Asaas (ID: ${asaasTransferId})`,
          balance_after: balanceAfter
        });
    } catch (lErr) {
      console.warn("Aviso ao registrar débito em partner_ledger:", lErr);
    }

    return {
      success: true,
      status: finalRequestStatus as any,
      transferId: asaasTransferId,
      amount: finalAmount,
      message: isDone 
        ? `Saque de R$ ${finalAmount.toFixed(2)} processado e liquidado com sucesso via Pix Asaas!`
        : `Transferência de R$ ${finalAmount.toFixed(2)} enviada ao Asaas (Status: ${transferStatus}). Aguardando liquidação bancária.`
    };
  }

  // 8. Em caso de Falha no Asaas
  await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'FALHOU',
      requested_amount: finalAmount,
      order_ids: finalOrderIds,
      failure_reason: apiErrorMsg,
      reviewed_by: actorId,
      reviewed_at: nowIso,
      processed_automatically: (actorId === null)
    })
    .eq('id', requestId);

  return {
    success: false,
    status: 'FALHOU',
    error: `Falha ao transferir via Asaas: ${apiErrorMsg}`
  };
}
