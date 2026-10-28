import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance, reconcilePartnerWithdrawals } from '@/lib/partnerBalance';
import { authorizeRequest } from '@/lib/apiAuth';
import { settlePendingOrdersForPartner } from '@/lib/orderSettlements';
import { getPayoutHold, isInstantPayoutEnabled, PAYOUT_HOLD_MESSAGE } from '@/lib/payoutHold';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';

export const dynamic = 'force-dynamic';

function getAppRole(profileRole?: string) {
  const roleStr = String(profileRole || '').toUpperCase();
  if (roleStr === 'PARTNER' || roleStr === 'LOJA' || roleStr === 'BATEDEIRA') return 'loja';
  if (roleStr === 'SUPPLIER' || roleStr === 'FORNECEDOR') return 'fornecedor';
  if (roleStr === 'COURIER' || roleStr === 'MOTORISTA' || roleStr === 'MOTOBOY' || roleStr === 'CAMINHAO' || roleStr === 'DRIVER') return 'motorista';
  if (roleStr === 'ADMIN' || roleStr === 'ADMINISTRADOR') return 'admin';
  return 'cliente';
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin'], { allowBlocked: true });
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Não autorizado. Apenas parceiros podem consultar saques.' }, { status: 401 });
    }

    const user = auth.profile;
    const role = getAppRole(user.role);
    const adminSupabase = getSupabaseAdmin();

    // 0. Confirma saques em processamento e leva para a subconta as entregas ainda não repassadas
    await reconcilePartnerWithdrawals(user.id, role);
    await settlePendingOrdersForPartner(user.id, role === 'motorista');

    // 1. Obter valor mínimo de saque em platform_settings
    const { data: ps } = await adminSupabase
      .from('platform_settings')
      .select('min_withdrawal_value')
      .limit(1)
      .maybeSingle();

    const minWithdrawalValue = Number(ps?.min_withdrawal_value ?? 20.00);

    // Situação da subconta Asaas (saque só para walletId de subconta APPROVED)
    const { data: acct } = await adminSupabase
      .from('users')
      .select('asaas_account_status, asaas_wallet_id')
      .eq('id', user.id)
      .maybeSingle();
    const accountStatus = String(acct?.asaas_account_status || 'PENDING_DOCUMENTS');
    const accountApproved = accountStatus === 'APPROVED' && Boolean(String(acct?.asaas_wallet_id || '').trim());

    // 2. Obter saldo disponível recalculado
    const balanceInfo = await getPartnerAvailableBalance(user.id, role);

    // 3. Buscar se já existe solicitação PENDENTE ou PROCESSING ativa
    const { data: pendingRows } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('partner_id', user.id)
      .in('status', ['PENDENTE', 'APROVADO', 'PROCESSING'])
      .order('created_at', { ascending: false })
      .limit(1);

    let pendingRequest = pendingRows && pendingRows.length > 0 ? pendingRows[0] : null;

    // 4. Histórico recente das últimas 10 solicitações
    const { data: recentRequests } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const payoutHold = await getPayoutHold(user.id);
    const instantPayout = await isInstantPayoutEnabled();
    const canRequest = accountApproved && !pendingRequest && !payoutHold.hold && balanceInfo.totalDisponivel >= minWithdrawalValue;

    return NextResponse.json({
      success: true,
      partnerId: user.id,
      totalDisponivel: balanceInfo.totalDisponivel,
      orderIds: balanceInfo.orderIds,
      quantidadePedidos: balanceInfo.quantidadePedidos,
      mirroredFromAsaas: balanceInfo.mirroredFromAsaas ?? false,
      subaccountBalance: balanceInfo.subaccountBalance,
      internalOrderBalance: balanceInfo.internalOrderBalance,
      reservedBalance: balanceInfo.reservedBalance ?? 0,
      minWithdrawalValue,
      canRequest,
      accountStatus,
      accountApproved,
      pendingRequest,
      recentRequests: recentRequests || [],
      payoutHold: payoutHold.hold,
      payoutHoldMessage: payoutHold.hold ? PAYOUT_HOLD_MESSAGE : null,
      instantPayout
    });
  } catch (err: any) {
    console.error('[API /api/asaas/withdrawals GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar saques.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin'], { allowBlocked: true });
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Não autorizado. Apenas parceiros podem solicitar saques.' }, { status: 401 });
    }

    const user = auth.profile;
    const role = getAppRole(user.role);
    const adminSupabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    // 0. R34: chave Pix/CPF trocada = saque suspenso até o admin liberar
    const payoutHold = await getPayoutHold(user.id);
    if (payoutHold.hold) {
      return NextResponse.json({ error: PAYOUT_HOLD_MESSAGE, code: 'PAYOUT_HOLD' }, { status: 403 });
    }

    // 1. Revalidar se já existe solicitação PENDENTE, APROVADO ou PROCESSING
    const { data: pendingRows } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, status, requested_amount, created_at')
      .eq('partner_id', user.id)
      .in('status', ['PENDENTE', 'APROVADO', 'PROCESSING'])
      .limit(1);

    if (pendingRows && pendingRows.length > 0) {
      return NextResponse.json({
        error: 'Você já possui uma solicitação de saque em andamento (Pendente ou Em Processamento). Aguarde a conclusão antes de solicitar novamente.',
        pendingRequest: pendingRows[0]
      }, { status: 400 });
    }

    // 2. Obter valor mínimo de saque
    const { data: ps } = await adminSupabase
      .from('platform_settings')
      .select('min_withdrawal_value')
      .limit(1)
      .maybeSingle();

    const minWithdrawalValue = Number(ps?.min_withdrawal_value ?? 20.00);

    // 3. Leva para a subconta as entregas ainda não repassadas e lê o saldo REAL da subconta
    await settlePendingOrdersForPartner(user.id, role === 'motorista');
    const balanceInfo = await getPartnerAvailableBalance(user.id, role);

    if (!balanceInfo.mirroredFromAsaas) {
      return NextResponse.json({
        error: 'Não foi possível consultar o saldo da sua conta Asaas agora. Tente novamente em alguns minutos.'
      }, { status: 503 });
    }

    if (balanceInfo.totalDisponivel < minWithdrawalValue) {
      return NextResponse.json({
        error: `Saldo insuficiente para saque. O valor mínimo é R$ ${minWithdrawalValue.toFixed(2)}, e seu saldo atual é R$ ${balanceInfo.totalDisponivel.toFixed(2)}.`
      }, { status: 400 });
    }

    // 3.1 R34: valor escolhido pelo parceiro (vazio = todo o saldo livre)
    let requestedAmount = Number(balanceInfo.totalDisponivel.toFixed(2));
    if (body?.amount !== undefined && body?.amount !== null && String(body.amount).trim() !== '') {
      const asked = Number(String(body.amount).replace(',', '.'));
      if (!Number.isFinite(asked) || asked <= 0) {
        return NextResponse.json({ error: 'Valor de saque inválido.' }, { status: 400 });
      }
      const askedR = Number(asked.toFixed(2));
      if (askedR < minWithdrawalValue) {
        return NextResponse.json({ error: `O valor mínimo de saque é R$ ${minWithdrawalValue.toFixed(2)}.` }, { status: 400 });
      }
      if (askedR > requestedAmount + 0.001) {
        return NextResponse.json({ error: `O valor pedido é maior que o saldo livre (R$ ${requestedAmount.toFixed(2)}).` }, { status: 400 });
      }
      requestedAmount = askedR;
    }

    // 4. Saque só para a subconta Asaas aprovada do próprio parceiro (walletId)
    const { data: acct } = await adminSupabase
      .from('users')
      .select('asaas_account_status, asaas_wallet_id')
      .eq('id', user.id)
      .maybeSingle();
    const rawWalletId = String(acct?.asaas_wallet_id || '').trim();
    if (acct?.asaas_account_status !== 'APPROVED' || !rawWalletId) {
      return NextResponse.json({
        error: 'Sua conta Asaas ainda não foi aprovada. Envie os documentos em "Minha conta Asaas" para liberar o saque.',
        code: 'ACCOUNT_NOT_APPROVED'
      }, { status: 400 });
    }

    // 4.5. Fase 1.4: Invalidar solicitações com status FALHOU anteriores do mesmo parceiro
    try {
      await adminSupabase
        .from('withdrawal_requests')
        .update({
          status: 'REJEITADO',
          failure_reason: 'Substituído por nova solicitação de saque'
        })
        .eq('partner_id', user.id)
        .eq('status', 'FALHOU');
    } catch (_updFailErr) {
      console.warn("Aviso ao arquivar saques FALHOU anteriores:", _updFailErr);
    }

    // 5. Inserir a solicitação de saque com status PENDENTE
    const { data: newRequest, error: insErr } = await adminSupabase
      .from('withdrawal_requests')
      .insert({
        partner_id: user.id,
        role,
        requested_amount: requestedAmount,
        // O saque usa só o saldo da subconta; os pedidos são controlados pelos repasses (settlements)
        order_ids: [],
        status: 'PENDENTE'
      })
      .select()
      .single();

    if (insErr || !newRequest) {
      console.error('Erro ao inserir solicitação de saque:', insErr);
      return NextResponse.json({ error: 'Erro ao registrar solicitação de saque no banco de dados.' }, { status: 500 });
    }

    const netVal = Math.max(0, requestedAmount - 0.99);

    // 6. R34: saque na hora — paga já, com as mesmas conferências da aprovação manual
    if (await isInstantPayoutEnabled()) {
      try {
        const result = await processWithdrawalApproval(newRequest.id, null);
        if (result.success || result.status === 'PROCESSING') {
          return NextResponse.json({
            success: true,
            instant: true,
            message: result.message || `Saque de R$ ${requestedAmount.toFixed(2)} enviado via Pix para a sua chave (taxa Asaas: R$ 0,99).`,
            request: { ...newRequest, status: result.status }
          });
        }
        if (result.status === 'PENDENTE') {
          return NextResponse.json({
            success: true,
            instant: false,
            message: result.error || 'Solicitação registrada. Aguardando liberação.',
            request: newRequest
          });
        }
        return NextResponse.json({ error: result.error || 'Não foi possível concluir o saque agora.', request: { ...newRequest, status: result.status } }, { status: 400 });
      } catch (instErr: any) {
        console.error('[Saque na hora] Erro:', instErr?.message || instErr);
        return NextResponse.json({
          success: true,
          instant: false,
          message: 'Solicitação registrada. O pagamento será concluído em instantes ou pelo administrador.',
          request: newRequest
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Solicitação de saque de R$ ${requestedAmount.toFixed(2)} enviada! Líquido de R$ ${netVal.toFixed(2)} será transferido via Pix após aprovação (taxa Asaas: R$ 0,99).`,
      request: newRequest
    });
  } catch (err: any) {
    console.error('[API /api/asaas/withdrawals POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao criar solicitação de saque.' }, { status: 500 });
  }
}
