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

  // 6. Realizar transferência via API Asaas
  let asaasTransferId = '';
  let apiSuccess = false;
  let apiErrorMsg = '';

  try {
    const asaasApiKey = process.env.ASAAS_API_KEY || '';
    const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'production';
    const baseUrl = asaasEnv === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';

    if (!asaasApiKey) {
      throw new Error('Chave ASAAS_API_KEY não configurada no servidor.');
    }

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
    } else {
      apiErrorMsg = data?.errors?.[0]?.description || data?.message || 'Erro na resposta do Asaas ao efetuar transferência';
    }
  } catch (err: any) {
    apiErrorMsg = err.message || 'Exceção de rede ao comunicar com Asaas';
  }

  const nowIso = new Date().toISOString();

  // 7. Em caso de Sucesso
  if (apiSuccess) {
    const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier'].includes(String(requestRow.role || partnerUser.role).toLowerCase());
    
    // Atualizar status da solicitação
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'PAGO',
        requested_amount: finalAmount,
        order_ids: finalOrderIds,
        asaas_transfer_id: asaasTransferId,
        pix_key_used: transferPayload.pixAddressKey || null,
        wallet_id_used: transferPayload.walletId || null,
        paid_at: nowIso,
        reviewed_by: actorId,
        reviewed_at: nowIso,
        processed_automatically: (actorId === null)
      })
      .eq('id', requestId);

    // Marcar pedidos cobertos como pagos
    if (finalOrderIds.length > 0) {
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
          reason: `Saque processado Pix Asaas (ID: ${asaasTransferId})`,
          balance_after: balanceAfter
        });
    } catch (lErr) {
      console.warn("Aviso ao registrar débito em partner_ledger:", lErr);
    }

    return {
      success: true,
      status: 'PAGO',
      transferId: asaasTransferId,
      amount: finalAmount,
      message: `Saque de R$ ${finalAmount.toFixed(2)} processado com sucesso via Pix Asaas!`
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
