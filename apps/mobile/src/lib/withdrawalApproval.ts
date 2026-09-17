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

  // 1. Buscar a solicitação pelo ID
  const { data: requestRow, error: reqErr } = await adminSupabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqErr || !requestRow) {
    return { success: false, status: 'FALHOU', error: 'Solicitação de saque não encontrada.' };
  }

  if (requestRow.status !== 'PENDENTE' && requestRow.status !== 'FALHOU') {
    return {
      success: false,
      status: requestRow.status as any,
      error: `Solicitação já processada anteriormente (status atual: ${requestRow.status}).`
    };
  }

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

  // 3. Revalidar subconta/status Asaas do parceiro se houver restrição
  if (partnerUser.asaas_account_status && partnerUser.asaas_account_status === 'REJECTED') {
    const failMsg = 'A subconta do parceiro no Asaas foi rejeitada pela instituição financeira.';
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

  // 4. Recalcular o saldo disponível no exato momento da aprovação
  const balanceResult = await getPartnerAvailableBalance(requestRow.partner_id, requestRow.role || partnerUser.role);
  const finalAmount = balanceResult.totalDisponivel > 0 ? balanceResult.totalDisponivel : Number(requestRow.requested_amount || 0);
  const finalOrderIds = balanceResult.orderIds.length > 0 ? balanceResult.orderIds : (requestRow.order_ids || []);

  if (finalAmount <= 0) {
    const failMsg = 'Nenhum valor pendente elegível para saque neste momento.';
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

    // Tentar registrar extrato/ledger se existir a tabela partner_ledger
    try {
      await adminSupabase
        .from('partner_ledger')
        .insert({
          partner_id: requestRow.partner_id,
          amount: -finalAmount,
          description: `Saque processado Pix Asaas (ID: ${asaasTransferId})`,
          type: 'WITHDRAWAL',
          reference_id: requestId
        });
    } catch (_) {}

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
