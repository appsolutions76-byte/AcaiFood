import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { partnerId } = body;

    if (!partnerId) {
      return NextResponse.json({ error: 'partnerId é obrigatório' }, { status: 400 });
    }

    const adminId = auth.user?.id || auth.profile?.id || null;
    const supabase = getSupabaseAdmin();

    // Buscar perfil do parceiro para obter a role
    const { data: partnerUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', partnerId)
      .maybeSingle();

    const partnerRole = partnerUser?.role || 'batedeira';

    // 1. Calcular o saldo autoritativo no servidor
    const balanceInfo = await getPartnerAvailableBalance(partnerId, partnerRole);
    if (!balanceInfo || balanceInfo.totalDisponivel <= 0) {
      return NextResponse.json({ error: 'Parceiro não possui saldo líquido disponível para repasse.' }, { status: 400 });
    }

    const amountToPay = balanceInfo.totalDisponivel;
    const eligibleOrders = balanceInfo.orderIds || [];

    // 2. Criar a solicitação de saque no banco de dados
    const { data: withdrawal, error: createErr } = await supabase
      .from('withdrawal_requests')
      .insert({
        partner_id: partnerId,
        amount: amountToPay,
        status: 'PENDENTE',
        order_ids: eligibleOrders
      })
      .select('id')
      .single();

    if (createErr || !withdrawal) {
      console.error('[PayPartner API] Erro ao criar solicitação de saque:', createErr);
      return NextResponse.json({ error: 'Falha ao registrar solicitação de saque no banco.' }, { status: 500 });
    }

    // 3. Processar aprovação e liquidação via Asaas subconta
    const approvalResult = await processWithdrawalApproval(withdrawal.id, adminId);

    // 4. Log em admin_audit_log
    await supabase.from('admin_audit_log').insert({
      actor_id: adminId,
      action: 'PAY_PARTNER',
      target_type: 'PARTNER',
      target_id: String(partnerId),
      before_state: { availableBalance: amountToPay, eligibleOrdersCount: eligibleOrders.length },
      after_state: { withdrawalId: withdrawal.id, result: approvalResult }
    });

    if (!approvalResult.success) {
      return NextResponse.json({
        error: approvalResult.error || 'Falha ao aprovar e liquidação no Asaas',
        details: approvalResult
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Repasse de R$ ${amountToPay.toFixed(2)} enviado com sucesso para a subconta do parceiro!`,
      withdrawalId: withdrawal.id,
      asaasTransferId: approvalResult.transferId
    });

  } catch (error: any) {
    console.error('[PayPartner API] Erro inesperado:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao repassar ao parceiro' }, { status: 500 });
  }
}
