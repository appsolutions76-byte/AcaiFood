import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { calculateOrderPricing } from '@/lib/pricingEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('settlements')
      .select(`
        id, order_id, partner_id, role, amount, status, wallet_id,
        asaas_transfer_id, last_error, attempts, transferred_at, created_at, updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status.toUpperCase());
    }

    const { data: settlements, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      settlements: settlements || []
    });
  } catch (error: any) {
    console.error('Erro GET /api/admin/settlements:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar repasses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { settlementId, action, reason } = body;
    const adminId = auth.user?.id || auth.profile?.id;

    if (!settlementId || !action) {
      return NextResponse.json({ error: 'settlementId e action são obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: settlement, error: sErr } = await supabase
      .from('settlements')
      .select('*')
      .eq('id', settlementId)
      .maybeSingle();

    if (sErr || !settlement) {
      return NextResponse.json({ error: 'Repasse não encontrado' }, { status: 404 });
    }

    if (action === 'approve_review') {
      // Buscar pedido para recalcular valor oficial com segurança via pricingEngine
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_type, delivery_distance_km, products_subtotal, seller_storefront_id, delivery_address')
        .eq('id', settlement.order_id)
        .maybeSingle();

      let recalculatedAmount = Number(settlement.amount);

      if (order) {
        try {
          const pricing = await calculateOrderPricing({
            orderType: order.order_type || 'B2C',
            distanceKm: Number(order.delivery_distance_km || 0),
            cityName: 'Belém',
            productsSubtotal: Number(order.products_subtotal || 0),
            sellerStorefrontId: order.seller_storefront_id
          }, supabase);

          if (settlement.role === 'seller') {
            recalculatedAmount = pricing.netSellerPayout;
          } else if (settlement.role === 'driver') {
            recalculatedAmount = pricing.netDriverPayout;
          }
        } catch (_pErr) {
          console.warn("Aviso ao recalcular pricing em approve_review:", _pErr);
        }
      }

      const { error: updErr } = await supabase
        .from('settlements')
        .update({
          status: 'PENDING',
          amount: recalculatedAmount,
          last_error: reason ? `Aprovado manualmente pelo admin: ${reason}` : 'Aprovado manualmente da revisão',
          updated_at: new Date().toISOString()
        })
        .eq('id', settlementId);

      if (updErr) throw updErr;

      await logAdminAction({
        actorId: adminId,
        action: 'SETTLEMENT_APPROVE_REVIEW',
        targetType: 'SETTLEMENT',
        targetId: settlementId,
        beforeState: { status: settlement.status, amount: settlement.amount },
        afterState: { status: 'PENDING', amount: recalculatedAmount, reason },
        request
      });

      return NextResponse.json({
        success: true,
        message: `Repasse #${settlementId.substring(0, 8)} liberado com valor recalculado de R$ ${recalculatedAmount.toFixed(2)}.`,
        amount: recalculatedAmount
      });

    } else if (action === 'cancel_settlement') {
      const { error: updErr } = await supabase
        .from('settlements')
        .update({
          status: 'CANCELLED',
          last_error: reason || 'Cancelado pelo administrador',
          updated_at: new Date().toISOString()
        })
        .eq('id', settlementId);

      if (updErr) throw updErr;

      await logAdminAction({
        actorId: adminId,
        action: 'SETTLEMENT_CANCEL',
        targetType: 'SETTLEMENT',
        targetId: settlementId,
        beforeState: { status: settlement.status, amount: settlement.amount },
        afterState: { status: 'CANCELLED', reason },
        request
      });

      return NextResponse.json({
        success: true,
        message: `Repasse #${settlementId.substring(0, 8)} cancelado com sucesso.`
      });
    } else {
      return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro POST /api/admin/settlements:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar repasse' }, { status: 500 });
  }
}
