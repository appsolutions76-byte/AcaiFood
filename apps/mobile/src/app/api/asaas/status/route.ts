import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorizedRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || (ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg'));
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // 1. Se forneceu paymentId, consulta diretamente no Asaas pelo ID da cobrança
    if (paymentId && ASAAS_API_KEY) {
      const res = await fetch(`${ASAAS_URL}/payments/${paymentId}`, {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const status = data.status;
        const isPaid = status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH' || status === 'DUNNING_RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

        if (isPaid && supabaseUrl && supabaseKey) {
          const targetOrderId = data.externalReference || orderId;
          if (targetOrderId) {
            try {
              const supabase = createClient(supabaseUrl, supabaseKey);
              await supabase.from('orders').update({
                status: 'PAID',
                asaas_payment_id: data.id,
                asaas_charge_status: status
              }).eq('id', targetOrderId);
            } catch (updErr) {
              console.warn("Erro ao sincronizar status PAID no Supabase via API status:", updErr);
            }
          }
        }

        return NextResponse.json({
          paymentId: data.id,
          orderId: data.externalReference || orderId,
          status,
          isPaid,
          value: data.value
        });
      }
    }

    // 2. Se forneceu orderId e chave Asaas existe, consulta no Asaas por externalReference (ID do pedido)
    if (orderId && ASAAS_API_KEY) {
      try {
        const resList = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(orderId)}`, {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (resList.ok) {
          const listData = await resList.json();
          const payments = listData.data || [];
          const paidPayment = payments.find((p: any) => 
            p.status === 'RECEIVED' || 
            p.status === 'CONFIRMED' || 
            p.status === 'RECEIVED_IN_CASH' || 
            p.status === 'DUNNING_RECEIVED' || 
            p.status === 'PAYMENT_RECEIVED' || 
            p.status === 'PAYMENT_CONFIRMED'
          );

          if (paidPayment) {
            if (supabaseUrl && supabaseKey) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              await supabase.from('orders').update({
                status: 'PAID',
                asaas_payment_id: paidPayment.id,
                asaas_charge_status: paidPayment.status
              }).eq('id', orderId);
            }

            return NextResponse.json({
              paymentId: paidPayment.id,
              orderId: orderId,
              status: paidPayment.status,
              isPaid: true,
              value: paidPayment.value
            });
          }
        }
      } catch (errAsaas) {
        console.warn("Erro ao buscar cobrança por externalReference no Asaas:", errAsaas);
      }
    }

    // 3. Consulta no banco de dados Supabase como fallback
    if (orderId && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: order } = await supabase
        .from('orders')
        .select('id, status, asaas_payment_id, asaas_charge_status')
        .eq('id', orderId)
        .maybeSingle();

      if (order) {
        const isPaid = order.status === 'PAID' || order.status === 'PREPARING' || order.status === 'READY' || order.status === 'DELIVERING' || order.status === 'DELIVERED' || order.status === 'RECEIVED' || order.status === 'COMPLETED' || order.asaas_charge_status === 'RECEIVED' || order.asaas_charge_status === 'CONFIRMED';
        return NextResponse.json({
          paymentId: order.asaas_payment_id || paymentId,
          orderId: order.id,
          status: order.asaas_charge_status || order.status,
          isPaid
        });
      }
    }

    return NextResponse.json({ isPaid: false, status: 'PENDING' });

  } catch (error: any) {
    console.error("Erro na rota GET /api/asaas/status:", error);
    return NextResponse.json({ isPaid: false, error: error.message }, { status: 500 });
  }
}

// 4. Endpoint Webhook (POST) para receber notificações oficiais do Asaas em tempo real
export async function POST(request: Request) {
  // Verifica token do webhook (configurado na URL do Asaas como ?wh_token=...)
  if (!isAuthorizedRequest(request)) return unauthorizedResponse();
  try {
    const body = await request.json();
    console.log("Recebido Webhook Asaas (POST):", JSON.stringify(body));

    const event = body.event;
    const payment = body.payment || body;

    const status = payment?.status || (event === 'PAYMENT_RECEIVED' ? 'RECEIVED' : event === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 'PENDING');
    const orderId = payment?.externalReference;
    const paymentId = payment?.id;

    const isPaid = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || 
                   status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH';

    if (isPaid) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        let query = supabase.from('orders').update({
          status: 'PAID',
          asaas_payment_id: paymentId,
          asaas_charge_status: status
        });

        if (orderId) {
          query = query.eq('id', orderId);
        } else if (paymentId) {
          query = query.eq('asaas_payment_id', paymentId);
        }

        const { error } = await query;
        if (error) {
          console.warn("Erro ao atualizar pedido no Supabase via Webhook Asaas:", error);
        } else {
          console.log(`✅ Webhook Asaas: Pedido #${orderId || paymentId} atualizado para PAID com sucesso!`);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Erro no processamento do Webhook Asaas (POST):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
