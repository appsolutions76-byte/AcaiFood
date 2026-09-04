import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'cliente', 'fornecedor', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  try {
    const body = await request.json();
    const { orderId, paymentId, description, reason, value } = body;

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: 'ID do pedido ou do pagamento é obrigatório para estorno' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    let asaasPaymentId = paymentId || '';

    // Se forneceu apenas orderId, buscar asaas_payment_id no Supabase ou via Asaas API
    if (!asaasPaymentId && orderId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const sfRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=asaas_payment_id,asaas_charge_status`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`
            }
          });
          if (sfRes.ok) {
            const data = await sfRes.json();
            if (data && data.length > 0 && data[0].asaas_payment_id) {
              asaasPaymentId = data[0].asaas_payment_id;
            }
          }
        } catch (e) {
          console.warn("Erro ao buscar asaas_payment_id no Supabase:", e);
        }
      }

      // Fallback: buscar por externalReference no Asaas
      if (!asaasPaymentId) {
        try {
          const searchRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(orderId)}`, {
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
          });
          const searchData = await searchRes.json();
          if (searchData && searchData.data && searchData.data.length > 0) {
            asaasPaymentId = searchData.data[0].id;
          }
        } catch (e) {
          console.warn("Erro ao buscar cobrança no Asaas por externalReference:", e);
        }
      }
    }

    const cancelReasonText = reason || description || 'Cancelamento solicitado pelo usuário antes da entrega/PIN';

    let refundId: string | null = null;
    let refundStatus = 'REFUND_REQUESTED';
    let refundMessage = '';

    if (asaasPaymentId) {
      console.log(`Solicitando estorno no Asaas para a cobrança ${asaasPaymentId}...`);

      const refundBodyPayload: any = { description: cancelReasonText };
      if (value && Number(value) > 0) refundBodyPayload.value = Number(value);

      const refundRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/refund`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(refundBodyPayload)
      });

      const refundData = await refundRes.json();

      if (refundRes.ok && !refundData.errors) {
        refundId = refundData.id || null;
        refundStatus = refundData.status || 'REFUNDED';
      } else {
        const msg = refundData.errors
          ? refundData.errors.map((e: any) => e.description).join(', ')
          : (refundData.message || JSON.stringify(refundData));
        console.warn("Aviso ao estornar cobrança no Asaas (assumindo simulação/cancelado):", msg);
        refundMessage = msg;
        refundStatus = 'REFUND_SIMULATED_OR_MANUAL';
      }
    } else {
      refundStatus = 'NO_PAYMENT_FOUND_CANCELLED';
    }

    // Persistir estado de cancelamento e estorno no Supabase DB
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const supabase = getSupabaseAdmin();

    if (orderId) {
      try {
        // Verificar se o pedido pertence ao usuário que está solicitando o estorno (se não for admin)
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, buyer_id, driver_id, seller_storefront_id, status')
          .eq('id', orderId)
          .maybeSingle();

        if (orderData && auth.source === 'user_jwt') {
          const userId = auth.user?.id || auth.profile?.id;
          const userRole = String(auth.profile?.role || '').toUpperCase();
          const isAdmin = userRole === 'ADMIN' || auth.profile?.role === 'admin';

          if (!isAdmin) {
            const isBuyer = orderData.buyer_id === userId;
            const isDriver = orderData.driver_id === userId;
            const isStore = orderData.seller_storefront_id === userId;

            if (!isBuyer && !isDriver && !isStore) {
              return NextResponse.json({ error: 'Você não tem permissão para cancelar ou estornar este pedido.' }, { status: 403 });
            }
          }
        }
        
        const targetDbStatus = refundStatus === 'REFUNDED' ? 'REFUNDED' : (asaasPaymentId ? 'REFUND_REQUESTED' : 'CANCELED');
        
        await supabase.from('orders').update({
          status: targetDbStatus,
          cancellation_reason: cancelReasonText,
          asaas_refund_id: refundId,
          asaas_refund_status: refundStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: auth.user?.id || auth.profile?.id || null
        }).eq('id', orderId);

        // Se estornado, reverte splits pendentes
        if (targetDbStatus === 'REFUNDED') {
          await supabase.from('splits').update({ status: 'REVERSED' }).eq('order_id', orderId);
        }

        // Registrar histórico de status
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          from_status: 'PAID',
          to_status: targetDbStatus,
          actor_id: auth.user?.id || auth.profile?.id || null,
          actor_role: auth.profile?.role || 'USER',
          reason: cancelReasonText
        });
      } catch (dbErr) {
        console.warn("Erro ao registrar cancelamento/estorno no DB Supabase:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      refundId: refundId,
      status: refundStatus,
      message: refundMessage || 'Estorno processado e cancelamento registrado com sucesso.'
    });

  } catch (error: any) {
    console.error("Erro na API de Estorno do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar estorno no Asaas' },
      { status: 500 }
    );
  }
}
