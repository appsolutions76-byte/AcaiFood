import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateAndFormatPixKey } from '@/lib/asaasTransferHelpers';
import { logAdminAction } from '@/lib/adminAudit';
import { getAsaasBaseUrl } from '@/lib/asaasConfig';
import { settlePendingOrdersForPartner } from '@/lib/orderSettlements';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import {
  findTransferByExternalRef,
  getTransferById,
  isTransferDone,
  isTransferFailed,
  describeAsaasError
} from '@/lib/asaasTransferLookup';

export interface ProcessApprovalResult {
  success: boolean;
  status: 'PAGO' | 'PROCESSING' | 'FALHOU' | 'REJEITADO' | 'PENDENTE';
  transferId?: string;
  amount?: number;
  netAmount?: number;
  pixFee?: number;
  pixKeyUsed?: string;
  message?: string;
  error?: string;
}

const DRIVER_ROLES = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'];
// Saque em PROCESSING sem Pix localizado no Asaas é liberado para nova aprovação depois disso
const STALE_PROCESSING_MS = 30 * 60 * 1000;

/** Referência fixa por solicitação: a mesma em todas as tentativas, para o Asaas nunca receber dois Pix do mesmo saque. */
export function withdrawalExternalRef(requestId: string): string {
  return `WD_${requestId}`;
}

function candidateRefs(row: any): string[] {
  const refs = [withdrawalExternalRef(row.id)];
  // Saques antigos usavam ATTEMPT_<id>_<timestamp>_PIX
  const legacy = String(row.transfer_attempt_id || '');
  if (legacy.startsWith('ATTEMPT_')) refs.push(`${legacy}_PIX`);
  return refs;
}

async function getSubaccountKey(partnerId: string): Promise<string | null> {
  const adminSupabase = getSupabaseAdmin();
  const { data } = await adminSupabase
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', partnerId)
    .maybeSingle();
  return data?.asaas_account_api_key || null;
}

async function failRequest(requestId: string, reason: string, actorId: string | null) {
  const adminSupabase = getSupabaseAdmin();
  await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'FALHOU',
      failure_reason: reason,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .neq('status', 'PAGO');
}

/**
 * Marca o saque como PAGO uma única vez (update condicional) e só então grava o débito no ledger e o log.
 */
async function finalizeWithdrawalPaid(requestId: string, transfer: any, actorId: string | null): Promise<boolean> {
  const adminSupabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: updated } = await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PAGO',
      asaas_transfer_id: transfer?.id || null,
      paid_at: nowIso,
      failure_reason: null
    })
    .eq('id', requestId)
    .neq('status', 'PAGO')
    .select('id, partner_id, requested_amount, pix_key_used')
    .maybeSingle();

  if (!updated) return false;

  try {
    await adminSupabase.from('partner_ledger').insert({
      partner_id: updated.partner_id,
      type: 'debit',
      amount: Number(updated.requested_amount || 0),
      description: `Saque #${requestId.substring(0, 8)} pago via Pix da subconta Asaas (ID: ${transfer?.id})`
    });
  } catch (_lErr) {}

  await logAdminAction({
    actorId,
    action: 'WITHDRAWAL_SUBCONTO_PIX_SUCCESS',
    targetType: 'WITHDRAWAL_REQUEST',
    targetId: requestId,
    beforeState: { status: 'PROCESSING' },
    afterState: {
      status: 'PAGO',
      transferId: transfer?.id,
      value: transfer?.value,
      pixKeyUsed: updated.pix_key_used
    }
  });
  return true;
}

async function applyPixState(row: any, transfer: any, actorId: string | null): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const transferId = String(transfer?.id || '');

  if (isTransferDone(transfer?.status)) {
    await finalizeWithdrawalPaid(row.id, transfer, actorId);
    return { success: true, status: 'PAGO', transferId, message: 'Pix confirmado pelo Asaas.' };
  }

  if (isTransferFailed(transfer?.status)) {
    const reason = transfer?.failReason || `Pix ${String(transfer?.status).toLowerCase()} no Asaas`;
    await adminSupabase
      .from('withdrawal_requests')
      .update({ status: 'FALHOU', failure_reason: reason, asaas_transfer_id: transferId || null, reviewed_at: new Date().toISOString() })
      .eq('id', row.id)
      .neq('status', 'PAGO');
    return { success: false, status: 'FALHOU', transferId, error: reason };
  }

  await adminSupabase
    .from('withdrawal_requests')
    .update({ status: 'PROCESSING', asaas_transfer_id: transferId || null, failure_reason: null })
    .eq('id', row.id)
    .neq('status', 'PAGO');
  return {
    success: true,
    status: 'PROCESSING',
    transferId,
    message: 'Pix enviado ao Asaas e aguardando confirmação. O status muda para PAGO quando o Asaas confirmar.'
  };
}

/**
 * Confirma no Asaas um saque em PROCESSING. NUNCA envia um novo Pix.
 */
export async function reconcileWithdrawal(requestId: string): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const { data: row } = await adminSupabase.from('withdrawal_requests').select('*').eq('id', requestId).maybeSingle();
  if (!row) return { success: false, status: 'FALHOU', error: 'Solicitação não encontrada' };
  if (row.status !== 'PROCESSING') {
    return { success: row.status === 'PAGO', status: row.status, transferId: row.asaas_transfer_id || undefined };
  }

  const subKey = await getSubaccountKey(row.partner_id);
  if (!subKey) {
    return { success: false, status: 'PROCESSING', error: 'Sem chave da subconta para confirmar o Pix' };
  }
  const subBaseUrl = getAsaasBaseUrl(subKey);

  if (row.asaas_transfer_id) {
    const res = await getTransferById(subBaseUrl, subKey, row.asaas_transfer_id);
    if (!res.ok || !res.transfer) return { success: false, status: 'PROCESSING', error: res.error };
    return applyPixState(row, res.transfer, row.reviewed_by || null);
  }

  for (const ref of candidateRefs(row)) {
    const lookup = await findTransferByExternalRef(subBaseUrl, subKey, ref, row.created_at);
    if (!lookup.ok) return { success: false, status: 'PROCESSING', error: lookup.error };
    if (lookup.transfer) return applyPixState(row, lookup.transfer, row.reviewed_by || null);
  }

  const lastTouch = new Date(row.reviewed_at || row.created_at || 0).getTime();
  if (Date.now() - lastTouch > STALE_PROCESSING_MS) {
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'FALHOU',
        failure_reason: 'Nenhum Pix localizado no Asaas para este saque. Pode aprovar novamente com segurança.'
      })
      .eq('id', requestId)
      .eq('status', 'PROCESSING');
    return { success: false, status: 'FALHOU', error: 'Pix não localizado no Asaas' };
  }

  return { success: false, status: 'PROCESSING', message: 'Aguardando confirmação do Asaas.' };
}

/**
 * Aprovação de saque - modelo BaaS de subcontas:
 * 1. O Pix sai DIRETO da subconta Asaas do parceiro (o dinheiro já chegou nela pelos repasses pós-entrega).
 * 2. Destino: chave Pix cadastrada do parceiro.
 * 3. Valor: no máximo o saldo real da subconta; a tarifa Pix do Asaas é descontada do valor enviado.
 * 4. Uma referência fixa por saque (WD_<id>) e consulta prévia no Asaas garantem que não saem dois Pix.
 * 5. O saque só vira PAGO quando o Asaas confirma a transferência.
 */
export async function processWithdrawalApproval(
  requestId: string,
  actorId: string | null
): Promise<ProcessApprovalResult> {
  const adminSupabase = getSupabaseAdmin();
  const externalRef = withdrawalExternalRef(requestId);

  // 1. Trava atômica: só PENDENTE ou FALHOU entram. PROCESSING nunca é reenviado, só confirmado.
  const { data: lockRow, error: lockErr } = await adminSupabase
    .from('withdrawal_requests')
    .update({
      status: 'PROCESSING',
      transfer_attempt_id: externalRef,
      asaas_transfer_id: null,
      failure_reason: null,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      processed_automatically: actorId === null
    })
    .eq('id', requestId)
    .in('status', ['PENDENTE', 'FALHOU'])
    .select('*')
    .maybeSingle();

  if (lockErr) {
    return { success: false, status: 'FALHOU', error: `Erro no banco de dados: ${lockErr.message}` };
  }
  if (!lockRow) {
    const { data: current } = await adminSupabase.from('withdrawal_requests').select('status').eq('id', requestId).maybeSingle();
    if (current?.status === 'PROCESSING') return reconcileWithdrawal(requestId);
    if (!current) return { success: false, status: 'FALHOU', error: 'Solicitação não encontrada.' };
    return { success: current.status === 'PAGO', status: current.status, message: `Solicitação já está ${current.status}.` };
  }

  const requestRow = lockRow;

  // 2. Parceiro
  const { data: partnerUser } = await adminSupabase.from('users').select('*').eq('id', requestRow.partner_id).maybeSingle();
  if (!partnerUser) {
    await failRequest(requestId, 'Usuário parceiro não encontrado no banco de dados.', actorId);
    return { success: false, status: 'FALHOU', error: 'Parceiro não encontrado.' };
  }

  // 3. Chave da subconta
  const subaccountApiKey = await getSubaccountKey(requestRow.partner_id);
  if (!subaccountApiKey) {
    const failMsg = 'Subconta Asaas do parceiro não configurada ou sem chave de API em partner_secrets.';
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }
  const subBaseUrl = getAsaasBaseUrl(subaccountApiKey);

  // 4. Idempotência ANTES de qualquer coisa: se já existe Pix com essa referência, só acompanha
  const prior = await findTransferByExternalRef(subBaseUrl, subaccountApiKey, externalRef, requestRow.created_at);
  if (!prior.ok) {
    const failMsg = `Não foi possível verificar Pix anteriores no Asaas (${prior.error}). Nada foi enviado; tente aprovar novamente.`;
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }
  if (prior.transfer) {
    return applyPixState(requestRow, prior.transfer, actorId);
  }

  // 5. Leva para a subconta os pedidos entregues ainda não repassados (Master → subconta)
  const roleStr = String(requestRow.role || partnerUser.role || '').toLowerCase();
  const isDriverRole = DRIVER_ROLES.includes(roleStr);
  await settlePendingOrdersForPartner(requestRow.partner_id, isDriverRole);

  // 6. Saldo REAL da subconta
  let subBalance: number | null = null;
  try {
    const balRes = await fetch(`${subBaseUrl}/finance/balance`, {
      headers: { access_token: subaccountApiKey },
      cache: 'no-store'
    });
    if (balRes.ok) {
      const balData = await balRes.json();
      if (typeof balData?.balance === 'number') subBalance = Number(balData.balance);
    }
  } catch (balErr: any) {
    console.warn('[processWithdrawalApproval] Falha ao consultar saldo da subconta Asaas:', balErr);
  }

  if (subBalance === null) {
    const failMsg = 'Não foi possível consultar o saldo da subconta no Asaas. Nada foi enviado; tente novamente.';
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }
  if (subBalance <= 0) {
    const failMsg = 'A subconta Asaas do parceiro está com saldo R$ 0,00. Aguarde a confirmação dos repasses.';
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 6.1 Reserva da loja no modelo novo (pedidos pagos não entregues e corridas a pagar)
  let reserved = 0;
  try {
    const bal = await getPartnerAvailableBalance(requestRow.partner_id, requestRow.role || partnerUser.role);
    reserved = Number(bal.reservedBalance || 0);
  } catch (_rErr) {}
  const availableBalance = Number(Math.max(0, subBalance - reserved).toFixed(2));
  if (availableBalance <= 0) {
    const failMsg = `Saldo da subconta (R$ ${subBalance.toFixed(2)}) está reservado para pedidos em andamento e corridas a pagar (R$ ${reserved.toFixed(2)}).`;
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 7. Valores
  const { data: psSettings } = await adminSupabase.from('platform_settings').select('asaas_pix_fee_fixed').limit(1).maybeSingle();
  const pixFeeFixed = Number(psSettings?.asaas_pix_fee_fixed ?? 0.99);
  const requestedAmount = Number(requestRow.requested_amount || 0);
  const grossAmount = Number(Math.min(requestedAmount > 0 ? requestedAmount : availableBalance, availableBalance).toFixed(2));
  const netPixAmount = Number(Math.max(0, grossAmount - pixFeeFixed).toFixed(2));

  if (netPixAmount <= 0) {
    const failMsg = `O saldo disponível (R$ ${grossAmount.toFixed(2)}) é insuficiente para cobrir a tarifa Pix do Asaas (R$ ${pixFeeFixed.toFixed(2)}).`;
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 8. Chave Pix do parceiro
  const rawKey = String(partnerUser.pix_key || partnerUser.pixKey || partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').trim();
  const validated = validateAndFormatPixKey(rawKey, partnerUser.pix_key_type || partnerUser.pixKeyType);
  if (!validated.valid || !validated.formattedKey) {
    const failMsg = `Chave Pix inválida no cadastro do parceiro: ${validated.error || 'Não formatada'}`;
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // 8.1 Mesma titularidade (mandato: só para conta do próprio parceiro)
  const partnerDoc = String(partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').replace(/\D/g, '');
  if (validated.type === 'CPF' || validated.type === 'CNPJ') {
    if (!partnerDoc || validated.formattedKey !== partnerDoc) {
      const failMsg = 'A chave Pix CPF/CNPJ cadastrada é de outro documento. O saque só vai para chave do próprio parceiro.';
      await failRequest(requestId, failMsg, actorId);
      return { success: false, status: 'FALHOU', error: failMsg };
    }
  } else if (String(process.env.PIX_ALLOW_NON_DOCUMENT_KEYS || '').toLowerCase() !== 'true') {
    // E-mail, telefone ou chave aleatória: ainda não há como confirmar o titular antes do envio
    const failMsg = 'Por enquanto o saque só vai para chave Pix CPF/CNPJ do próprio parceiro. Cadastre essa chave na sua conta.';
    await failRequest(requestId, failMsg, actorId);
    return { success: false, status: 'FALHOU', error: failMsg };
  }

  // Grava valor e chave antes de enviar (auditoria)
  await adminSupabase
    .from('withdrawal_requests')
    .update({ requested_amount: grossAmount, pix_key_used: validated.formattedKey })
    .eq('id', requestId);

  // 9. Pix direto da subconta
  let pixRes: Response;
  let pixData: any = null;
  try {
    pixRes = await fetch(`${subBaseUrl}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: subaccountApiKey },
      body: JSON.stringify({
        value: netPixAmount,
        operationType: 'PIX',
        pixAddressKey: validated.formattedKey,
        pixAddressKeyType: validated.type,
        description: `Saque AçaíFood Pix #${requestId.substring(0, 8)}`,
        externalReference: externalRef
      })
    });
    pixData = await pixRes.json().catch(() => null);
  } catch (netErr: any) {
    // Resposta perdida: o Pix pode ter saído. Fica PROCESSING; a reconciliação confirma pela referência fixa.
    const errMsg = netErr?.message || 'Erro de conexão com o Asaas da subconta';
    await adminSupabase
      .from('withdrawal_requests')
      .update({ status: 'PROCESSING', failure_reason: `A confirmar no Asaas: ${errMsg}` })
      .eq('id', requestId);
    return { success: false, status: 'PROCESSING', error: `${errMsg}. O saque fica em processamento até o Asaas confirmar.` };
  }

  if (!pixRes.ok || !pixData?.id) {
    const errMsg = describeAsaasError(pixData, pixRes.status);
    await failRequest(requestId, `Erro Asaas Subconta: ${errMsg}`, actorId);
    return { success: false, status: 'FALHOU', error: `Falha na subconta Asaas: ${errMsg}` };
  }

  console.log(`[processWithdrawalApproval] Pix criado na subconta: ID ${pixData.id} | Líquido R$ ${netPixAmount} | Status ${pixData.status}`);

  const state = await applyPixState(requestRow, pixData, actorId);
  return {
    ...state,
    amount: grossAmount,
    netAmount: netPixAmount,
    pixFee: pixFeeFixed,
    pixKeyUsed: validated.formattedKey,
    message: state.status === 'PAGO'
      ? `Saque de R$ ${grossAmount.toFixed(2)} pago: R$ ${netPixAmount.toFixed(2)} enviados via Pix da subconta Asaas do parceiro (tarifa Asaas: R$ ${pixFeeFixed.toFixed(2)}).`
      : state.status === 'PROCESSING'
        ? `Pix de R$ ${netPixAmount.toFixed(2)} enviado da subconta do parceiro e aguardando confirmação do Asaas (tarifa: R$ ${pixFeeFixed.toFixed(2)}).`
        : state.message
  };
}

/**
 * Mantida por compatibilidade (webhook e reconciliação). Apenas confirma; nunca envia Pix novo.
 */
export async function executeSubaccountPixPayout(requestId: string): Promise<ProcessApprovalResult> {
  return reconcileWithdrawal(requestId);
}

/** Usado por quem só precisa saber se o papel é de entregador. */
export function isDriverRoleName(role?: string | null): boolean {
  return DRIVER_ROLES.includes(String(role || '').toLowerCase());
}
