import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  try {
    const body = await request.json();
    const { orderId, paymentId, description, reason } = body;

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: 'ID do pedido ou do pagamento é obrigatório para estorno' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

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

      const refundRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/refund`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: cancelReasonText
        })
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (orderId && supabaseUrl && supabaseServiceKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('orders').update({
          status: 'CANCELLED',
          cancellation_reason: cancelReasonText,
          asaas_refund_id: refundId,
          asaas_refund_status: refundStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: auth.user?.id || auth.profile?.id || null
        }).eq('id', orderId);
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
