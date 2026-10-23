import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { settleOrderPayouts, syncAndProcessPendingSettlements, isSettlementsEnabled } from '@/lib/orderSettlements';
import { reconcilePartnerWithdrawals } from '@/lib/partnerBalance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleProcessSettlements(request);
}

export async function POST(request: Request) {
  return handleProcessSettlements(request);
}

/**
 * Liquidação dos repasses Master → subcontas.
 * - Cron / segredo interno / admin: rotina completa (pedidos, fila, confirmação e saques em processamento).
 * - Parceiro ou cliente logado: só pode pedir a liquidação de um pedido específico do qual participa
 *   (é o que o app faz logo após o PIN de entrega). Não pode usar `force`.
 */
async function handleProcessSettlements(request: Request) {
  const { searchParams } = new URL(request.url);
  const specificOrderId = searchParams.get('orderId');

  let privileged = isAuthorizedRequest(request);
  let callerId: string | null = null;

  if (!privileged) {
    const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
    if (!auth.authorized) {
      return unauthorizedResponse(auth.error);
    }
    const role = String(auth.profile?.role || '').toLowerCase();
    if (role === 'admin' || role === 'administrador' || auth.profile?.is_admin === true) {
      privileged = true;
    } else {
      callerId = auth.user?.id || auth.profile?.id || null;
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const force = privileged && searchParams.get('force') === 'true';

    if (!(await isSettlementsEnabled()) && !force) {
      return NextResponse.json({
        success: true,
        settlementsEnabled: false,
        message: 'Liquidação de repasses aguardando autorização da plataforma (settlements_enabled=false).'
      });
    }

    if (!privileged) {
      if (!specificOrderId || !callerId) {
        return NextResponse.json({ error: 'Informe o pedido a liquidar.' }, { status: 400 });
      }
      const { data: order } = await supabase
        .from('orders')
        .select('id, buyer_id, driver_id, seller_storefront_id')
        .eq('id', specificOrderId)
        .maybeSingle();
      if (!order) {
        return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
      }
      let isParty = order.buyer_id === callerId || order.driver_id === callerId;
      if (!isParty && order.seller_storefront_id) {
        const { data: sf } = await supabase.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).maybeSingle();
        isParty = sf?.partner_id === callerId;
      }
      if (!isParty) {
        return NextResponse.json({ error: 'Acesso negado a este pedido.' }, { status: 403 });
      }
    }

    if (specificOrderId) {
      const orderResult = await settleOrderPayouts(specificOrderId);
      return NextResponse.json({ success: true, orderId: specificOrderId, result: orderResult });
    }

    const syncRes = await syncAndProcessPendingSettlements();

    // Confirma no Asaas os saques que ficaram em processamento (sem reenviar Pix)
    try {
      await reconcilePartnerWithdrawals();
    } catch (recErr) {
      console.warn('[Settlement Process] Aviso ao reconciliar saques:', recErr);
    }

    return NextResponse.json({ success: true, processed: syncRes.processed, results: syncRes.results });
  } catch (error: any) {
    console.error('[Settlement Process] Erro fatal:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
