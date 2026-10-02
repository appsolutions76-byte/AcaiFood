import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();

    // 1. Buscar pedidos pendentes de forma segura com select('*')
    let rawPendingOrders: any[] = [];
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['PENDING', 'aguardando_pagamento', 'pending'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        rawPendingOrders = data;
      }
    } catch (e) {
      console.warn("Aviso ao buscar pendingOrders:", e);
    }

    // 2. Buscar pedidos conciliados ou com estorno/cancelamento
    let rawReconciledOrders: any[] = [];
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or('payment_reconciled_manually.eq.true,status.in.(REFUNDED,CANCELLED,CANCELED)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        rawReconciledOrders = data;
      } else {
        // Fallback simples caso a coluna payment_reconciled_manually não esteja indexada
        const { data: fallbackData } = await supabase
          .from('orders')
          .select('*')
          .in('status', ['REFUNDED', 'CANCELLED', 'CANCELED'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (Array.isArray(fallbackData)) {
          rawReconciledOrders = fallbackData;
        }
      }
    } catch (e) {
      console.warn("Aviso ao buscar reconciledOrders:", e);
    }

    // 3. Buscar dados complementares de usuários (compradores) e lojas
    const allOrders = [...rawPendingOrders, ...rawReconciledOrders];
    const buyerIds = Array.from(new Set(allOrders.map(o => o.buyer_id).filter(Boolean)));
    const sfIds = Array.from(new Set(allOrders.map(o => o.seller_storefront_id).filter(Boolean)));

    let buyersMap: Record<string, any> = {};
    if (buyerIds.length > 0) {
      try {
        const { data: uData } = await supabase
          .from('users')
          .select('id, name, email, phone, cpf_cnpj')
          .in('id', buyerIds);
        (uData || []).forEach(u => { buyersMap[u.id] = u; });
      } catch (_uErr) {
        console.warn("Aviso ao buscar buyersMap:", _uErr);
      }
    }

    let storesMap: Record<string, any> = {};
    if (sfIds.length > 0) {
      try {
        const { data: sfData } = await supabase
          .from('storefronts')
          .select('id, store_name, partner_id')
          .in('id', sfIds);
        (sfData || []).forEach(s => { storesMap[s.id] = s; });
      } catch (_sErr) {
        console.warn("Aviso ao buscar storesMap:", _sErr);
      }
    }

    const enrichedPending = rawPendingOrders.map(o => ({
      ...o,
      buyer: buyersMap[o.buyer_id] || null,
      store: storesMap[o.seller_storefront_id] || null
    }));

    const enrichedReconciled = rawReconciledOrders.map(o => ({
      ...o,
      buyer: buyersMap[o.buyer_id] || null,
      store: storesMap[o.seller_storefront_id] || null
    }));

    return NextResponse.json({
      success: true,
      pendingOrders: enrichedPending,
      reconciledOrders: enrichedReconciled
    });

  } catch (error: any) {
    console.error("Erro na rota GET /api/admin/reconcile-payment:", error);
    // Sempre retornar JSON válido e vazio em caso de falha para não travar a tela do Admin
    return NextResponse.json({
      success: true,
      pendingOrders: [],
      reconciledOrders: []
    });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json().catch(() => ({}));
    const { action, orderId, pixEndToEndId, confirmedAmount, notes, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const adminUser = auth.user || auth.profile;

    // 1. Buscar o pedido
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    // ==========================================
    // AÇÃO 1: CONFIRMAR PAGAMENTO RECEBIDO FORA DO ASAAS
    // ==========================================
    if (action === 'confirm_manual') {
      if (!pixEndToEndId || typeof pixEndToEndId !== 'string' || !pixEndToEndId.trim()) {
        return NextResponse.json({ error: 'ID / End-to-End do Pix recebido é obrigatório para conciliação manual.' }, { status: 400 });
      }

      const numAmount = Number(confirmedAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Valor confirmado inválido.' }, { status: 400 });
      }

      // Cancelar cobrança pendente no Asaas para não ser paga duas vezes
      if (order.asaas_payment_id && ASAAS_API_KEY) {
        try {
          const delRes = await fetch(`${ASAAS_URL}/payments/${order.asaas_payment_id}`, {
            method: 'DELETE',
            headers: { 'access_token': ASAAS_API_KEY }
          });
          const delData = await delRes.json().catch(() => ({}));
          console.log(`Cancelamento Asaas para pedido ${order.id}:`, delData);
        } catch (delErr) {
          console.warn("Aviso ao cancelar cobrança Asaas:", delErr);
        }
      }

      const deliveryPin = order.delivery_pin || Math.floor(1000 + Math.random() * 9000).toString();
      const pickupPin = order.pickup_pin || (order.order_type !== 'COLETA' ? Math.floor(1000 + Math.random() * 9000).toString() : null);

      // Atualizar pedido para PAID com travas de conciliação manual
      const { error: updErr } = await supabase
        .from('orders')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          payment_reconciled_manually: true,
          pix_end_to_end_id: pixEndToEndId.trim(),
          charged_amount: numAmount,
          delivery_pin: deliveryPin,
          pickup_pin: pickupPin,
          reconciled_by: adminUser?.id || null,
          reconciled_at: new Date().toISOString(),
          asaas_charge_status: 'RECEIVED'
        })
        .eq('id', orderId);

      if (updErr) {
        console.error("Erro ao atualizar status do pedido para PAID:", updErr);
        return NextResponse.json({ error: 'Erro ao conciliar pedido no banco de dados' }, { status: 500 });
      }

      // Registrar auditoria em incident_logs
      try {
        await supabase.from('incident_logs').insert({
          order_id: orderId,
          user_id: adminUser?.id || null,
          user_name: auth.profile?.name || 'Administrador',
          user_role: 'admin',
          category: 'ESTORNO_PIX',
          title: 'Conciliação manual de Pix fora do Asaas',
          description: `Pedido #${orderId.slice(0, 8)} conciliado manualmente. Pix E2E: ${pixEndToEndId.trim()} | Valor: R$ ${numAmount.toFixed(2)}. Cobrança Asaas ${order.asaas_payment_id || 'N/A'} cancelada. ATENÇÃO: Repasse ao parceiro deve ser feito manualmente. Observações: ${notes || 'Nenhuma'}.`,
          severity: 'BAIXA',
          status: 'RESOLVIDO',
          resolution_notes: `Conciliado manualmente por ${auth.profile?.name || 'Admin'} em ${new Date().toLocaleString('pt-BR')}`
        });
      } catch (logErr) {
        console.warn("Aviso ao salvar incident_log:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Pedido #${orderId.slice(0, 8)} conciliado com sucesso! Cobrança Asaas cancelada e pedido liberado para a loja.`
      });
    }

    // ==========================================
    // AÇÃO 2: CANCELAR E REGISTRAR DEVOLUÇÃO / ESTORNO
    // ==========================================
    if (action === 'cancel_and_refund') {
      let asaasRefundMessage = '';
      let asaasRefundStatus = 'CANCELLED';

      if (order.asaas_payment_id && ASAAS_API_KEY) {
        try {
          const payRes = await fetch(`${ASAAS_URL}/payments/${order.asaas_payment_id}`, {
            headers: { 'access_token': ASAAS_API_KEY }
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            const chargeStatus = String(payData.status || '').toUpperCase();

            if (['RECEIVED', 'CONFIRMED'].includes(chargeStatus)) {
              // Estorno Pix no Asaas
              const refRes = await fetch(`${ASAAS_URL}/payments/${order.asaas_payment_id}/refund`, {
                method: 'POST',
                headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: reason || 'Cancelamento e devolução solicitados pelo administrador' })
              });
              const refData = await refRes.json().catch(() => ({}));
              if (refRes.ok && !refData.errors) {
                asaasRefundStatus = 'REFUNDED';
                asaasRefundMessage = 'Estorno Pix processado com sucesso no Asaas.';
                await supabase.from('refund_history').insert({
                  order_id: orderId,
                  payment_id: order.asaas_payment_id,
                  requested_value: Number(payData.value || order.charged_amount || 0),
                  asaas_refund_id: refData.id || null,
                  status: 'REFUNDED',
                  requested_by: adminUser?.id || null
                });
              } else {
                const msg = refData.errors ? refData.errors.map((e: any) => e.description).join(', ') : (refData.message || JSON.stringify(refData));
                console.warn("Aviso ao solicitar estorno Asaas:", msg);
                asaasRefundMessage = `Aviso Asaas: ${msg}`;
              }
            } else if (['PENDING', 'AWAITING_PAYMENT'].includes(chargeStatus)) {
              await fetch(`${ASAAS_URL}/payments/${order.asaas_payment_id}`, {
                method: 'DELETE',
                headers: { 'access_token': ASAAS_API_KEY }
              });
              asaasRefundMessage = 'Cobrança Pix pendente cancelada no Asaas.';
            }
          }
        } catch (delErr) {
          console.warn("Aviso ao cancelar/estornar cobrança Asaas:", delErr);
        }
      }

      const finalStatus = asaasRefundStatus === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED';

      const { error: cancelErr } = await supabase
        .from('orders')
        .update({
          status: finalStatus,
          asaas_charge_status: finalStatus,
          cancellation_reason: reason || 'Cancelado pelo administrador',
          cancelled_at: new Date().toISOString(),
          cancelled_by: adminUser?.id || null
        })
        .eq('id', orderId);

      if (cancelErr) {
        return NextResponse.json({ error: 'Erro ao cancelar pedido no banco de dados' }, { status: 500 });
      }

      // Registrar auditoria em incident_logs
      try {
        await supabase.from('incident_logs').insert({
          order_id: orderId,
          user_id: adminUser?.id || null,
          user_name: auth.profile?.name || 'Administrador',
          user_role: 'admin',
          category: 'CANCELAMENTO',
          title: 'Pedido cancelado e devolvido manualmente',
          description: `Pedido #${orderId.slice(0, 8)} cancelado com devolução feita manualmente pelo admin. Motivo: ${reason || 'Cliente desistiu / não compensado'}. Cobrança Asaas ${order.asaas_payment_id || 'N/A'} cancelada. ${asaasRefundMessage}`,
          severity: 'MEDIA',
          status: 'RESOLVIDO',
          resolution_notes: reason || 'Cancelado e devolvido manualmente'
        });
      } catch (logErr) {
        console.warn("Aviso ao salvar incident_log:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Pedido #${orderId.slice(0, 8)} cancelado e devolução registrada com sucesso. ${asaasRefundMessage}`
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro no processamento POST /api/admin/reconcile-payment:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
