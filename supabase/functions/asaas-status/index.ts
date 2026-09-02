import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, paymentId } = await req.json();

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_URL = 'https://www.asaas.com/api/v3';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar primeiro no banco de dados Supabase
    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, status, asaas_payment_id, asaas_charge_status')
        .eq('id', orderId)
        .maybeSingle();

      if (order) {
        const isPaid = ['PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'RECEIVED', 'COMPLETED', 'pendente', 'preparo', 'pronto', 'em_rota', 'aguardando_cliente', 'entregue'].includes(order.status) ||
                       order.asaas_charge_status === 'RECEIVED' || order.asaas_charge_status === 'CONFIRMED';

        if (isPaid) {
          return new Response(JSON.stringify({
            isPaid: true,
            status: order.asaas_charge_status || order.status,
            orderId: order.id,
            paymentId: order.asaas_payment_id || paymentId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 2. Se a chave do Asaas estiver configurada no Supabase Secrets, consultar a API oficial do Asaas
    if (ASAAS_API_KEY && (paymentId || orderId)) {
      let asaasData: any = null;

      // 2.1 Consulta direta por paymentId
      if (paymentId) {
        try {
          const res = await fetch(${ASAAS_URL}/payments/, {
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
          });
          if (res.ok) asaasData = await res.json();
        } catch (e) {
          console.warn("Erro ao consultar Asaas por paymentId:", e);
        }
      }

      // 2.2 Se não obteve por paymentId, consulta por externalReference (orderId)
      if (!asaasData && orderId) {
        try {
          const resList = await fetch(${ASAAS_URL}/payments?externalReference=, {
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
          });
          if (resList.ok) {
            const listJson = await resList.json();
            const payments = listJson.data || [];
            asaasData = payments.find((p: any) => 
              ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(p.status)
            ) || payments[0];
          }
        } catch (e) {
          console.warn("Erro ao consultar Asaas por externalReference:", e);
        }
      }

      if (asaasData && asaasData.id) {
        const chargeStatus = asaasData.status;
        const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(chargeStatus);

        if (isPaid) {
          const targetOrderId = asaasData.externalReference || orderId;
          if (targetOrderId) {
            // Atualizar pedido para PAID no banco
            await supabase
              .from('orders')
              .update({
                status: 'PAID',
                paid_at: new Date().toISOString(),
                asaas_payment_id: asaasData.id,
                asaas_charge_status: chargeStatus
              })
              .eq('id', targetOrderId);

            // Gerar PIN de segurança se necessário
            try {
              await supabase.rpc('generate_delivery_pin', { p_order_id: targetOrderId });
            } catch (_pinErr) {}
          }
        }

        return new Response(JSON.stringify({
          isPaid,
          status: chargeStatus,
          paymentId: asaasData.id,
          orderId: asaasData.externalReference || orderId,
          value: asaasData.value
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ isPaid: false, status: 'PENDING' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("Erro na Edge Function asaas-status:", err);
    return new Response(JSON.stringify({ isPaid: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
