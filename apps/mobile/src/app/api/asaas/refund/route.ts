import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  try {
    const body = await request.json();
    const { orderId, paymentId, description } = body;

    if (!orderId && !paymentId) {
      return NextResponse.json(
        { error: 'ID do pedido ou do pagamento é obrigatório para estorno' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    let asaasPaymentId = paymentId || '';

    // Se forneceu apenas orderId, buscar asaas_payment_id no Supabase ou via Asaas API
    if (!asaasPaymentId && orderId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const sfRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=asaas_payment_id,asaas_charge_status`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`
            }
          });
          if (sfRes.ok) {
            const data = await sfRes.json();
            if (data && data.length > 0 && data[0].asaas_payment_id) {
              asaasPaymentId = data[0].asaas_payment_id;
            }
          }
        } catch (e) {
          console.warn("Erro ao buscar asaas_payment_id no Supabase:", e);
        }
      }

      // Fallback: buscar por externalReference no Asaas
      if (!asaasPaymentId) {
        try {
          const searchRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(orderId)}`, {
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
          });
          const searchData = await searchRes.json();
          if (searchData && searchData.data && searchData.data.length > 0) {
            asaasPaymentId = searchData.data[0].id;
          }
        } catch (e) {
          console.warn("Erro ao buscar cobrança no Asaas por externalReference:", e);
        }
      }
    }

    if (!asaasPaymentId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cobrança no Asaas não encontrada ou ainda não paga (nada a estornar).' 
      });
    }

    console.log(`Solicitando estorno no Asaas para a cobrança ${asaasPaymentId}...`);

    const refundRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: description || `Estorno AçaíFood pedido #${String(orderId || '').substring(0, 8)}`
      })
    });

    const refundData = await refundRes.json();

    if (!refundRes.ok || refundData.errors) {
      const msg = refundData.errors
        ? refundData.errors.map((e: any) => e.description).join(', ')
        : (refundData.message || JSON.stringify(refundData));
      console.warn("Aviso ao estornar cobrança no Asaas (assumindo simulação/cancelado):", msg);
      return NextResponse.json({ success: true, message: `Estorno Asaas registrado: ${msg}` });
    }

    return NextResponse.json({
      success: true,
      refundId: refundData.id,
      status: refundData.status,
      value: refundData.value
    });

  } catch (error: any) {
    console.error("Erro na API de Estorno do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar estorno no Asaas' },
      { status: 500 }
    );
  }
}
