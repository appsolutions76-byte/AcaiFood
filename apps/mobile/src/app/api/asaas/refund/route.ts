import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin', 'loja', 'cliente', 'fornecedor', 'motorista']);
    const body = await request.json().catch(() => ({}));
    const { orderId, paymentId, description, reason, value } = body;

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: 'ID do pedido ou do pagamento é obrigatório para estorno' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);
    const supabase = getSupabaseAdmin();

    let asaasPaymentId = paymentId ? String(paymentId).trim() : '';
    let targetOrder: any = null;

    // 1. Buscar o pedido no banco de dados Supabase
    if (orderId) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      targetOrder = orderData;
      if (orderData?.asaas_payment_id && !asaasPaymentId) {
        asaasPaymentId = orderData.asaas_payment_id;
      }
    }

    // 2. Se ainda não tem asaasPaymentId, buscar por externalReference no Asaas
    if (!asaasPaymentId && orderId) {
      try {
        const searchRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(orderId)}`, {
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData?.data && searchData.data.length > 0) {
            asaasPaymentId = searchData.data[0].id;
            // Salvar no pedido para referência futura
            await supabase.from('orders').update({ asaas_payment_id: asaasPaymentId }).eq('id', orderId);
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar cobrança no Asaas por externalReference:", e);
      }
    }

    // 3. Validação de segurança: Não permitir estorno de pedidos entregues/concluídos
    if (targetOrder) {
      const currentStatus = String(targetOrder.status || '').toUpperCase();
      if (['RECEIVED', 'COMPLETED', 'DELIVERED', 'ENTREGUE'].includes(currentStatus)) {
        return NextResponse.json(
          { error: 'Não é permitido estorno automático após o pedido ter sido entregue e confirmado por PIN. Contate o suporte administrativo.' },
          { status: 400 }
        );
      }
    }

    const cancelReasonText = reason || description || 'Cancelamento solicitado pelo usuário antes do PIN';
    const actorId = auth.user?.id || auth.profile?.id || targetOrder?.cancelled_by || targetOrder?.buyer_id || null;

    let refundId: string | null = null;
    let refundStatus = 'REFUND_REQUESTED';
    let refundMessage = '';

    // 4. Se localizamos a cobrança no Asaas, verificar seu status atual antes de estornar
    if (asaasPaymentId) {
      const payRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });

      if (!payRes.ok) {
        const payErr = await payRes.json().catch(() => ({}));
        console.warn("Aviso ao consultar cobrança no Asaas:", payErr);
      } else {
        const payObj = await payRes.json();
        const asaasChargeStatus = String(payObj?.status || '').toUpperCase();
        const origValue = Number(payObj?.value || targetOrder?.charged_amount || targetOrder?.total_amount || 0);
        const refundValue = value ? Number(value) : origValue;

        // CASO A: Cobrança Paga / Recebida -> Executar Estorno Pix
        if (['RECEIVED', 'CONFIRMED'].includes(asaasChargeStatus)) {
          // Checar histórico para não ultrapassar o valor original
          try {
            const { data: existingRefunds } = await supabase
              .from('refund_history')
              .select('requested_value')
              .eq('payment_id', asaasPaymentId);

            const totalRefundedSoFar = (existingRefunds || []).reduce((acc: number, r: any) => acc + Number(r.requested_value || 0), 0);

            if (origValue > 0 && (totalRefundedSoFar + refundValue > origValue + 0.05)) {
              return NextResponse.json(
                { error: `Estorno recusado: a soma dos estornos (R$ ${totalRefundedSoFar.toFixed(2)} + R$ ${refundValue.toFixed(2)}) ultrapassa o valor pago do pedido (R$ ${origValue.toFixed(2)}).` },
                { status: 400 }
              );
            }
          } catch (chkErr) {
            console.warn("Aviso ao checar limite em refund_history:", chkErr);
          }

          console.log(`[Asaas Refund] Executando estorno Pix para ${asaasPaymentId} (R$ ${refundValue})...`);

          const refundBodyPayload: any = { description: cancelReasonText };
          if (refundValue > 0) refundBodyPayload.value = refundValue;

          const refundRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/refund`, {
            method: 'POST',
            headers: {
              'access_token': ASAAS_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(refundBodyPayload)
          });

          const refundData = await refundRes.json();

          if (refundRes.ok && !refundData.errors) {
            refundId = refundData.id || null;
            refundStatus = refundData.status || 'REFUNDED';
            refundMessage = `Estorno de R$ ${refundValue.toFixed(2)} processado com sucesso pelo Asaas via Pix!`;

            // Registrar no histórico de estornos
            try {
              await supabase.from('refund_history').insert({
                order_id: orderId || null,
                payment_id: asaasPaymentId,
                requested_value: refundValue,
                asaas_refund_id: refundId,
                status: refundStatus,
                requested_by: actorId
              });
            } catch (hisErr) {
              console.warn("Aviso ao inserir refund_history:", hisErr);
            }
          } else {
            const msg = refundData.errors
              ? refundData.errors.map((e: any) => e.description).join(', ')
              : (refundData.message || JSON.stringify(refundData));
            console.error("[Asaas Refund Error]:", msg);
            refundMessage = `Asaas Estorno: ${msg}`;
            refundStatus = 'REFUND_FAILED';

            // Retornar erro explicativo para o usuário
            return NextResponse.json({
              success: false,
              error: `Não foi possível estornar no Asaas: ${msg}`,
              status: refundStatus,
              paymentId: asaasPaymentId
            }, { status: 400 });
          }
        } 
        // CASO B: Cobrança Pendente (Ainda não paga pelo cliente) -> Cancelar cobrança no Asaas
        else if (['PENDING', 'AWAITING_PAYMENT', 'AWAITING_RISK_ANALYSIS'].includes(asaasChargeStatus)) {
          try {
            await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}`, {
              method: 'DELETE',
              headers: { 'access_token': ASAAS_API_KEY }
            });
          } catch (delErr) {
            console.warn("Aviso ao deletar cobrança pendente Asaas:", delErr);
          }
          refundStatus = 'CANCELLED_UNPAID';
          refundMessage = 'Pedido cancelado. A cobrança Pix pendente foi cancelada no Asaas (nenhum valor foi debitado).';
        }
        // CASO C: Cobrança Já Estornada
        else if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS'].includes(asaasChargeStatus)) {
          refundStatus = 'REFUNDED';
          refundMessage = 'A cobrança Pix já constava como estornada no Asaas.';
        }
        else {
          refundStatus = 'CANCELLED';
          refundMessage = `Pedido cancelado (status Asaas: ${asaasChargeStatus}).`;
        }
      }
    } else {
      refundStatus = 'NO_PAYMENT_FOUND_CANCELLED';
      refundMessage = 'Pedido cancelado no sistema (nenhuma cobrança Pix vinculada).';
    }

    // 5. Atualizar status do pedido no Supabase
    if (orderId) {
      try {
        const finalDbStatus = (refundStatus === 'REFUNDED') ? 'REFUNDED' : 'CANCELLED';

        await supabase.from('orders').update({
          status: finalDbStatus,
          cancellation_reason: cancelReasonText,
          asaas_refund_id: refundId,
          asaas_refund_status: refundStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: actorId
        }).eq('id', orderId);

        // Reverter splits associados
        if (finalDbStatus === 'REFUNDED') {
          await supabase.from('splits').update({ status: 'REVERSED' }).eq('order_id', orderId);
        }

        // Registrar auditoria
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          from_status: targetOrder?.status || 'PAID',
          to_status: finalDbStatus,
          actor_id: actorId,
          actor_role: auth.profile?.role || 'USER',
          reason: cancelReasonText
        });
      } catch (dbErr) {
        console.warn("Erro ao atualizar status do pedido no Supabase:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      refundId: refundId,
      status: refundStatus,
      message: refundMessage || 'Operação de cancelamento/estorno concluída com sucesso.'
    });

  } catch (error: any) {
    console.error("Erro interno na API de estorno:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar estorno' },
      { status: 500 }
    );
  }
}
