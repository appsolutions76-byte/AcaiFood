import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * R47 — Grupo de contas do app que usam a MESMA subconta Asaas (mesmo CPF/CNPJ).
 * A conta principal abriu a subconta; as vinculadas usam a mesma subconta depois que a
 * principal aprova o vínculo (tabela payment_account_links).
 * Sem vínculos (ou antes da migration R47), o grupo é só o próprio usuário.
 */
export type AccountGroup = {
  ownerId: string;
  memberIds: string[];
  isOwner: boolean;
  isLinked: boolean;
  canWithdraw: boolean;
  linkId: string | null;
};

const single = (userId: string): AccountGroup => ({
  ownerId: userId, memberIds: [userId], isOwner: true, isLinked: false, canWithdraw: true, linkId: null,
});

export async function getAccountGroup(userId: string): Promise<AccountGroup> {
  if (!userId) return single(userId);
  const sb = getSupabaseAdmin();
  try {
    const { data: mine, error } = await sb
      .from('payment_account_links')
      .select('id, owner_user_id, can_withdraw')
      .eq('linked_user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (error) return single(userId);
    const ownerId = mine?.owner_user_id || userId;
    const { data: members, error: mErr } = await sb
      .from('payment_account_links')
      .select('linked_user_id')
      .eq('owner_user_id', ownerId)
      .eq('status', 'ACTIVE');
    if (mErr) return single(userId);
    const memberIds = Array.from(new Set([ownerId, ...(members || []).map((m: any) => String(m.linked_user_id))]));
    return {
      ownerId,
      memberIds,
      isOwner: ownerId === userId,
      isLinked: Boolean(mine),
      canWithdraw: mine ? Boolean(mine.can_withdraw) : true,
      linkId: mine?.id || null,
    };
  } catch (_e) {
    return single(userId);
  }
}

export const cleanDoc = (v: any) => String(v || '').replace(/\D/g, '');

export function maskEmail(email: string) {
  const e = String(email || '');
  const [u, d] = e.split('@');
  if (!u || !d) return '';
  return `${u.slice(0, 2)}***@${d}`;
}
