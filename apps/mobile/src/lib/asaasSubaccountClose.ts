import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

/**
 * Encerramento e desvínculo de subconta Asaas (troca das subcontas antigas pelo modelo BaaS).
 *
 * Asaas (docs.asaas.com):
 *  - Subconta BaaS (o app tem a chave dela): DELETE /v3/myAccount/?removeReason=...
 *    autenticado com a chave da PRÓPRIA subconta. Recusa se houver saldo, saque/cobrança
 *    pendente etc. Irreversível.
 *  - Subconta não-BaaS (antiga, sem chave no app): DELETE /v3/accounts/{id} com a chave da
 *    conta-pai. Só funciona se a subconta foi criada há menos de 48 h, nunca fez login,
 *    o recurso estiver habilitado no painel e o IP estiver na whitelist. Fora disso,
 *    o encerramento é feito pelo suporte do Asaas.
 *
 * O vínculo no banco só é removido quando o Asaas confirma o encerramento (closeSubaccount)
 * ou quando o admin declara que o Asaas já encerrou a conta (unlinkSubaccount).
 */

const OPEN_WITHDRAWAL_STATUSES = ['PENDENTE', 'APROVADO', 'PROCESSING'];
const PARTNER_ROLES = ['PARTNER', 'LOJA', 'BATEDEIRA', 'SUPPLIER', 'FORNECEDOR', 'COURIER', 'MOTOBOY', 'MOTORISTA', 'DRIVER', 'CAMINHAO'];

export interface SubaccountUser {
  id: string;
  role: string | null;
  asaas_account_id: string | null;
  asaas_wallet_id: string | null;
  asaas_account_status: string | null;
}

export async function loadSubaccountUser(userId: string): Promise<SubaccountUser | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('id, role, asaas_account_id, asaas_wallet_id, asaas_account_status')
    .eq('id', userId)
    .maybeSingle();
  return (data as SubaccountUser) || null;
}

// Saque em aberto impede trocar a subconta (o dinheiro iria para a conta encerrada).
export async function countOpenWithdrawals(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from('withdrawal_requests')
    .select('id', { count: 'exact', head: true })
    .eq('partner_id', userId)
    .in('status', OPEN_WITHDRAWAL_STATUSES);
  return count || 0;
}

async function asaasErrorText(res: Response): Promise<string> {
  const body: any = await res.json().catch(() => null);
  const desc = Array.isArray(body?.errors) ? body.errors.map((e: any) => e?.description).filter(Boolean).join(', ') : '';
  return desc || `Asaas respondeu ${res.status}`;
}

export type CloseResult =
  | { ok: true; mode: 'baas' | 'parent'; accountId: string }
  | { ok: false; mode: 'baas' | 'parent' | 'none'; accountId: string; error: string; httpStatus: number };

// Pede ao Asaas o encerramento. NÃO mexe no banco.
export async function closeSubaccountInAsaas(user: SubaccountUser, removeReason: string): Promise<CloseResult> {
  const accountId = String(user.asaas_account_id || '');
  if (!accountId) {
    return { ok: false, mode: 'none', accountId, error: 'Usuário sem subconta Asaas vinculada.', httpStatus: 400 };
  }

  const supabase = getSupabaseAdmin();
  const { data: secret } = await supabase
    .from('partner_secrets')
    .select('asaas_account_api_key')
    .eq('user_id', user.id)
    .maybeSingle();
  const subKey = String(secret?.asaas_account_api_key || '');

  try {
    if (subKey) {
      const url = `${getAsaasBaseUrl(subKey)}/myAccount/?removeReason=${encodeURIComponent(removeReason.slice(0, 200))}`;
      const res = await fetch(url, { method: 'DELETE', headers: { access_token: subKey, 'Content-Type': 'application/json' } });
      if (res.ok) return { ok: true, mode: 'baas', accountId };
      return {
        ok: false, mode: 'baas', accountId, httpStatus: 409,
        error: `O Asaas recusou o encerramento: ${await asaasErrorText(res)}. Confira se a subconta tem saldo, saque ou cobrança pendente.`
      };
    }

    const parentKey = await getAsaasApiKey();
    if (!parentKey) {
      return { ok: false, mode: 'parent', accountId, error: 'ASAAS_API_KEY não configurada no ambiente.', httpStatus: 500 };
    }
    const res = await fetch(`${getAsaasBaseUrl(parentKey)}/accounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE',
      headers: { access_token: parentKey, 'Content-Type': 'application/json' }
    });
    if (res.ok) return { ok: true, mode: 'parent', accountId };
    return {
      ok: false, mode: 'parent', accountId, httpStatus: 409,
      error: `O Asaas recusou o encerramento (${await asaasErrorText(res)}). Subcontas antigas (criadas antes do BaaS) com mais de 48 h só são encerradas pelo suporte do Asaas. Peça o encerramento ao Asaas e depois use "Desvincular (já encerrada no Asaas)".`
    };
  } catch (_e) {
    return { ok: false, mode: subKey ? 'baas' : 'parent', accountId, error: 'Falha de rede ao falar com o Asaas.', httpStatus: 502 };
  }
}

// Remove o vínculo da subconta no banco. Parceiro volta a "sem subconta" e abre uma nova
// (modelo BaaS) pelo cartão "Minha conta Asaas".
export async function unlinkSubaccount(user: SubaccountUser): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const isPartner = PARTNER_ROLES.includes(String(user.role || '').toUpperCase());
  const { error } = await supabase
    .from('users')
    .update({
      asaas_account_id: null,
      asaas_wallet_id: null,
      asaas_account_status: isPartner ? 'PENDING_DOCUMENTS' : null,
      asaas_account_status_detail: null,
      split_enabled: false
    })
    .eq('id', user.id);
  if (error) return { ok: false, error: 'Erro ao remover o vínculo no banco.' };

  await supabase.from('partner_secrets').delete().eq('user_id', user.id);
  return { ok: true };
}
