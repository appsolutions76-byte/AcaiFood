import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasBaseUrl } from '@/lib/asaasConfig';

// Situação da subconta Asaas (docs.asaas.com → "Detalhamento do fluxo de aprovação
// de subcontas"). A conta só está aprovada quando `general === 'APPROVED'`.
export type AsaasStepStatus = 'APPROVED' | 'AWAITING_APPROVAL' | 'PENDING' | 'REJECTED' | string;

export interface AsaasAccountStatusDetail {
  commercialInfo?: AsaasStepStatus;
  bankAccountInfo?: AsaasStepStatus;
  documentation?: AsaasStepStatus;
  general?: AsaasStepStatus;
}

// Converte o objeto accountStatus do Asaas no status interno do app.
export function mapGeneralStatus(detail: AsaasAccountStatusDetail | null | undefined): string | null {
  if (!detail || !detail.general) return null;
  const general = String(detail.general).toUpperCase();
  if (general === 'APPROVED') return 'APPROVED';
  if (general === 'REJECTED') return 'REJECTED';
  if (general === 'AWAITING_APPROVAL') return 'AWAITING_APPROVAL';
  // PENDING: ainda falta algo do titular (normalmente documentos)
  const documentation = String(detail.documentation || '').toUpperCase();
  if (documentation === 'PENDING' || documentation === 'REJECTED') return 'PENDING_DOCUMENTS';
  return 'PENDING';
}

// Grava o status no banco. split_enabled só é verdadeiro com aprovação geral.
export async function saveAccountStatus(
  userId: string,
  detail: AsaasAccountStatusDetail,
  source: string
): Promise<{ status: string | null; changed: boolean }> {
  const supabase = getSupabaseAdmin();
  const newStatus = mapGeneralStatus(detail);
  if (!newStatus) return { status: null, changed: false };

  const { data: before } = await supabase
    .from('users')
    .select('asaas_account_status')
    .eq('id', userId)
    .maybeSingle();

  const cleanDetail = {
    commercialInfo: detail.commercialInfo ?? null,
    bankAccountInfo: detail.bankAccountInfo ?? null,
    documentation: detail.documentation ?? null,
    general: detail.general ?? null,
    source,
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase
    .from('users')
    .update({
      asaas_account_status: newStatus,
      split_enabled: newStatus === 'APPROVED',
      asaas_account_status_detail: cleanDetail
    })
    .eq('id', userId);

  if (error) {
    // Coluna de detalhe ainda não criada (migration 20261006030000): grava só o status
    await supabase
      .from('users')
      .update({ asaas_account_status: newStatus, split_enabled: newStatus === 'APPROVED' })
      .eq('id', userId);
  }

  const changed = before?.asaas_account_status !== newStatus;
  if (changed) {
    try {
      await supabase.from('admin_audit_log').insert({
        actor_id: null,
        action: 'ASAAS_ACCOUNT_STATUS_CHANGE',
        target_type: 'USER',
        target_id: userId,
        before_state: { status: before?.asaas_account_status ?? null },
        after_state: { status: newStatus, detail: cleanDetail },
        ip_address: null,
        user_agent: source
      });
    } catch (_e) {}
  }

  return { status: newStatus, changed };
}

// Consulta GET /v3/myAccount/status com a chave da própria subconta.
export async function fetchAndSaveAccountStatus(userId: string, source: string): Promise<{ status: string | null; detail?: AsaasAccountStatusDetail; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: secretRow } = await supabase
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', userId)
    .maybeSingle();

  const apiKey = secretRow?.asaas_account_api_key;
  if (!apiKey) {
    return { status: null, error: 'Chave da subconta indisponível' };
  }

  try {
    const res = await fetch(`${getAsaasBaseUrl(apiKey)}/myAccount/status`, {
      headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      return { status: null, error: `Asaas respondeu ${res.status}` };
    }
    const detail = await res.json() as AsaasAccountStatusDetail;
    const saved = await saveAccountStatus(userId, detail, source);
    return { status: saved.status, detail };
  } catch (_e) {
    return { status: null, error: 'Falha de rede ao consultar o Asaas' };
  }
}
