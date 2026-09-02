import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorizedRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey } from '@/lib/asaasConfig';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    const ASAAS_API_KEY = await getAsaasApiKey();
    const ASAAS_URL = 'https://www.asaas.com/api/v3';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Função auxiliar para consultar a API de Produção do Asaas
    const fetchAsaasPayment = async (urlPath: string) => {
      if (!ASAAS_API_KEY) return null;
      try {
        const res = await fetch(`${ASAAS_URL}${urlPath}`, {
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Aviso ao consultar Asaas API Produção:", err);
      }
      return null;
    };

    // 1. Consulta prioritária no banco de dados Supabase (onde o Webhook Asaas e a Edge Function atualizam)
    if (orderId && supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: order } = await supabase
          .from('orders')
          .select('id, status, asaas_payment_id, asaas_charge_status')
          .eq('id', orderId)
          .maybeSingle();

        if (order) {
          const isPaid = order.status === 'PAID' || 
                         order.status === 'PREPARING' || 
                         order.status === 'READY' || 
                         order.status === 'DELIVERING' || 
                         order.status === 'DELIVERED' || 
                         order.status === 'RECEIVED' || 
                         order.status === 'COMPLETED' || 
                         order.status === 'pendente' ||
                         order.status === 'preparo' ||
                         order.status === 'pronto' ||
                         order.status === 'em_rota' ||
                         order.status === 'aguardando_cliente' ||
                         order.status === 'entregue' ||
                         order.asaas_charge_status === 'RECEIVED' || 
                         order.asaas_charge_status === 'CONFIRMED';

          if (isPaid) {
            return NextResponse.json({
              paymentId: order.asaas_payment_id || paymentId,
              orderId: order.id,
              status: order.asaas_charge_status || order.status,
              isPaid: true
            });
          }
        }
      } catch (dbErr) {
        console.warn("Aviso ao buscar pedido no Supabase:", dbErr);
      }
    }

    // 2. Se forneceu paymentId e chave Asaas existe no ambiente, consulta diretamente no Asaas
    if (paymentId && ASAAS_API_KEY) {
      const data = await fetchAsaasPayment(`/payments/${paymentId}`);
      if (data && data.id) {
        const status = data.status;
        const isPaid = status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH' || status === 'DUNNING_RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

        if (isPaid && supabaseUrl && supabaseKey) {
          const targetOrderId = data.externalReference || orderId;
          if (targetOrderId) {
            try {
              const supabase = createClient(supabaseUrl, supabaseKey);
              await supabase.from('orders').update({
                status: 'PAID',
                paid_at: new Date().toISOString(),
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

    // 3. Se forneceu orderId e chave Asaas existe, consulta no Asaas por externalReference
    if (orderId && ASAAS_API_KEY) {
      const listData = await fetchAsaasPayment(`/payments?externalReference=${encodeURIComponent(orderId)}`);
      if (listData && listData.data && listData.data.length > 0) {
        const payments = listData.data;
        const paidPayment = payments.find((p: any) => 
          p.status === 'RECEIVED' || 
          p.status === 'CONFIRMED' || 
          p.status === 'RECEIVED_IN_CASH' || 
          p.status === 'DUNNING_RECEIVED' || 
          p.status === 'PAYMENT_RECEIVED' || 
          p.status === 'PAYMENT_CONFIRMED'
        ) || payments[0];

        const isPaid = paidPayment.status === 'RECEIVED' || paidPayment.status === 'CONFIRMED' || paidPayment.status === 'RECEIVED_IN_CASH' || paidPayment.status === 'DUNNING_RECEIVED' || paidPayment.status === 'PAYMENT_RECEIVED' || paidPayment.status === 'PAYMENT_CONFIRMED';

        if (isPaid && supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from('orders').update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
            asaas_payment_id: paidPayment.id,
            asaas_charge_status: paidPayment.status
          }).eq('id', orderId);
        }

        return NextResponse.json({
          paymentId: paidPayment.id,
          orderId: orderId,
          status: paidPayment.status,
          isPaid,
          value: paidPayment.value
        });
      }
    }

    // 4. Se a chave não estiver no ambiente da Vercel, consultar via Supabase Edge Function (onde a ASAAS_API_KEY está nos Secrets)
    if (supabaseUrl && supabaseKey && (orderId || paymentId)) {
      try {
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/asaas-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ orderId, paymentId })
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData && edgeData.isPaid) {
            return NextResponse.json(edgeData);
          }
        }
      } catch (edgeErr) {
        console.warn("Aviso ao consultar Edge Function asaas-status:", edgeErr);
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
  try {
    const body = await request.json();
    console.log("Recebido Webhook Asaas (POST):", JSON.stringify(body));

    const event = body.event;
    const payment = body.payment || body;

    // Se não tiver evento reconhecido do Asaas, valida autorização estrita
    if (!event && !payment?.id) {
      if (!isAuthorizedRequest(request)) return unauthorizedResponse();
    }

    const status = payment?.status || (event === 'PAYMENT_RECEIVED' ? 'RECEIVED' : event === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 'PENDING');
    const orderId = payment?.externalReference;
    const paymentId = payment?.id;

    const isPaid = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || 
                   status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH' ||
                   status === 'DUNNING_RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

    if (isPaid) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        let query = supabase.from('orders').update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
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
          
          // Gerar PIN de entrega
          if (orderId) {
            try {
              await supabase.rpc('generate_delivery_pin', { p_order_id: orderId });
            } catch (_e) {}
          }
        }
      }
    }

    return NextResponse.json({ success: true, processed: isPaid });

  } catch (err: any) {
    console.error("Erro no processamento do Webhook Asaas (POST):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
