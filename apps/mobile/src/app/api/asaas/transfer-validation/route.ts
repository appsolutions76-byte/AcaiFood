import { NextResponse } from 'next/server';
import {
  decideTransferValidation,
  getTransferValidationConfig,
  logTransferValidation
} from '@/lib/transferValidation';

export const dynamic = 'force-dynamic';

/**
 * Endpoint do "Mecanismo de validação de saque via webhook" do Asaas (R32).
 * Configurar no Asaas: Menu do usuário > Integrações > Mecanismos de segurança
 *   URL:   https://www.acaifood.app.br/api/asaas/transfer-validation
 *   Token: o mesmo valor de ASAAS_TRANSFER_VALIDATION_TOKEN (ou ASAAS_WEBHOOK_TOKEN) da Vercel
 * Resposta exigida pelo Asaas: {"status":"APPROVED"} ou {"status":"REFUSED","refuseReason":"..."}.
 * O token é aceito só no header (asaas-access-token), nunca na URL.
 */
function tokenOk(request: Request): boolean {
  const allowed = new Set(
    [process.env.ASAAS_TRANSFER_VALIDATION_TOKEN, process.env.ASAAS_WEBHOOK_TOKEN, process.env.ASAAS_WEBHOOK_TOKEN_PREVIOUS]
      .filter(Boolean)
      .map((t) => String(t).trim())
  );
  const got = String(request.headers.get('asaas-access-token') || '').trim();
  return allowed.size > 0 && !!got && allowed.has(got);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!tokenOk(request)) {
    const decision = { status: 'REFUSED' as const, refuseReason: 'AcaiFood: token de validacao invalido', kind: 'AUTH', reason: 'Token ausente ou inválido' };
    await logTransferValidation(body || {}, decision);
    return NextResponse.json({ status: 'REFUSED', refuseReason: decision.refuseReason }, { status: 401 });
  }
  if (!body) {
    return NextResponse.json({ status: 'REFUSED', refuseReason: 'AcaiFood: corpo invalido' }, { status: 400 });
  }

  const cfg = await getTransferValidationConfig();
  const decision = await decideTransferValidation(body, cfg);
  await logTransferValidation(body, decision);

  if (decision.status === 'REFUSED') {
    console.warn(`[TransferValidation] RECUSADO ${decision.kind}: ${decision.reason}`);
    return NextResponse.json({ status: 'REFUSED', refuseReason: decision.refuseReason || 'AcaiFood: saque nao autorizado' });
  }
  return NextResponse.json({ status: 'APPROVED' });
}
