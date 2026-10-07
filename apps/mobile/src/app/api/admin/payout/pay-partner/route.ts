import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

type PayoutRole = 'loja' | 'fornecedor' | 'motorista';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maps the stored user role to the role used by withdrawals/balance. Non-partners → null. */
function toPayoutRole(rawRole: unknown): PayoutRole | null {
  const role = String(rawRole || '').toLowerCase().trim();
  if (['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(role)) return 'motorista';
  if (['fornecedor', 'supplier'].includes(role)) return 'fornecedor';
  if (['loja', 'partner', 'batedeira'].includes(role)) return 'loja';
  return null;
}

/**
 * Admin "Pagar" / "Pagar todos": accepts ONLY { partnerId }.
 * Amount, destination and orders are always resolved on the server.
 * Any pixKey / walletId / value / role / description sent by the browser is ignored.
 */
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const adminId: string | null = auth.user?.id || auth.profile?.id || null;

  try {
    const body: unknown = await request.json().catch(() => null);
    const partnerId = body && typeof body === 'object' ? (body as Record<string, unknown>).partnerId : undefined;

    if (typeof partnerId !== 'string' || !UUID_RE.test(partnerId)) {
      return NextResponse.json({ error: 'partnerId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Parceiro e conta Asaas (somente dados do servidor)
    const { data: partnerUser, error: partnerErr } = await supabase
      .from('users')
      .select('id, role, asaas_wallet_id, asaas_account_status')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerErr) {
      console.error('[PayPartner API] Erro ao buscar parceiro:', partnerErr.code);
      return NextResponse.json({ error: 'Falha ao consultar o parceiro.' }, { status: 500 });
    }
    if (!partnerUser) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 });
    }

    const payoutRole = toPayoutRole(partnerUser.role);
    if (!payoutRole) {
      return NextResponse.json({ error: 'Este usuário não é um parceiro que recebe repasses.' }, { status: 400 });
    }

    const accountStatus = String(partnerUser.asaas_account_status || '').toUpperCase();
    const hasApprovedAccount = accountStatus === 'APPROVED' && Boolean(String(partnerUser.asaas_wallet_id || '').trim());
    if (!hasApprovedAccount) {
      await logAdminAction({
        actorId: adminId,
        action: 'PAY_PARTNER_BLOCKED',
        targetType: 'PARTNER',
        targetId: partnerId,
        beforeState: { asaas_account_status: accountStatus || null },
        afterState: { reason: 'ASAAS_ACCOUNT_NOT_APPROVED' },
        request
      });
      return NextResponse.json({
        error: 'A conta Asaas deste parceiro ainda não foi aprovada. O repasse só é pago na subconta aprovada.',
        code: 'ASAAS_ACCOUNT_NOT_APPROVED'
      }, { status: 400 });
    }

    // 2. Não abrir um segundo saque se já existir um em andamento
    const { data: openRows, error: openErr } = await supabase
      .from('withdrawal_requests')
      .select('id, status')
      .eq('partner_id', partnerId)
      .in('status', ['PENDENTE', 'APROVADO', 'PROCESSING'])
      .limit(1);

    if (openErr) {
      console.error('[PayPartner API] Erro ao consultar saques em aberto:', openErr.code);
      return NextResponse.json({ error: 'Falha ao consultar saques do parceiro.' }, { status: 500 });
    }
    if (openRows && openRows.length > 0) {
      return NextResponse.json({
        error: `Este parceiro já tem um saque em andamento (${openRows[0].status}). Conclua-o na aba de Saques antes de pagar de novo.`,
        code: 'OPEN_WITHDRAWAL_EXISTS',
        withdrawalId: openRows[0].id
      }, { status: 409 });
    }

    // 3. Saldo autoritativo calculado no servidor
    const balanceInfo = await getPartnerAvailableBalance(partnerId, payoutRole);
    if (!balanceInfo || balanceInfo.totalDisponivel <= 0 || balanceInfo.orderIds.length === 0) {
      return NextResponse.json({ error: 'Parceiro não possui saldo disponível para repasse.' }, { status: 400 });
    }

    const amountToPay = balanceInfo.totalDisponivel;
    const eligibleOrders = balanceInfo.orderIds;

    // 4. Solicitação de saque
    const { data: withdrawal, error: createErr } = await supabase
      .from('withdrawal_requests')
      .insert({
        partner_id: partnerId,
        role: payoutRole,
        requested_amount: amountToPay,
        order_ids: eligibleOrders,
        status: 'PENDENTE'
      })
      .select('id')
      .single();

    if (createErr || !withdrawal) {
      console.error('[PayPartner API] Erro ao criar solicitação de saque:', createErr?.code);
      return NextResponse.json({ error: 'Falha ao registrar a solicitação de saque.' }, { status: 500 });
    }

    // 5. Aprovação e transferência para a subconta (regras em processWithdrawalApproval)
    const approvalResult = await processWithdrawalApproval(withdrawal.id, adminId);

    // 6. Log de auditoria
    await logAdminAction({
      actorId: adminId,
      action: 'PAY_PARTNER',
      targetType: 'PARTNER',
      targetId: partnerId,
      beforeState: {
        availableBalance: amountToPay,
        eligibleOrdersCount: eligibleOrders.length,
        asaas_account_status: accountStatus
      },
      afterState: {
        withdrawalId: withdrawal.id,
        status: approvalResult.status,
        amount: approvalResult.amount ?? null,
        transferId: approvalResult.transferId ?? null,
        error: approvalResult.error ?? null
      },
      request
    });

    if (!approvalResult.success) {
      return NextResponse.json({
        error: approvalResult.error || 'Falha ao processar o repasse no Asaas.',
        status: approvalResult.status,
        withdrawalId: withdrawal.id
      }, { status: approvalResult.status === 'PROCESSING' ? 202 : 400 });
    }

    const paidAmount = approvalResult.amount ?? amountToPay;
    return NextResponse.json({
      success: true,
      status: approvalResult.status,
      amount: paidAmount,
      message: approvalResult.status === 'PAGO'
        ? `Repasse de R$ ${paidAmount.toFixed(2)} pago na subconta Asaas do parceiro.`
        : `Repasse de R$ ${paidAmount.toFixed(2)} enviado ao Asaas e em processamento.`,
      withdrawalId: withdrawal.id,
      transferId: approvalResult.transferId ?? null
    });
  } catch (error: unknown) {
    console.error('[PayPartner API] Erro inesperado:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erro interno ao repassar ao parceiro.' }, { status: 500 });
  }
}
