import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  try {
    const webhookTokenHeader = req.headers.get('asaas-access-token');
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

    // Validação opcional de segurança se o token for configurado no Supabase
    if (expectedToken && webhookTokenHeader && webhookTokenHeader !== expectedToken) {
      console.error("Token do webhook Asaas é inválido!");
      return new Response('Unauthorized', { status: 401 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const event = body.event;
    const payment = body.payment;

    console.log(`Evento Webhook Asaas recebido: ${event}`, payment?.id);

    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && payment) {
      const orderId = payment.externalReference;
      const paymentId = payment.id;

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      if (orderId) {
        // Atualiza o pedido para PAGO
        const { error } = await supabaseClient
          .from('orders')
          .update({ 
            status: 'PAID', 
            asaas_payment_id: paymentId,
            asaas_charge_status: payment.status || 'RECEIVED'
          })
          .eq('id', orderId);

        if (error) {
          console.error(`Erro ao atualizar pedido ${orderId} no Supabase:`, error);
        } else {
          console.log(`Pedido ${orderId} marcado com sucesso como PAID pelo Asaas!`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("Erro na Edge Function asaas-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
