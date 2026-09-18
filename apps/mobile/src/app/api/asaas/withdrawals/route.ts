import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getPartnerAvailableBalance } from '@/lib/partnerBalance';
import { authorizeRequest } from '@/lib/apiAuth';

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
    const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Não autorizado. Apenas parceiros podem consultar saques.' }, { status: 401 });
    }

    const user = auth.profile;
    const role = getAppRole(user.role);
    const adminSupabase = getSupabaseAdmin();

    // 1. Obter valor mínimo de saque em platform_settings
    const { data: ps } = await adminSupabase
      .from('platform_settings')
      .select('min_withdrawal_value')
      .limit(1)
      .maybeSingle();

    const minWithdrawalValue = Number(ps?.min_withdrawal_value ?? 20.00);

    // 2. Obter saldo disponível recalculado
    const balanceInfo = await getPartnerAvailableBalance(user.id, role);

    // 3. Buscar se já existe solicitação PENDENTE ou APROVADO
    const { data: pendingRows } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('partner_id', user.id)
      .in('status', ['PENDENTE', 'APROVADO'])
      .order('created_at', { ascending: false })
      .limit(1);

    let pendingRequest = pendingRows && pendingRows.length > 0 ? pendingRows[0] : null;

    // Auto-reconciliação: Se houver solicitação pendente mas o saldo disponível zerou por liquidação prévia dos pedidos
    if (pendingRequest && balanceInfo.totalDisponivel <= 0) {
      try {
        await adminSupabase
          .from('withdrawal_requests')
          .update({
            status: 'PAGO',
            failure_reason: null,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', pendingRequest.id);

        pendingRequest = null;
      } catch (recErr) {
        console.warn("Aviso na auto-reconciliação de saque:", recErr);
      }
    }

    // 4. Histórico recente das últimas 10 solicitações
    const { data: recentRequests } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const canRequest = !pendingRequest && balanceInfo.totalDisponivel >= minWithdrawalValue;

    return NextResponse.json({
      success: true,
      partnerId: user.id,
      totalDisponivel: balanceInfo.totalDisponivel,
      orderIds: balanceInfo.orderIds,
      quantidadePedidos: balanceInfo.quantidadePedidos,
      minWithdrawalValue,
      canRequest,
      pendingRequest,
      recentRequests: recentRequests || []
    });
  } catch (err: any) {
    console.error('[API /api/asaas/withdrawals GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar saques.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Não autorizado. Apenas parceiros podem solicitar saques.' }, { status: 401 });
    }

    const user = auth.profile;
    const role = getAppRole(user.role);
    const adminSupabase = getSupabaseAdmin();

    // 1. Revalidar se já existe solicitação PENDENTE ou APROVADO
    const { data: pendingRows } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, status, requested_amount, created_at')
      .eq('partner_id', user.id)
      .in('status', ['PENDENTE', 'APROVADO'])
      .limit(1);

    if (pendingRows && pendingRows.length > 0) {
      return NextResponse.json({
        error: 'Você já possui uma solicitação de saque em andamento. Aguarde a conclusão antes de solicitar novamente.',
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

    // 3. Recalcular saldo no servidor
    const balanceInfo = await getPartnerAvailableBalance(user.id, role);

    if (balanceInfo.totalDisponivel < minWithdrawalValue) {
      return NextResponse.json({
        error: `Saldo insuficiente para saque. O valor mínimo é R$ ${minWithdrawalValue.toFixed(2)}, e seu saldo atual é R$ ${balanceInfo.totalDisponivel.toFixed(2)}.`
      }, { status: 400 });
    }

    // 4. Confirmar que o parceiro possui pelo menos uma chave de destino cadastrada
    const rawPixKey = String(user.pix_key || '').trim();
    const rawCpfCnpj = String(user.cpf_cnpj || '').replace(/\D/g, '');
    const rawEmail = String(user.email || '').trim();
    const rawWalletId = String(user.asaas_wallet_id || '').trim();

    if (!rawPixKey && !rawCpfCnpj && !rawEmail && !rawWalletId) {
      return NextResponse.json({
        error: 'Por favor, cadastre uma Chave Pix ou CPF/CNPJ no seu perfil antes de solicitar o saque.'
      }, { status: 400 });
    }

    // 5. Inserir a solicitação de saque com status PENDENTE
    const { data: newRequest, error: insErr } = await adminSupabase
      .from('withdrawal_requests')
      .insert({
        partner_id: user.id,
        role,
        requested_amount: balanceInfo.totalDisponivel,
        order_ids: balanceInfo.orderIds,
        status: 'PENDENTE'
      })
      .select()
      .single();

    if (insErr || !newRequest) {
      console.error('Erro ao inserir solicitação de saque:', insErr);
      return NextResponse.json({ error: 'Erro ao registrar solicitação de saque no banco de dados.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Solicitação de saque no valor de R$ ${balanceInfo.totalDisponivel.toFixed(2)} enviada com sucesso! Aguardando aprovação do administrador.`,
      request: newRequest
    });
  } catch (err: any) {
    console.error('[API /api/asaas/withdrawals POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao criar solicitação de saque.' }, { status: 500 });
  }
}
