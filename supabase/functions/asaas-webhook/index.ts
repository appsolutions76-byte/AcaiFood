import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  try {
    const webhookTokenHeader = req.headers.get('asaas-access-token');
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

    if (!expectedToken || webhookTokenHeader !== expectedToken) {
      console.error("Token do webhook Asaas ausente/inválido — requisição recusada.");
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const event = body.event;
    const payment = body.payment;

    console.log(`Evento Webhook Asaas recebido: ${event}`, payment?.id || body.account?.id || '');

    // -------------------------------------------------------------
    // 1. TRATAMENTO DE EVENTOS DE PAGAMENTO DE PEDIDOS
    // -------------------------------------------------------------
    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && payment) {
      const orderId = payment.externalReference;
      const paymentId = payment.id;

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      if (orderId) {
        // 1. Buscar status atual do pedido para garantir idempotência
        const { data: existingOrder } = await supabaseClient
          .from('orders')
          .select('id, status, pin_hash')
          .eq('id', orderId)
          .maybeSingle();

        if (existingOrder) {
          // Idempotência: não reprocessar se já estiver pago ou em etapas posteriores
          const alreadyPaidStatuses = ['PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'RECEIVED', 'COMPLETED'];
          if (!alreadyPaidStatuses.includes(existingOrder.status)) {
            // Atualiza o pedido para PAGO
            const { error: updateError } = await supabaseClient
              .from('orders')
              .update({ 
                status: 'PAID', 
                asaas_payment_id: paymentId,
                asaas_charge_status: payment.status || 'RECEIVED',
                paid_at: new Date().toISOString()
              })
              .eq('id', orderId);

            if (updateError) {
              console.error(`Erro ao atualizar pedido ${orderId} no Supabase:`, updateError);
            } else {
              console.log(`Pedido ${orderId} marcado com sucesso como PAID pelo Asaas!`);
              
              // 2. Gerar PIN seguro via backend se ainda não possuir hash
              try {
                await supabaseClient.rpc('generate_delivery_pin', { p_order_id: orderId });
              } catch (pinErr) {
                console.warn("Aviso ao gerar PIN seguro via RPC:", pinErr);
              }

              // 3. Registrar auditoria em order_status_history
              try {
                await supabaseClient.from('order_status_history').insert({
                  order_id: orderId,
                  from_status: existingOrder.status,
                  to_status: 'PAID',
                  actor_role: 'SYSTEM_ASAAS_WEBHOOK',
                  reason: `Pagamento Pix confirmado no Asaas (${event})`
                });
              } catch (histErr) {
                console.warn("Aviso ao registrar histórico:", histErr);
              }
            }
          } else {
            console.log(`Webhook idempotente: Pedido ${orderId} já se encontra em status ${existingOrder.status}.`);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 2. TRATAMENTO DE EVENTOS DE STATUS DE SUBCONTA (Resolução 16/2025)
    // -------------------------------------------------------------
    if (typeof event === 'string' && event.startsWith('ACCOUNT_STATUS_')) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const accountObj = body.account || body;
      const accountId = accountObj.id || body.accountId;
      const walletId = accountObj.walletId || body.walletId;

      console.log(`Webhook Asaas - Evento de conta: ${event} | AccountId: ${accountId} | WalletId: ${walletId}`);

      let query = supabaseClient.from('users').select('id, asaas_account_status, split_enabled, asaas_wallet_id, asaas_account_id');
      if (walletId) {
        query = query.eq('asaas_wallet_id', walletId);
      } else if (accountId) {
        query = query.eq('asaas_account_id', accountId);
      } else {
        query = null as any;
      }

      if (query) {
        const { data: targetUser } = await query.maybeSingle();

        if (targetUser) {
          let newStatus = targetUser.asaas_account_status || 'PENDING_DOCUMENTS';
          let newSplitEnabled: boolean | undefined = undefined;

          if (event.includes('APPROVED')) {
            if (event.includes('GENERAL_APPROVAL')) {
              newStatus = 'APPROVED';
              newSplitEnabled = true;
            } else if (newStatus === 'PENDING_DOCUMENTS') {
              newStatus = 'AWAITING_APPROVAL';
            }
          } else if (event.includes('REJECTED')) {
            newStatus = 'REJECTED';
            newSplitEnabled = false;
          } else if (event.includes('AWAITING_APPROVAL')) {
            newStatus = 'AWAITING_APPROVAL';
            newSplitEnabled = false;
          } else if (event.includes('PENDING')) {
            newStatus = 'PENDING_DOCUMENTS';
            newSplitEnabled = false;
          }

          const updatePayload: any = {
            asaas_account_status: newStatus,
            updated_at: new Date().toISOString()
          };

          if (newSplitEnabled !== undefined) {
            updatePayload.split_enabled = newSplitEnabled;
          }

          const { error: accUpdErr } = await supabaseClient
            .from('users')
            .update(updatePayload)
            .eq('id', targetUser.id);

          if (accUpdErr) {
            console.error(`Erro ao atualizar status da subconta do usuário ${targetUser.id}:`, accUpdErr);
          } else {
            console.log(`Status da subconta do usuário ${targetUser.id} atualizado para ${newStatus} (split_enabled: ${updatePayload.split_enabled ?? targetUser.split_enabled})`);

            // Histórico de auditoria
            try {
              await supabaseClient.from('account_status_history').insert({
                user_id: targetUser.id,
                asaas_account_id: accountId || targetUser.asaas_account_id,
                asaas_wallet_id: walletId || targetUser.asaas_wallet_id,
                from_status: targetUser.asaas_account_status || 'PENDING_DOCUMENTS',
                to_status: newStatus,
                actor_role: 'SYSTEM_ASAAS_WEBHOOK',
                reason: `Evento Webhook Asaas: ${event}`
              });
            } catch (histErr) {
              console.warn("Aviso ao registrar histórico de status de conta:", histErr);
            }
          }
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
