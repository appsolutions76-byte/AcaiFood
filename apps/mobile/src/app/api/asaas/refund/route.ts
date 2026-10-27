import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { getOrderPaymentCtx } from '@/lib/paymentAccount';
import { refundSellerSplitPayment } from '@/lib/sellerRefund';
import { syncOrderRefund } from '@/lib/refundRecord';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin', 'loja', 'cliente', 'fornecedor', 'motorista']);
    if (!auth.authorized) {
      return unauthorizedResponse(auth.error || 'Acesso negado: faça login para solicitar estorno ou cancelamento.');
    }

    const body = await request.json().catch(() => ({}));
    const { orderId, paymentId, description, reason } = body; // valor nunca vem do navegador

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: 'ID do pedido (UUID) ou ID da cobrança Asaas é obrigatório para estorno' },
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

    let ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);
    const supabase = getSupabaseAdmin();
    let REQ_KEY = ASAAS_API_KEY;
    let isSellerSplit = false;
    let sellerIssuerId: string | null = null;

    let asaasPaymentId = paymentId ? String(paymentId).trim() : '';
    let targetOrder: any = null;
    const cleanOrderId = orderId ? String(orderId).trim() : '';
    const isUUID = cleanOrderId ? UUID_REGEX.test(cleanOrderId) : false;

    // 1. Buscar o pedido no banco de dados Supabase por UUID completo
    if (cleanOrderId && isUUID) {
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('*')
          .eq('id', cleanOrderId)
          .maybeSingle();

        targetOrder = orderData;
      } catch (err) {
        console.warn("Aviso ao buscar pedido por UUID:", err);
      }
    }

    // Se o cleanOrderId for na verdade um paymentId do Asaas (começa com pay_ ou cbr_)
    if (!asaasPaymentId && (cleanOrderId.startsWith('pay_') || cleanOrderId.startsWith('cbr_'))) {
      asaasPaymentId = cleanOrderId;
    }

    // 2. Se não encontrou por ID direto mas tem asaasPaymentId, buscar na tabela por asaas_payment_id
    if (!targetOrder && asaasPaymentId) {
      try {
        const { data: orderDataByPay } = await supabase
          .from('orders')
          .select('*')
          .eq('asaas_payment_id', asaasPaymentId)
          .maybeSingle();

        if (orderDataByPay) {
          targetOrder = orderDataByPay;
        }
      } catch (err) {
        console.warn("Aviso ao buscar pedido por asaas_payment_id:", err);
      }
    }

    if (targetOrder?.asaas_payment_id && !asaasPaymentId) {
      asaasPaymentId = targetOrder.asaas_payment_id;
    }

    // Cobrança emitida na subconta da loja (modelo novo): consulta e estorno com a chave dela
    if (targetOrder) {
      const orderCtx = await getOrderPaymentCtx(targetOrder);
      if (orderCtx?.model === 'SELLER_SPLIT') {
        REQ_KEY = orderCtx.apiKey;
        ASAAS_URL = orderCtx.baseUrl;
        isSellerSplit = true;
        sellerIssuerId = orderCtx.issuerPartnerId;
      }
    }

    // 3. Se ainda não tem asaasPaymentId e é um UUID válido, buscar por externalReference no Asaas
    const referenceToSearch = targetOrder?.id || (isUUID ? cleanOrderId : null);
    if (!asaasPaymentId && referenceToSearch) {
      try {
        const searchRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(referenceToSearch)}`, {
          headers: { 'access_token': REQ_KEY, 'Content-Type': 'application/json' }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData?.data && searchData.data.length > 0) {
            asaasPaymentId = searchData.data[0].id;
            if (targetOrder?.id) {
              await supabase.from('orders').update({ asaas_payment_id: asaasPaymentId }).eq('id', targetOrder.id);
            }
          }
        }
      } catch (e) {
        console.warn("Aviso ao buscar cobrança no Asaas por externalReference:", e);
      }
    }

    // 4. Validação de segurança e permissão de cancelamento por papel e fase (Fase 1.1 e 1.2)
    const callerId = auth.user?.id || auth.profile?.id;
    const userRole = String(auth.profile?.role || '').toLowerCase();
    const isAdmin = auth.source === 'internal_secret' || auth.source === 'cron_secret' || userRole === 'admin' || auth.profile?.is_admin === true;

    // 1.1 Se nenhum pedido for encontrado por UUID nem paymentId, apenas Administrador tem permissão
    if (!targetOrder && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem estornar cobranças avulsas sem pedido associado.' },
        { status: 403 }
      );
    }

    // Se a cobrança for taxa de ativação (ACTIVATE_), apenas admin pode estornar e desativa a subconta
    if (referenceToSearch && referenceToSearch.startsWith('ACTIVATE_')) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Apenas administradores podem estornar taxa de ativação.' }, { status: 403 });
      }
      const targetUserId = referenceToSearch.replace('ACTIVATE_', '');
      try {
        await supabase.from('users').update({ 
          asaas_account_status: 'PENDING_PAYMENT',
          split_enabled: false 
        }).eq('id', targetUserId);
      } catch (_actErr) {
        console.warn("Aviso ao desativar parceiro após estorno de ativação:", _actErr);
      }
    }

    if (targetOrder && !isAdmin) {
      let isStoreOwner = false;
      if (targetOrder.seller_storefront_id && callerId) {
        const { data: sf } = await supabase.from('storefronts').select('partner_id').eq('id', targetOrder.seller_storefront_id).maybeSingle();
        if (sf?.partner_id === callerId) {
          isStoreOwner = true;
        }
      }

      const isBuyer = targetOrder.buyer_id === callerId;
      const currentStatus = String(targetOrder.status || '').toUpperCase();

      if (!isBuyer && !isStoreOwner) {
        return NextResponse.json({ error: 'Você não tem permissão para estornar ou cancelar este pedido.' }, { status: 403 });
      }

      // 1.2 Regras de momento do cancelamento:
      // Comprador: só em PENDING ou PAID (antes de a loja iniciar o preparo)
      if (isBuyer && !['PENDING', 'PENDENTE', 'AGUARDANDO_PAGAMENTO', 'AWAITING_PAYMENT', 'PAID'].includes(currentStatus)) {
        return NextResponse.json(
          { error: 'O pedido já está em preparação ou rota. O cancelamento pelo cliente não é mais permitido diretamente. Contate a loja ou o suporte.' },
          { status: 400 }
        );
      }

      // Loja: pode cancelar até READY (antes do motorista retirar em rota)
      if (isStoreOwner && !['PENDING', 'PAID', 'PREPARING', 'PREPARO', 'READY', 'PRONTO'].includes(currentStatus)) {
        return NextResponse.json(
          { error: 'O pedido já saiu para entrega. O cancelamento pela loja requer intermediação do suporte administrativo.' },
          { status: 400 }
        );
      }

      // Em rota ou entregue: apenas Administrador
      if (['DELIVERING', 'EM_ROTA', 'DELIVERED', 'ENTREGUE', 'RECEIVED', 'COMPLETED', 'CONCLUIDO'].includes(currentStatus)) {
        return NextResponse.json(
          { error: 'Pedidos em rota de entrega ou finalizados só podem ser cancelados/estornados pelo administrador.' },
          { status: 403 }
        );
      }
    }

    const cancelReasonText = reason || description || 'Cancelamento solicitado pelo usuário antes do PIN';
    const actorId = auth.user?.id || auth.profile?.id || targetOrder?.cancelled_by || targetOrder?.buyer_id || null;

    let refundId: string | null = null;
    let refundStatus = 'REFUND_REQUESTED';
    let refundMessage = '';

    // 6. Se localizamos a cobrança no Asaas, verificar seu status atual antes de estornar
    if (asaasPaymentId) {
      const payRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}`, {
        headers: { 'access_token': REQ_KEY, 'Content-Type': 'application/json' }
      });

      if (!payRes.ok) {
        const payErr = await payRes.json().catch(() => ({}));
        console.warn("Aviso ao consultar cobrança no Asaas:", payErr);
      } else {
        const payObj = await payRes.json();
        const asaasChargeStatus = String(payObj?.status || '').toUpperCase();
        const origValue = Number(payObj?.value || targetOrder?.charged_amount || targetOrder?.total_amount || 0);

        // CASO A: Cobrança Paga / Recebida -> Executar Estorno Pix
        if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'].includes(asaasChargeStatus)) {
          // Checar histórico de estornos anteriores da mesma cobrança
          let totalRefundedSoFar = 0;
          try {
            const { data: existingRefunds } = await supabase
              .from('refund_history')
              .select('requested_value')
              .eq('payment_id', asaasPaymentId);

            totalRefundedSoFar = (existingRefunds || []).reduce((acc: number, r: any) => acc + Number(r.requested_value || 0), 0);
          } catch (chkErr) {
            console.warn("Aviso ao checar limite em refund_history:", chkErr);
          }

          // Se já houve estorno parcial anterior, estornar apenas o saldo restante
          const remainingToRefund = Math.max(0, origValue - totalRefundedSoFar);
          
          if (origValue > 0 && totalRefundedSoFar >= origValue - 0.01) {
            return NextResponse.json({
              success: true,
              message: `Esta cobrança já foi integralmente estornada no Asaas (Total: R$ ${totalRefundedSoFar.toFixed(2)}).`,
              status: 'REFUNDED'
            });
          }

          // O valor de estorno é SEMPRE o valor total cobrado no Asaas (produtos + frete) ou o saldo restante
          let refundValue = origValue > 0 ? (totalRefundedSoFar > 0 ? remainingToRefund : origValue) : 0; // 0 = estorno total pelo Asaas

          if (origValue > 0 && (totalRefundedSoFar + refundValue > origValue + 0.05)) {
            refundValue = remainingToRefund;
          }

          console.log(`[Asaas Refund] Executando estorno Pix para ${asaasPaymentId} (R$ ${refundValue})...`);

          const refundBodyPayload: any = { description: cancelReasonText };
          // Modelo novo: estorno integral sem "value" para o Asaas desfazer o split (a comissão volta junto)
          const integralSellerRefund = isSellerSplit && totalRefundedSoFar <= 0;
          if (refundValue > 0 && !integralSellerRefund) {
            refundBodyPayload.value = Number(refundValue.toFixed(2));
          }

          let refundOk = false;
          let refundData: any = {};
          let sellerErrMsg: string | null = null;
          if (integralSellerRefund && sellerIssuerId) {
            // R23: devolve a comissão a partir da conta raiz (splitRefunds) e cobre a tarifa Pix,
            // senão o Asaas responde "Saldo insuficiente" na subconta da loja
            const r = await refundSellerSplitPayment({
              order: targetOrder,
              paymentId: asaasPaymentId,
              sellerCtx: { apiKey: REQ_KEY, baseUrl: ASAAS_URL },
              issuerPartnerId: sellerIssuerId,
              description: cancelReasonText
            });
            refundOk = r.ok;
            refundData = r.data || {};
            sellerErrMsg = r.ok ? null : (r.error || null);
            if (r.ok) refundValue = r.refundedValue;
            console.log(`[Asaas Refund] SELLER_SPLIT pedido ${targetOrder?.id}: ok=${r.ok} comissão devolvida=${r.splitRefunded} tarifa coberta=${r.feeCovered}${r.error ? ' erro=' + r.error : ''}`);
          } else {
            const refundRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/refund`, {
              method: 'POST',
              headers: {
                'access_token': REQ_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(refundBodyPayload)
            });
            refundData = await refundRes.json().catch(() => ({}));
            refundOk = refundRes.ok && !refundData.errors;
          }

          if (refundOk) {
            // A resposta do POST /refund é a cobrança (id pay_..., status da cobrança), não o estorno.
            // O código Pix e o comprovante do estorno são gravados por syncOrderRefund logo abaixo.
            refundId = null;
            refundStatus = 'REFUND_REQUESTED';
            refundMessage = `Estorno de R$ ${refundValue.toFixed(2)} solicitado ao Asaas via Pix.`;

            // Registrar no histórico de estornos
            try {
              await supabase.from('refund_history').insert({
                order_id: targetOrder?.id || (isUUID ? cleanOrderId : null),
                payment_id: asaasPaymentId,
                requested_value: refundValue,
                asaas_refund_id: null,
                status: 'REFUND_REQUESTED',
                requested_by: actorId
              });
            } catch (hisErr) {
              console.warn("Aviso ao inserir refund_history:", hisErr);
            }
          } else {
            const msg = sellerErrMsg || (Array.isArray(refundData.errors)
              ? refundData.errors.map((e: any) => e.description || e.message).join(', ')
              : (refundData.message || JSON.stringify(refundData)));
            console.error("[Asaas Refund Error]:", msg);
            refundMessage = `Asaas Estorno: ${msg}`;
            refundStatus = 'REFUND_FAILED';

            // Registra a tentativa sem cancelar o pedido (continua pago; pode tentar de novo)
            if (targetOrder?.id) {
              try {
                await supabase.from('orders').update({ asaas_refund_status: 'REFUND_FAILED' }).eq('id', targetOrder.id);
              } catch (_e) {}
            }

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
              headers: { 'access_token': REQ_KEY }
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

    // 7. Atualizar status do pedido no Supabase
    const effectiveOrderId = targetOrder?.id || (isUUID ? cleanOrderId : null);
    if (effectiveOrderId) {
      try {
        const finalDbStatus = (refundStatus === 'REFUNDED' || refundStatus === 'REFUND_REQUESTED' || refundStatus === 'REFUND_IN_PROGRESS') ? 'REFUNDED' : 'CANCELLED';

        await supabase.from('orders').update({
          status: finalDbStatus,
          cancellation_reason: cancelReasonText,
          asaas_refund_id: refundId,
          asaas_refund_status: refundStatus,
          asaas_charge_status: finalDbStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: actorId
        }).eq('id', effectiveOrderId);

        // Reverter splits associados
        if (finalDbStatus === 'REFUNDED') {
          await supabase.from('splits').update({ status: 'REVERSED' }).eq('order_id', effectiveOrderId);
        }

        // Registrar auditoria
        await supabase.from('order_status_history').insert({
          order_id: effectiveOrderId,
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

    // 8. Registrar valor, data, código Pix e comprovante do estorno (R28)
    if (targetOrder?.id && asaasPaymentId && (refundStatus === 'REFUND_REQUESTED' || refundStatus === 'REFUNDED')) {
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const sync = await syncOrderRefund(targetOrder, { ctx: { apiKey: REQ_KEY, baseUrl: ASAAS_URL }, paymentId: asaasPaymentId });
        if (sync.state === 'DONE') {
          refundMessage = `Estorno de R$ ${sync.refundedValue.toFixed(2)} concluído pelo Asaas via Pix. O comprovante está no pedido.`;
        } else if (sync.state === 'IN_PROGRESS') {
          refundMessage = `Estorno de R$ ${sync.refundedValue.toFixed(2)} em processamento no Asaas. O comprovante aparece no pedido assim que for concluído.`;
        }
      } catch (syncErr) {
        console.warn('[Asaas Refund] Aviso ao registrar comprovante do estorno:', syncErr);
      }
    }

    if (isAdmin && auth.source !== 'cron_secret' && auth.source !== 'internal_secret') {
      await logAdminAction({
        actorId: callerId || null,
        action: 'REFUND_BY_ADMIN',
        targetType: effectiveOrderId ? 'ORDER' : 'PAYMENT',
        targetId: String(effectiveOrderId || asaasPaymentId || ''),
        beforeState: { status: targetOrder?.status || null, charged_amount: targetOrder?.charged_amount ?? null },
        afterState: { refund_status: refundStatus, refund_id: refundId || null, reason: cancelReasonText },
        request
      });
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
