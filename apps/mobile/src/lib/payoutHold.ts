import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlatformConfig } from '@/lib/platformConfig';

/**
 * R34 — Bloqueio de saque por troca de chave Pix / CPF / CNPJ.
 * Um gatilho no banco marca users.payout_hold = true quando o próprio parceiro troca a chave
 * Pix, o tipo da chave ou o CPF/CNPJ. Enquanto estiver marcado, NENHUM saque é pago
 * (nem na hora, nem no horário, nem por aprovação manual). Só o admin libera, depois de
 * confirmar a troca com o parceiro por e-mail ou pelo suporte.
 */

export const PAYOUT_HOLD_MESSAGE =
  'Saques suspensos por segurança: a chave Pix ou o CPF/CNPJ da conta foi alterado. ' +
  'Fale com o suporte do AçaíFood (chat do app ou appsolutions76@gmail.com) para confirmar a troca e liberar os saques.';

export interface PayoutHoldInfo {
  hold: boolean;
  reason: string | null;
  since: string | null;
}

export async function getPayoutHold(userId: string): Promise<PayoutHoldInfo> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .select('payout_hold, payout_hold_reason, payout_hold_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { hold: false, reason: null, since: null }; // migration R34 ainda não aplicada
    return {
      hold: data?.payout_hold === true,
      reason: data?.payout_hold_reason || null,
      since: data?.payout_hold_at || null
    };
  } catch (_e) {
    return { hold: false, reason: null, since: null };
  }
}

/** Saque na hora: paga assim que o parceiro pede (sem aprovação do admin). */
export async function isInstantPayoutEnabled(): Promise<boolean> {
  const cfg = await getPlatformConfig<{ enabled?: boolean }>('instant_payout');
  return cfg?.enabled === true;
}
