import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { validateAndFormatPixKey } from '@/lib/asaasTransferHelpers';
import { logAdminAction } from '@/lib/adminAudit';
import { getAsaasBaseUrl } from '@/lib/asaasConfig';

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

/**
 * Aprovação Oficial de Saque - Modelo BaaS Integral Estrito de Subcontas (Opção 1 Bacen):
 * 1. O dinheiro NUNCA sai da conta Master (em conformidade com Resoluções BCB 80/2021 e 264/2022).
 * 2. O Pix é debitado DIRETAMENTE da subconta Asaas individualizada do parceiro.
 * 3. O destino é a conta bancária de mesma titularidade (CPF/CNPJ do parceiro).
 * 4. A autorização oficial e auditoria são efetuadas pelo Administrador no Painel do AçaíFood (/admin).
 */
export async function processWithdrawalApproval(
  requestId: string,
  actorId: string | null
): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const attemptId = `ATTEMPT_${requestId}_${Date.now()}`;

  // 1. Trava atômica no banco de dados
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
    return {
      success: false,
      status: 'FALHOU',
      error: lockErr ? `Erro no banco de dados: ${lockErr.message}` : 'Solicitação não encontrada ou em processamento concorrente.'
    };
  }

  const requestRow = lockRow;

  // 2. Buscar parceiro
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
        failure_reason: 'Usuário parceiro não encontrado no banco de dados.',
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    return { success: false, status: 'FALHOU', error: 'Parceiro não encontrado.' };
  }

  // 3. Buscar credenciais da Subconta Asaas em partner_secrets
  const { data: secretRow } = await adminSupabase
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', requestRow.partner_id)
    .maybeSingle();

  const subaccountApiKey = secretRow?.asaas_account_api_key;
  if (!subaccountApiKey) {
    const failMsg = 'Subconta Asaas do parceiro não configurada ou sem chave de API em partner_secrets.';
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

  // 4. Determinar ordens e saldo
  const isDriverRole = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(requestRow.role || partnerUser.role).toLowerCase());
  const requestedAmount = Number(requestRow.requested_amount || 0);
  const balanceResult = await getPartnerAvailableBalance(requestRow.partner_id, requestRow.role || partnerUser.role);
  const hasExplicitOrders = Array.isArray(requestRow.order_ids) && requestRow.order_ids.length > 0;
  const finalOrderIds = hasExplicitOrders ? requestRow.order_ids : balanceResult.orderIds;

  // 5. Consultar saldo REAL na subconta Asaas em tempo real
  const subBaseUrl = getAsaasBaseUrl(subaccountApiKey);
  let subBalance = 0;
  try {
    const balRes = await fetch(`${subBaseUrl}/finance/balance`, {
      headers: { 'access_token': subaccountApiKey }
    });
    if (balRes.ok) {
      const balData = await balRes.json();
      subBalance = Number(balData.balance || 0);
    }
  } catch (balErr: any) {
    console.warn('[processWithdrawalApproval] Falha ao consultar saldo da subconta Asaas:', balErr);
  }

  console.log(`[WithdrawalApproval Subconta] Parceiro ${partnerUser.name} | Solicitado: R$ ${requestedAmount} | Saldo Subconta Asaas: R$ ${subBalance}`);

  if (subBalance <= 0) {
    const failMsg = `A subconta Asaas do parceiro possui saldo de R$ 0,00. Aguarde a compensação dos pagamentos na subconta.`;
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

  // Tarifa Pix Asaas (R$ 0,99 por transferência bancária externa da subconta)
  const { data: psSettings } = await adminSupabase
    .from('platform_settings')
    .select('asaas_pix_fee_fixed')
    .limit(1)
    .maybeSingle();

  const pixFeeFixed = Number(psSettings?.asaas_pix_fee_fixed ?? 0.99);
  const grossAmount = Math.min(requestedAmount > 0 ? requestedAmount : subBalance, subBalance);
  const netPixAmount = Number(Math.max(0, grossAmount - pixFeeFixed).toFixed(2));

  if (netPixAmount <= 0) {
    const failMsg = `O saldo disponível (R$ ${grossAmount.toFixed(2)}) é insuficiente para cobrir a tarifa Pix do Asaas (R$ ${pixFeeFixed.toFixed(2)}).`;
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

  // 6. Validar Chave Pix do Parceiro (Mesma Titularidade Bacen)
  const rawKey = String(partnerUser.pix_key || partnerUser.pixKey || partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').trim();
  const validated = validateAndFormatPixKey(rawKey, partnerUser.pix_key_type || partnerUser.pixKeyType);

  if (!validated.valid || !validated.formattedKey) {
    const failMsg = `Chave Pix inválida no cadastro do parceiro: ${validated.error || 'Não formatada'}`;
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

  // 7. Checagem de Idempotência na Subconta antes de transferir
  const pixAttemptRef = `${attemptId}_PIX`;
  let existingTransferId: string | null = null;
  try {
    const chkRes = await fetch(`${subBaseUrl}/transfers?externalReference=${encodeURIComponent(pixAttemptRef)}`, {
      headers: { 'access_token': subaccountApiKey }
    });
    if (chkRes.ok) {
      const chkData = await chkRes.json();
      if (chkData?.data && chkData.data.length > 0) {
        existingTransferId = chkData.data[0].id;
      }
    }
  } catch (_cErr) {}

  let transferId = existingTransferId;

  // 8. Disparar a Transferência Pix DIRETO DA SUBCONTA DO PARCEIRO
  if (!transferId) {
    const pixPayload = {
      value: netPixAmount,
      operationType: 'PIX',
      pixAddressKey: validated.formattedKey,
      pixAddressKeyType: validated.type,
      description: `Saque AçaíFood Pix #${requestId.substring(0, 8)}`,
      externalReference: pixAttemptRef
    };

    try {
      const pixRes = await fetch(`${subBaseUrl}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': subaccountApiKey
        },
        body: JSON.stringify(pixPayload)
      });

      const pixData = await pixRes.json().catch(() => null);

      if (pixRes.ok && pixData?.id) {
        transferId = pixData.id;
        console.log(`[processWithdrawalApproval Subconta] ✅ Pix enviado com sucesso da subconta: ID ${pixData.id} | Líquido: R$ ${netPixAmount} | Status: ${pixData.status}`);
      } else {
        const errMsg = pixData?.errors?.[0]?.description || pixData?.message || `Erro HTTP ${pixRes.status} no Asaas da subconta`;
        console.error(`[processWithdrawalApproval Subconta] ❌ Falha na subconta Asaas:`, errMsg, pixData);
        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'FALHOU',
            failure_reason: `Erro Asaas Subconta: ${errMsg}`,
            reviewed_by: actorId,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);
        return { success: false, status: 'FALHOU', error: `Falha na subconta Asaas: ${errMsg}` };
      }
    } catch (netErr: any) {
      const errMsg = netErr?.message || 'Erro de conexão com Asaas da subconta';
      await adminSupabase
        .from('withdrawal_requests')
        .update({
          status: 'PROCESSING',
          failure_reason: `A confirmar: ${errMsg}`,
          reviewed_by: actorId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);
      return { success: false, status: 'PROCESSING', error: errMsg };
    }
  }

  // 9. Atualizar para PAGO e liquidar pedidos correspondentes
  const nowIso = new Date().toISOString();
  await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PAGO',
      asaas_transfer_id: transferId,
      requested_amount: grossAmount,
      order_ids: finalOrderIds,
      pix_key_used: validated.formattedKey,
      paid_at: nowIso,
      reviewed_by: actorId,
      reviewed_at: nowIso,
      failure_reason: null
    })
    .eq('id', requestId);

  if (Array.isArray(finalOrderIds) && finalOrderIds.length > 0) {
    const updateField = isDriverRole ? { payout_driver_done: true } : { payout_seller_done: true };
    await adminSupabase.from('orders').update(updateField).in('id', finalOrderIds);
  }

  // Gravar registro de débito no ledger
  try {
    await adminSupabase.from('partner_ledger').insert({
      partner_id: requestRow.partner_id,
      type: 'debit',
      amount: grossAmount,
      description: `Saque finalizado #${requestId.substring(0, 8)} via Pix da Subconta Asaas (ID: ${transferId})`
    });
  } catch (_lErr) {}

  await logAdminAction({
    actorId,
    action: 'WITHDRAWAL_SUBCONTO_PIX_SUCCESS',
    targetType: 'WITHDRAWAL_REQUEST',
    targetId: requestId,
    beforeState: { status: 'PENDENTE', amount: grossAmount },
    afterState: {
      status: 'PAGO',
      transferId,
      netPixAmount,
      pixFeeFixed,
      pixKeyUsed: validated.formattedKey,
      subaccountApiKeySuffix: subaccountApiKey.slice(-4)
    }
  });

  return {
    success: true,
    status: 'PAGO',
    transferId: transferId || undefined,
    amount: grossAmount,
    netAmount: netPixAmount,
    pixFee: pixFeeFixed,
    pixKeyUsed: validated.formattedKey,
    message: `Saque de R$ ${grossAmount.toFixed(2)} aprovado com sucesso! R$ ${netPixAmount.toFixed(2)} transferidos via Pix diretamente da subconta Asaas do parceiro para o banco dele (Taxa Asaas: R$ ${pixFeeFixed.toFixed(2)}).`
  };
}

/**
 * Reconciliação / Consulta de Status de Saque da Subconta
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

  return processWithdrawalApproval(requestId, requestRow.reviewed_by || null);
}
