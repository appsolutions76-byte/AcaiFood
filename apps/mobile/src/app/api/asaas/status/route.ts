import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    const ASAAS_API_KEY = await getAsaasApiKey();
    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

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
        const supabase = getSupabaseAdmin();
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
              const supabase = getSupabaseAdmin();
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
          const supabase = getSupabaseAdmin();
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
    // Validação rigorosa de autenticidade do Webhook Asaas para TODOS os eventos
    const { isValidAsaasWebhook } = await import('@/lib/apiAuth');
    if (!isValidAsaasWebhook(request)) {
      console.warn("⚠️ [Webhook Asaas] Tentativa de chamada de webhook não autorizada rejeitada.");
      return unauthorizedResponse("Assinatura de webhook ou token de acesso inválido.");
    }

    const body = await request.json();
    console.log("Recebido Webhook Asaas (POST):", JSON.stringify(body));

    const event = body.event;
    const payment = body.payment || (event?.startsWith('PAYMENT_') ? body : null);
    const transfer = body.transfer || (event?.startsWith('TRANSFER_') ? body : null);

    // 1. Processamento de Webhooks de Transferência / Saque Pix (TRANSFER_*)
    if (transfer || String(event || '').startsWith('TRANSFER_')) {
      const transferId = transfer?.id || body.id;
      const transferStatus = transfer?.status || (
        (event === 'TRANSFER_DONE' || event === 'TRANSFER_COMPLETED') ? 'DONE' :
        (event === 'TRANSFER_FAILED' || event === 'TRANSFER_CANCELLED' || event === 'TRANSFER_REVERSED') ? 'FAILED' :
        'PENDING'
      );

      const supabase = getSupabaseAdmin();
      if (transferId) {
        if (transferStatus === 'DONE' || event === 'TRANSFER_DONE' || event === 'TRANSFER_COMPLETED') {
          const { data: wr } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('asaas_transfer_id', transferId)
            .maybeSingle();

          if (wr) {
            const nowIso = new Date().toISOString();
            await supabase
              .from('withdrawal_requests')
              .update({
                status: 'PAGO',
                paid_at: nowIso
              })
              .eq('id', wr.id);

            if (Array.isArray(wr.order_ids) && wr.order_ids.length > 0) {
              const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier'].includes(String(wr.role || '').toLowerCase());
              const updateField = isDriver ? { payout_driver_done: true } : { payout_seller_done: true };
              await supabase.from('orders').update(updateField).in('id', wr.order_ids);
            }
            console.log(`✅ Webhook Asaas: Saque #${wr.id} liquidado com sucesso (Transferência #${transferId})!`);
          }
        } else if (transferStatus === 'FAILED' || event === 'TRANSFER_FAILED' || event === 'TRANSFER_CANCELLED' || event === 'TRANSFER_REVERSED') {
          const failReason = transfer?.failReason || transfer?.description || `Transferência ${transferStatus.toLowerCase()} no Asaas`;
          const { data: wr } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('asaas_transfer_id', transferId)
            .maybeSingle();

          if (wr) {
            await supabase
              .from('withdrawal_requests')
              .update({
                status: 'FALHOU',
                failure_reason: failReason
              })
              .eq('id', wr.id);
            console.warn(`⚠️ Webhook Asaas: Saque #${wr.id} falhou (Transferência #${transferId}): ${failReason}`);
          }
        }
      }

      return NextResponse.json({ success: true, processed: true, event });
    }

    // 2. Processamento de Webhooks de Cobrança Pix (PAYMENT_*)
    const status = payment?.status || (event === 'PAYMENT_RECEIVED' ? 'RECEIVED' : event === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 'PENDING');
    const orderId = payment?.externalReference;
    const paymentId = payment?.id;

    const isPaid = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || 
                   status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH' ||
                   status === 'DUNNING_RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

    const isRefunded = event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_REFUND_IN_PROGRESS' || 
                       event === 'PAYMENT_DELETED' || status === 'REFUNDED';

    if (isPaid) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = getSupabaseAdmin();
        
        if (!orderId && !paymentId) {
          console.warn("⚠️ Webhook Asaas: Evento de pagamento recebido sem orderId nem paymentId. Abortando update em massa.");
          return NextResponse.json({ success: false, error: 'Identificador do pedido ausente' }, { status: 400 });
        }

        // Buscar dados do pedido para validação de integridade de valor
        let orderQuery = supabase.from('orders').select('id, status, charged_amount, products_subtotal');
        if (orderId) {
          orderQuery = orderQuery.eq('id', orderId);
        } else if (paymentId) {
          orderQuery = orderQuery.eq('asaas_payment_id', paymentId);
        }
        const { data: currentOrder } = await orderQuery.maybeSingle();

        if (currentOrder) {
          const expectedAmount = currentOrder.charged_amount ? Number(currentOrder.charged_amount) : null;
          const receivedAmount = payment?.value ? Number(payment.value) : null;

          if (expectedAmount !== null && receivedAmount !== null && Math.abs(expectedAmount - receivedAmount) > 0.05) {
            console.error(`🚨 [Webhook Asaas] Divergência de valor no pedido #${currentOrder.id}! Esperado: R$ ${expectedAmount}, Recebido: R$ ${receivedAmount}`);
            try {
              await supabase.from('incident_logs').insert({
                order_id: currentOrder.id,
                action_type: 'PAYMENT_VALUE_MISMATCH',
                description: `Valor pago no Asaas (R$ ${receivedAmount}) difere do valor cobrado (R$ ${expectedAmount})`,
                created_at: new Date().toISOString()
              });
            } catch (_logErr) {}
            return NextResponse.json({ success: false, error: 'Divergência no valor do pagamento recebido' }, { status: 400 });
          }
        }

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
          const finalOrderId = orderId || currentOrder?.id;
          if (finalOrderId) {
            try {
              await supabase.rpc('generate_delivery_pin', { p_order_id: finalOrderId });
            } catch (_e) {}
          }
        }
      }
    } else if (isRefunded) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey && (orderId || paymentId)) {
        const supabase = getSupabaseAdmin();
        let refundQuery = supabase.from('orders').update({
          status: 'REFUNDED',
          asaas_refund_status: 'REFUNDED',
          asaas_charge_status: 'REFUNDED',
          cancelled_at: new Date().toISOString()
        });

        if (orderId) {
          refundQuery = refundQuery.eq('id', orderId);
        } else if (paymentId) {
          refundQuery = refundQuery.eq('asaas_payment_id', paymentId);
        }

        await refundQuery;

        if (orderId) {
          try {
            await supabase.from('splits').update({ status: 'REVERSED' }).eq('order_id', orderId);
          } catch (_e) {}
        }
        console.log(`↩️ Webhook Asaas: Pedido #${orderId || paymentId} atualizado para REFUNDED com sucesso!`);
      }
    }

    return NextResponse.json({ success: true, processed: isPaid || isRefunded, event });

  } catch (err: any) {
    console.error("Erro no processamento do Webhook Asaas (POST):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
