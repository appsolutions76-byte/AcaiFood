import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getOrderPaymentCtx, getRootCtx } from '@/lib/paymentAccount';
import { refundSellerSplitPayment } from '@/lib/sellerRefund';
import { syncOrderRefund } from '@/lib/refundRecord';
import { reconcileWithdrawal } from '@/lib/withdrawalApproval';
import { reconcileSettlement } from '@/lib/orderSettlements';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    // Conta que emitiu a cobrança do pedido: conta raiz (modelo antigo) ou subconta da loja
    let ctxOrder: any = null;
    try {
      const sb = getSupabaseAdmin();
      if (orderId && UUID_RE.test(orderId)) {
        const { data } = await sb.from('orders').select('id, pricing_snapshot').eq('id', orderId).maybeSingle();
        ctxOrder = data;
      } else if (paymentId) {
        const { data } = await sb.from('orders').select('id, pricing_snapshot').eq('asaas_payment_id', paymentId).maybeSingle();
        ctxOrder = data;
      }
    } catch (_e) {}
    const payCtx = ctxOrder ? await getOrderPaymentCtx(ctxOrder) : await getRootCtx();
    const ASAAS_API_KEY = payCtx?.apiKey || '';
    const ASAAS_URL = payCtx?.baseUrl || '';

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

        // A cobrança precisa ser do próprio pedido (externalReference). Cobrança sem referência
        // ou de outro pedido nunca marca pedido como pago (auditoria A4).
        const refMatches = Boolean(data.externalReference) && (!orderId || data.externalReference === orderId);
        if (isPaid && refMatches && supabaseUrl && supabaseKey) {
          const targetOrderId = data.externalReference;
          if (targetOrderId) {
            try {
              const supabase = getSupabaseAdmin();
              const { data: dbOrder } = await supabase
                .from('orders')
                .select('id, status, charged_amount')
                .eq('id', targetOrderId)
                .maybeSingle();

              const expectedAmt = dbOrder?.charged_amount ? Number(dbOrder.charged_amount) : null;
              const paidAmt = data.value ? Number(data.value) : null;
              const isValueValid = (expectedAmt !== null && paidAmt !== null && Math.abs(expectedAmt - paidAmt) <= 0.05);

              if (isValueValid && dbOrder && ['PENDING', 'pendente', 'aguardando_pagamento', 'AWAITING_PAYMENT'].includes(dbOrder.status)) {
                await supabase.from('orders').update({
                  status: 'PAID',
                  paid_at: new Date().toISOString(),
                  asaas_payment_id: data.id,
                  asaas_charge_status: status
                }).eq('id', targetOrderId);

                try { await supabase.rpc('generate_delivery_pin', { p_order_id: targetOrderId }); } catch (_e) {}
                try { await supabase.rpc('generate_pickup_pin', { p_order_id: targetOrderId }); } catch (_e) {}
                // R35: novo aviso em tempo real depois dos PINs, para a loja não ver "Indisponível"
                try { await supabase.from('orders').update({ asaas_charge_status: status }).eq('id', targetOrderId); } catch (_e) {}
                // Coleta de caroço não tem loja vendedora: paga, já vai para o radar dos caminhões
                try { await supabase.from('orders').update({ status: 'READY', ready_at: new Date().toISOString() }).eq('id', targetOrderId).eq('order_type', 'COLETA').eq('status', 'PAID'); } catch (_e) {}
              } else if (dbOrder && isValueValid) {
                await supabase.from('orders').update({
                  asaas_payment_id: data.id,
                  asaas_charge_status: status
                }).eq('id', targetOrderId);
              }
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
          const { data: dbOrder } = await supabase
            .from('orders')
            .select('id, status, charged_amount')
            .eq('id', orderId)
            .maybeSingle();

          const expectedAmt = dbOrder?.charged_amount ? Number(dbOrder.charged_amount) : null;
          const paidAmt = paidPayment.value ? Number(paidPayment.value) : null;
          const isValueValid = (expectedAmt !== null && paidAmt !== null && Math.abs(expectedAmt - paidAmt) <= 0.05)
            && String(paidPayment.externalReference || '') === String(orderId);

          if (isValueValid && dbOrder && ['PENDING', 'pendente', 'aguardando_pagamento', 'AWAITING_PAYMENT'].includes(dbOrder.status)) {
            await supabase.from('orders').update({
              status: 'PAID',
              paid_at: new Date().toISOString(),
              asaas_payment_id: paidPayment.id,
              asaas_charge_status: paidPayment.status
            }).eq('id', orderId);

            try { await supabase.rpc('generate_delivery_pin', { p_order_id: orderId }); } catch (_e) {}
            try { await supabase.rpc('generate_pickup_pin', { p_order_id: orderId }); } catch (_e) {}
            // R35: novo aviso em tempo real depois dos PINs, para a loja não ver "Indisponível"
            try { await supabase.from('orders').update({ asaas_charge_status: paidPayment.status }).eq('id', orderId); } catch (_e) {}
            // Coleta de caroço não tem loja vendedora: paga, já vai para o radar dos caminhões
            try { await supabase.from('orders').update({ status: 'READY', ready_at: new Date().toISOString() }).eq('id', orderId).eq('order_type', 'COLETA').eq('status', 'PAID'); } catch (_e) {}
          } else if (dbOrder && isValueValid) {
            await supabase.from('orders').update({
              asaas_payment_id: paidPayment.id,
              asaas_charge_status: paidPayment.status
            }).eq('id', orderId);
          }
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
    console.log(`[Webhook Asaas] Evento recebido: ${body.event || 'N/A'}, ID: ${body.payment?.id || body.transfer?.id || body.id || 'N/A'}`);

    const event = body.event;
    const payment = body.payment || (event?.startsWith('PAYMENT_') ? body : null);
    const transfer = body.transfer || (event?.startsWith('TRANSFER_') ? body : null);

    // 1. Transferências (TRANSFER_*): o evento só avisa; o estado real é conferido na API do Asaas.
    //    Nunca envia Pix nem transferência a partir daqui.
    if (transfer || String(event || '').startsWith('TRANSFER_')) {
      const supabase = getSupabaseAdmin();
      const transferId = String(transfer?.id || body.id || '');
      const externalRef = String(transfer?.externalReference || '');
      try {
        let withdrawalId: string | null = null;
        if (externalRef.startsWith('WD_') && UUID_RE.test(externalRef.slice(3))) {
          withdrawalId = externalRef.slice(3);
        } else if (transferId) {
          const { data } = await supabase.from('withdrawal_requests').select('id').eq('asaas_transfer_id', transferId).limit(1);
          withdrawalId = data && data.length > 0 ? data[0].id : null;
        }
        if (withdrawalId) {
          const result = await reconcileWithdrawal(withdrawalId);
          return NextResponse.json({ success: true, processed: true, kind: 'withdrawal', event, status: result.status });
        }

        let settlementId: string | null = null;
        if (UUID_RE.test(externalRef)) {
          const { data } = await supabase.from('settlements').select('id').eq('id', externalRef).maybeSingle();
          settlementId = data?.id || null;
        }
        if (!settlementId && transferId) {
          const { data } = await supabase.from('settlements').select('id').eq('asaas_transfer_id', transferId).maybeSingle();
          settlementId = data?.id || null;
        }
        if (settlementId) {
          const result = await reconcileSettlement(settlementId);
          return NextResponse.json({ success: true, processed: true, kind: 'settlement', event, status: result.status });
        }
      } catch (trErr: any) {
        console.warn('[Webhook Asaas] Aviso ao conferir transferência:', trErr?.message);
      }
      return NextResponse.json({ success: true, processed: false, event });
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
            // Responde 200 para o Asaas reconhecer o recebimento e não pausar a fila de webhooks da conta
            return NextResponse.json({ success: true, processed: false, error: 'Divergência de valor registrada' });
          }
        }

        const currentStatus = String(currentOrder?.status || '').toUpperCase();
        const isCancelled = ['CANCELLED', 'CANCELADO', 'REFUNDED'].includes(currentStatus);

        // 1.3 Se o pagamento chegar para um pedido cancelado: registra incidente e estorna automaticamente
        if (isCancelled && paymentId) {
          console.warn(`⚠️ [Webhook Asaas] Pagamento recebido para pedido cancelado #${currentOrder?.id}. Disparando auto-estorno.`);
          try {
            await supabase.from('incident_logs').insert({
              order_id: currentOrder?.id || null,
              action_type: 'PAYMENT_AFTER_CANCEL',
              description: `Pix recebido após cancelamento do pedido (Cobrança #${paymentId}, R$ ${payment?.value}). Auto-estorno disparado.`,
              created_at: new Date().toISOString()
            });

            const { data: cancelledOrder } = await supabase.from('orders').select('id, pricing_snapshot, charged_amount').eq('id', currentOrder?.id || '').maybeSingle();
            const refundCtx = cancelledOrder ? await getOrderPaymentCtx(cancelledOrder) : await getRootCtx();
            const apiKey = refundCtx?.apiKey || '';
            if (apiKey) {
              const asaasUrl = refundCtx!.baseUrl;
              const autoDesc = 'Estorno automático: Pix recebido após cancelamento do pedido';
              let autoRefundData: any = {};
              const sellerIssuer = (refundCtx as any)?.model === 'SELLER_SPLIT' ? (refundCtx as any)?.issuerPartnerId : null;
              if (sellerIssuer && cancelledOrder) {
                // R23: mesma lógica do estorno manual (splitRefunds + cobertura da tarifa)
                const r = await refundSellerSplitPayment({
                  order: cancelledOrder,
                  paymentId,
                  sellerCtx: { apiKey, baseUrl: asaasUrl },
                  issuerPartnerId: sellerIssuer,
                  description: autoDesc
                });
                autoRefundData = r.ok ? (r.data || {}) : { status: 'REFUND_FAILED', error: r.error };
                if (!r.ok) console.error('[Webhook Asaas] Auto-estorno falhou:', r.error);
              } else {
                const autoRefundRes = await fetch(`${asaasUrl}/payments/${paymentId}/refund`, {
                  method: 'POST',
                  headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ description: autoDesc })
                });
                autoRefundData = await autoRefundRes.json().catch(() => ({}));
              }

              await supabase.from('refund_history').insert({
                order_id: currentOrder?.id || null,
                payment_id: paymentId,
                requested_value: payment?.value || currentOrder?.charged_amount || 0,
                asaas_refund_id: autoRefundData?.id || null,
                status: autoRefundData?.status || 'REFUNDED',
                requested_by: null // estorno automático do sistema (coluna é uuid de usuário)
              });
            }
          } catch (autoRefErr) {
            console.error("Erro ao executar auto-estorno de pagamento após cancelamento:", autoRefErr);
          }

          return NextResponse.json({ success: true, processed: true, autoRefunded: true, event });
        }

        const isCurrentlyPending = !currentOrder?.status || ['PENDING', 'pendente', 'aguardando_pagamento', 'AWAITING_PAYMENT'].includes(currentOrder.status);

        if (isCurrentlyPending) {
          let query = supabase.from('orders').update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
            asaas_payment_id: paymentId,
            asaas_charge_status: status
          }).in('status', ['PENDING', 'pendente', 'aguardando_pagamento', 'AWAITING_PAYMENT']);

          if (orderId) {
            query = query.eq('id', orderId);
          } else if (paymentId) {
            query = query.eq('asaas_payment_id', paymentId);
          }

          // Só gera PIN se ESTA chamada mudou o pedido para PAID (evita PIN novo em webhook repetido)
          const { data: transitioned, error } = await query.select('id');
          if (!error && (!transitioned || transitioned.length === 0)) {
            return NextResponse.json({ success: true, processed: false, alreadyPaid: true, event });
          }
          if (error) {
            console.warn("Erro ao atualizar pedido no Supabase via Webhook Asaas:", error);
          } else {
            console.log(`✅ Webhook Asaas: Pedido #${orderId || paymentId} atualizado para PAID com sucesso!`);
            
            // Gerar PIN de entrega e PIN de retirada
            const finalOrderId = orderId || currentOrder?.id;
            if (finalOrderId) {
              try {
                await supabase.rpc('generate_delivery_pin', { p_order_id: finalOrderId });
              } catch (_e) {}
              try {
                await supabase.rpc('generate_pickup_pin', { p_order_id: finalOrderId });
              } catch (_e) {}
              // R35: novo aviso em tempo real depois dos PINs, para a loja não ver "Indisponível"
              try { await supabase.from('orders').update({ asaas_charge_status: status }).eq('id', finalOrderId); } catch (_e) {}
              // Coleta de caroço não tem loja vendedora: paga, já vai para o radar dos caminhões
              try { await supabase.from('orders').update({ status: 'READY', ready_at: new Date().toISOString() }).eq('id', finalOrderId).eq('order_type', 'COLETA').eq('status', 'PAID'); } catch (_e) {}
            }
          }
        } else {
          // Pedido já foi aceito/está em preparo ou rota: apenas atualiza asaas_charge_status sem regredir o status nem regerar PINs
          let query = supabase.from('orders').update({
            asaas_payment_id: paymentId,
            asaas_charge_status: status
          });
          if (orderId) {
            query = query.eq('id', orderId);
          } else if (paymentId) {
            query = query.eq('asaas_payment_id', paymentId);
          }
          await query;
          console.log(`ℹ️ Webhook Asaas: Pedido #${orderId || paymentId} já em status '${currentOrder?.status}', mantendo status e atualizando flags Asaas.`);
        }
      }
    } else if (isRefunded) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey && (orderId || paymentId)) {
        const supabase = getSupabaseAdmin();
        let lookup = supabase.from('orders').select('id, status, pricing_snapshot, asaas_payment_id, cancelled_at');
        lookup = orderId ? lookup.eq('id', orderId) : lookup.eq('asaas_payment_id', paymentId);
        const { data: refOrder } = await lookup.maybeSingle();

        if (event === 'PAYMENT_DELETED') {
          // Cobrança não paga apagada (pedido cancelado antes do Pix): é cancelamento, não estorno
          if (refOrder?.id) {
            const st = String(refOrder.status || '').toUpperCase();
            if (['PENDING', 'AWAITING_PAYMENT', 'CREATED', 'CANCELLED'].includes(st)) {
              await supabase.from('orders').update({
                status: 'CANCELLED',
                asaas_charge_status: 'DELETED',
                cancelled_at: refOrder.cancelled_at || new Date().toISOString()
              }).eq('id', refOrder.id);
            }
          }
          console.log(`🗑️ Webhook Asaas: cobrança ${paymentId} apagada (pedido #${refOrder?.id || orderId || '-'}).`);
        } else if (refOrder?.id) {
          await supabase.from('orders').update({
            status: 'REFUNDED',
            asaas_refund_status: event === 'PAYMENT_REFUND_IN_PROGRESS' ? 'REFUND_IN_PROGRESS' : 'REFUNDED',
            asaas_charge_status: 'REFUNDED',
            cancelled_at: refOrder.cancelled_at || new Date().toISOString()
          }).eq('id', refOrder.id);

          try {
            await supabase.from('splits').update({ status: 'REVERSED' }).eq('order_id', refOrder.id);
          } catch (_e) {}

          // R28: grava valor, data, código Pix e comprovante do estorno
          try {
            await syncOrderRefund(refOrder, { paymentId: paymentId || refOrder.asaas_payment_id });
          } catch (syncErr) {
            console.warn('[Webhook Asaas] Aviso ao registrar comprovante do estorno:', syncErr);
          }
          console.log(`↩️ Webhook Asaas: Pedido #${refOrder.id} atualizado para REFUNDED com sucesso!`);
        }
      }
    }

    return NextResponse.json({ success: true, processed: isPaid || isRefunded, event });

  } catch (err: any) {
    console.error("Erro no processamento do Webhook Asaas (POST):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
