import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPlatformConfig } from '@/lib/platformConfig';

/**
 * Validação de saques pelo Asaas (R32 — "Mecanismo de validação de saque via webhook").
 *
 * Quando ativado no Asaas (Integrações > Mecanismos de segurança), o Asaas pergunta ao app,
 * antes de executar, se cada saque/transferência da conta raiz e das subcontas pode sair.
 * O app só aprova o que ele mesmo criou:
 *   - WD_<id>        saque do parceiro (withdrawal_requests)
 *   - <id>           repasse Master → subconta (settlements)
 *   - REFUNDFEE_<id> cobertura da tarifa Pix de um estorno (no máximo a tarifa do pedido)
 * Estornos Pix (voltam para quem pagou) e liquidação de split (definida na cobrança) são aprovados.
 * Qualquer outro saque (ex.: feito por alguém no painel do Asaas) é "desconhecido":
 *   - modo MONITOR (padrão): aprova e registra, para o admin conferir;
 *   - modo ENFORCE: recusa, a não ser que o admin tenha liberado saques manuais por alguns minutos.
 */

export type ValidationMode = 'MONITOR' | 'ENFORCE';

export interface TransferValidationConfig {
  mode: ValidationMode;
  manualUntil?: string | null;
}

export interface ValidationDecision {
  status: 'APPROVED' | 'REFUSED';
  refuseReason?: string;
  kind: string; // WITHDRAWAL | SETTLEMENT | REFUND_FEE | PIX_REFUND | PAYMENT_SPLIT | UNKNOWN | ...
  reason: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const digits = (v: any) => String(v || '').replace(/\D/g, '');

export async function getTransferValidationConfig(): Promise<TransferValidationConfig> {
  const cfg = await getPlatformConfig<Partial<TransferValidationConfig>>('transfer_validation');
  const mode: ValidationMode = String(cfg?.mode || '').toUpperCase() === 'ENFORCE' ? 'ENFORCE' : 'MONITOR';
  return { mode, manualUntil: cfg?.manualUntil || null };
}

function manualWindowOpen(cfg: TransferValidationConfig): boolean {
  if (!cfg.manualUntil) return false;
  const t = new Date(cfg.manualUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Confere se a transferência foi criada pelo próprio app. Retorna null quando não reconhece. */
async function matchAppTransfer(transfer: any): Promise<{ ok: boolean; kind: string; reason: string } | null> {
  const ext = String(transfer?.externalReference || '').trim();
  const value = round2(Number(transfer?.value || 0));
  const supabase = getSupabaseAdmin();

  // Saque do parceiro
  if (ext.startsWith('WD_') && UUID_RE.test(ext.slice(3))) {
    const { data: row } = await supabase
      .from('withdrawal_requests')
      .select('id, status, requested_amount, pix_key_used')
      .eq('id', ext.slice(3))
      .maybeSingle();
    if (!row) return { ok: false, kind: 'WITHDRAWAL', reason: 'Saque não encontrado no app' };
    if (!['PROCESSING', 'PAGO'].includes(String(row.status || '').toUpperCase())) {
      return { ok: false, kind: 'WITHDRAWAL', reason: `Saque no app está ${row.status}` };
    }
    if (value > round2(Number(row.requested_amount || 0)) + 0.01) {
      return { ok: false, kind: 'WITHDRAWAL', reason: `Valor R$ ${value.toFixed(2)} acima do solicitado` };
    }
    const key = transfer?.bankAccount?.pixAddressKey;
    if (key && row.pix_key_used) {
      const same = digits(key) && digits(row.pix_key_used)
        ? digits(key) === digits(row.pix_key_used)
        : String(key).trim().toLowerCase() === String(row.pix_key_used).trim().toLowerCase();
      if (!same) return { ok: false, kind: 'WITHDRAWAL', reason: 'Chave Pix diferente da registrada no saque' };
    }
    return { ok: true, kind: 'WITHDRAWAL', reason: 'Saque do parceiro registrado no app' };
  }

  // Cobertura da tarifa Pix de estorno
  if (ext.startsWith('REFUNDFEE_') && UUID_RE.test(ext.slice(10))) {
    const { data: order } = await supabase.from('orders').select('id, pricing_snapshot').eq('id', ext.slice(10)).maybeSingle();
    if (!order) return { ok: false, kind: 'REFUND_FEE', reason: 'Pedido do estorno não encontrado' };
    const cap = Number(order?.pricing_snapshot?.asaasPixFeeFixed ?? 0.99);
    if (value > round2(cap) + 0.01) return { ok: false, kind: 'REFUND_FEE', reason: `Valor acima da tarifa Pix do pedido (R$ ${cap.toFixed(2)})` };
    return { ok: true, kind: 'REFUND_FEE', reason: 'Cobertura da tarifa do estorno' };
  }

  // Repasse Master → subconta (referência = id da linha em settlements)
  if (UUID_RE.test(ext)) {
    const { data: row } = await supabase.from('settlements').select('id, status, amount').eq('id', ext).maybeSingle();
    if (!row) return null;
    if (!['PROCESSING', 'DONE', 'PENDING'].includes(String(row.status || '').toUpperCase())) {
      return { ok: false, kind: 'SETTLEMENT', reason: `Repasse no app está ${row.status}` };
    }
    if (value > round2(Number(row.amount || 0)) + 0.01) {
      return { ok: false, kind: 'SETTLEMENT', reason: `Valor R$ ${value.toFixed(2)} acima do repasse` };
    }
    return { ok: true, kind: 'SETTLEMENT', reason: 'Repasse registrado no app' };
  }

  return null;
}

export async function decideTransferValidation(body: any, cfg: TransferValidationConfig): Promise<ValidationDecision> {
  const type = String(body?.type || '').toUpperCase();

  // Estorno Pix: o dinheiro volta para quem pagou. Split: definido na própria cobrança.
  if (type === 'PIX_REFUND') return { status: 'APPROVED', kind: 'PIX_REFUND', reason: 'Estorno Pix ao pagador' };
  if (type === 'PAYMENT_SPLIT') return { status: 'APPROVED', kind: 'PAYMENT_SPLIT', reason: 'Liquidação de split da cobrança' };

  let match: { ok: boolean; kind: string; reason: string } | null = null;
  if (type === 'TRANSFER') {
    try {
      match = await matchAppTransfer(body?.transfer || {});
    } catch (e: any) {
      match = null;
      if (cfg.mode === 'MONITOR') {
        return { status: 'APPROVED', kind: 'ERROR', reason: `Erro ao conferir (modo monitor): ${e?.message || e}` };
      }
    }
  }

  if (match?.ok) return { status: 'APPROVED', kind: match.kind, reason: match.reason };

  const kind = match?.kind || (type === 'TRANSFER' ? 'UNKNOWN' : type || 'UNKNOWN');
  const why = match?.reason || 'Saque não criado pelo app';

  if (cfg.mode === 'MONITOR') {
    return { status: 'APPROVED', kind, reason: `Modo monitor (seria recusado): ${why}` };
  }
  if (!match && manualWindowOpen(cfg)) {
    return { status: 'APPROVED', kind, reason: 'Saque manual liberado pelo admin' };
  }
  return { status: 'REFUSED', refuseReason: `AcaiFood: ${why}`.slice(0, 200), kind, reason: why };
}

/** Registro de cada validação (tabela criada pela migration R32; falha aqui nunca bloqueia a resposta). */
export async function logTransferValidation(body: any, decision: ValidationDecision): Promise<void> {
  try {
    const type = String(body?.type || '').toUpperCase();
    const keyMap: Record<string, string> = {
      TRANSFER: 'transfer', BILL: 'bill', PIX_QR_CODE: 'pixQrCode',
      MOBILE_PHONE_RECHARGE: 'mobilePhoneRecharge', PIX_REFUND: 'pixRefund', PAYMENT_SPLIT: 'paymentSplit'
    };
    const obj = body?.[keyMap[type] || ''] || {};
    await getSupabaseAdmin().from('transfer_validation_log').insert({
      operation_type: type || 'DESCONHECIDO',
      operation_id: obj?.id ? String(obj.id) : null,
      value: Number.isFinite(Number(obj?.value)) ? Number(obj.value) : null,
      external_reference: obj?.externalReference ? String(obj.externalReference) : null,
      decision: decision.status,
      kind: decision.kind,
      reason: decision.reason,
      payload: body
    });
  } catch (e) {
    console.warn('[TransferValidation] Falha ao registrar validação:', e);
  }
}
