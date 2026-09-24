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

    // 1. Buscar pedidos pendentes com ID de cobrança Asaas criados desde 23/09/2026
    const { data: pendingOrders, error: pendingErr } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        seller_storefront_id,
        order_type,
        status,
        products_subtotal,
        delivery_distance_km,
        asaas_payment_id,
        asaas_charge_status,
        payment_reconciled_manually,
        created_at,
        paid_at,
        delivery_pin,
        pickup_pin
      `)
      .in('status', ['PENDING', 'aguardando_pagamento'])
      .not('asaas_payment_id', 'is', null)
      .gte('created_at', '2026-09-23T00:00:00Z')
      .order('created_at', { ascending: false });

    if (pendingErr) {
      console.error("Erro ao buscar pedidos a conciliar:", pendingErr);
      return NextResponse.json({ error: 'Erro ao listar pedidos' }, { status: 500 });
    }

    // Buscar dados complementares de usuários e lojas
    const buyerIds = Array.from(new Set((pendingOrders || []).map(o => o.buyer_id).filter(Boolean)));
    const sfIds = Array.from(new Set((pendingOrders || []).map(o => o.seller_storefront_id).filter(Boolean)));

    let buyersMap: Record<string, any> = {};
    if (buyerIds.length > 0) {
      const { data: uData } = await supabase.from('users').select('id, name, email, phone, cpf_cnpj').in('id', buyerIds);
      (uData || []).forEach(u => { buyersMap[u.id] = u; });
    }

    let storesMap: Record<string, any> = {};
    if (sfIds.length > 0) {
      const { data: sfData } = await supabase.from('storefronts').select('id, store_name, partner_id').in('id', sfIds);
      (sfData || []).forEach(s => { storesMap[s.id] = s; });
    }

    const enrichedPending = (pendingOrders || []).map(o => ({
      ...o,
      buyer: buyersMap[o.buyer_id] || null,
      store: storesMap[o.seller_storefront_id] || null
    }));

    // 2. Buscar histórico recente de conciliações
    const { data: reconciledOrders } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        order_type,
        status,
        products_subtotal,
        asaas_payment_id,
        payment_reconciled_manually,
        pix_end_to_end_id,
        charged_amount,
        reconciled_at,
        created_at
      `)
      .eq('payment_reconciled_manually', true)
      .order('reconciled_at', { ascending: false })
      .limit(30);

    const reconciledBuyerIds = Array.from(new Set((reconciledOrders || []).map(o => o.buyer_id).filter(Boolean)));
    let recBuyersMap: Record<string, any> = {};
    if (reconciledBuyerIds.length > 0) {
      const { data: ruData } = await supabase.from('users').select('id, name, email, phone').in('id', reconciledBuyerIds);
      (ruData || []).forEach(u => { recBuyersMap[u.id] = u; });
    }

    const enrichedReconciled = (reconciledOrders || []).map(o => ({
      ...o,
      buyer: recBuyersMap[o.buyer_id] || null
    }));

    return NextResponse.json({
      success: true,
      pendingOrders: enrichedPending,
      reconciledOrders: enrichedReconciled
    });

  } catch (error: any) {
    console.error("Erro na rota GET /api/admin/reconcile-payment:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
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
          const delData = await delRes.json();
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
    // AÇÃO 2: CANCELAR E REGISTRAR DEVOLUÇÃO
    // ==========================================
    if (action === 'cancel_and_refund') {
      // Cancelar cobrança pendente no Asaas
      if (order.asaas_payment_id && ASAAS_API_KEY) {
        try {
          await fetch(`${ASAAS_URL}/payments/${order.asaas_payment_id}`, {
            method: 'DELETE',
            headers: { 'access_token': ASAAS_API_KEY }
          });
        } catch (delErr) {
          console.warn("Aviso ao cancelar cobrança Asaas:", delErr);
        }
      }

      const { error: cancelErr } = await supabase
        .from('orders')
        .update({
          status: 'CANCELLED',
          asaas_charge_status: 'CANCELLED'
        })
        .eq('id', orderId);

      if (cancelErr) {
        return NextResponse.json({ error: 'Erro ao cancelar pedido' }, { status: 500 });
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
          description: `Pedido #${orderId.slice(0, 8)} cancelado com devolução feita manualmente pelo admin. Motivo: ${reason || 'Cliente desistiu / não compensado'}. Cobrança Asaas ${order.asaas_payment_id || 'N/A'} cancelada.`,
          severity: 'MEDIA',
          status: 'RESOLVIDO',
          resolution_notes: reason || 'Cancelado e devolvido manualmente'
        });
      } catch (logErr) {
        console.warn("Aviso ao salvar incident_log:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Pedido #${orderId.slice(0, 8)} cancelado e devolução manual registrada com sucesso.`
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro no processamento POST /api/admin/reconcile-payment:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
