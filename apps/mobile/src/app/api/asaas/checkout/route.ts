import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  // All roles can initiate checkout (authenticated users only)
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { orderId, customerEmail, customerName, customerCpfCnpj } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar o pedido no banco usando Service Role (bypass RLS)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Validação de segurança: garantir que o comprador é quem está fechando o pedido (ou admin/segredo interno)
    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId && order.buyer_id && order.buyer_id !== callerId) {
      return NextResponse.json({ error: 'Você só pode realizar o checkout dos seus próprios pedidos' }, { status: 403 });
    }

    // Verificar se o pedido já está pago
    if (order.paid_at || order.asaas_charge_status === 'RECEIVED' || order.asaas_charge_status === 'CONFIRMED') {
      return NextResponse.json({ error: 'Este pedido já foi pago' }, { status: 409 });
    }

    // 2. Recalcular o valor total e o split no SERVIDOR usando o módulo único de precificação (com cidade real)
    const { calculateOrderPricing } = await import('@/lib/pricingEngine');
    let cityName = (order as any).cidade_origem || (order as any).cidade || (order as any).delivery_city || (order as any).city || null;
    if (!cityName && order.buyer_id) {
      const { data: uBuyer } = await supabase.from('users').select('cidade').eq('id', order.buyer_id).maybeSingle();
      if (uBuyer?.cidade) cityName = uBuyer.cidade;
    }
    if (!cityName && order.seller_storefront_id) {
      const { data: sf } = await supabase.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).maybeSingle();
      if (sf?.partner_id) {
        const { data: uPartner } = await supabase.from('users').select('cidade').eq('id', sf.partner_id).maybeSingle();
        if (uPartner?.cidade) cityName = uPartner.cidade;
      }
    }

    const pricing = await calculateOrderPricing({
      orderType: order.order_type,
      distanceKm: order.delivery_distance_km,
      cityName,
      productsSubtotal: order.products_subtotal,
      sellerStorefrontId: order.seller_storefront_id
    }, supabase);

    const calculatedValue = pricing.buyerTotal;

    if (calculatedValue <= 0) {
      return NextResponse.json({ error: 'Valor total do pedido inválido para cobrança' }, { status: 400 });
    }

    // Recalcular Split buscando as carteiras reais Asaas diretamente do banco
    const isValidAsaasWalletId = (id?: string) => {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim();
      if (clean.length < 10) return false;
      if (clean.includes('@') || clean === 'loja_parceira' || clean === 'asaas_wallet_' || clean === 'wallet_master') return false;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      const isAsaasAcc = /^acc_[a-zA-Z0-9_-]{8,}$/i.test(clean);
      const isAsaasId = clean.length >= 12 && !clean.match(/^\d+$/) && !clean.endsWith('_');
      return isUuid || isAsaasAcc || isAsaasId;
    };

    const calculatedSplits: { walletId: string; fixedValue: number }[] = [];

    // Split Vendedor (Loja / Batedeira / Fornecedor)
    const sellerSfOrUserId = order.seller_storefront_id || (order as any).loja_id || (order as any).fornecedor_id || (order as any).origem_id || null;
    if (sellerSfOrUserId) {
      let partnerUserId: string | null = null;
      const { data: sf } = await supabase
        .from('storefronts')
        .select('partner_id')
        .eq('id', sellerSfOrUserId)
        .maybeSingle();

      if (sf?.partner_id) {
        partnerUserId = sf.partner_id;
      } else {
        partnerUserId = sellerSfOrUserId;
      }

      if (partnerUserId) {
        const { data: uSeller } = await supabase
          .from('users')
          .select('asaas_wallet_id, split_enabled, asaas_account_status')
          .eq('id', partnerUserId)
          .maybeSingle();

        const isSellerSplitActive = uSeller?.split_enabled === true || 
                                    (uSeller?.split_enabled !== false && uSeller?.asaas_account_status === 'APPROVED') ||
                                    Boolean(uSeller?.asaas_wallet_id && uSeller?.asaas_account_status !== 'REJECTED');

        if (uSeller?.asaas_wallet_id && isSellerSplitActive && isValidAsaasWalletId(uSeller.asaas_wallet_id)) {
          const sellerVal = pricing.netSellerPayout;

          if (sellerVal > 0) {
            calculatedSplits.push({
              walletId: uSeller.asaas_wallet_id.trim(),
              fixedValue: sellerVal
            });
          }
        }
      }
    }

    // Split Motorista / Entregador (Motoboy / Caminhão)
    const driverUserId = order.driver_id || (order as any).motorista_id || (order as any).motoristaId || null;
    if (driverUserId) {
      const { data: uDriver } = await supabase
        .from('users')
        .select('asaas_wallet_id, split_enabled, asaas_account_status')
        .eq('id', driverUserId)
        .maybeSingle();

      const isDriverSplitActive = uDriver?.split_enabled === true || 
                                   (uDriver?.split_enabled !== false && uDriver?.asaas_account_status === 'APPROVED') ||
                                   Boolean(uDriver?.asaas_wallet_id && uDriver?.asaas_account_status !== 'REJECTED');

      if (uDriver?.asaas_wallet_id && isDriverSplitActive && isValidAsaasWalletId(uDriver.asaas_wallet_id)) {
        const driverVal = pricing.netDriverPayout;

        if (driverVal > 0) {
          calculatedSplits.push({
            walletId: uDriver.asaas_wallet_id.trim(),
            fixedValue: driverVal
          });
        }
      }
    }

    const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor (env) nem no Supabase Secrets' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    // Idempotência: verificar se este orderId já possui cobrança gerada no Asaas
    try {
      const existingPayRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(orderId)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      if (existingPayRes.ok) {
        const existingPayData = await existingPayRes.json();
        if (existingPayData && existingPayData.data && existingPayData.data.length > 0) {
          const existingPayment = existingPayData.data[0];
          if (existingPayment.status !== 'CANCELLED' && existingPayment.status !== 'REFUNDED') {
            let existingPix: any = {};
            try {
              const pixRes = await fetch(`${ASAAS_URL}/payments/${existingPayment.id}/pixQrCode`, {
                headers: { 'access_token': ASAAS_API_KEY }
              });
              existingPix = await pixRes.json();
            } catch (_e) {}

            return NextResponse.json({
              paymentId: existingPayment.id,
              invoiceUrl: existingPayment.invoiceUrl || existingPayment.bankSlipUrl,
              pixQrCode: existingPix.encodedImage || null,
              pixCopiaECola: existingPix.payload || null,
              status: existingPayment.status,
              isSandbox: false,
              isExisting: true
            });
          }
        }
      }
    } catch (checkErr) {
      console.warn("Aviso ao checar idempotência de cobrança no Asaas:", checkErr);
    }

    // Criar ou Buscar Cliente no Asaas
    let customerId = '';
    const emailToSearch = customerEmail || 'appsolutions76@gmail.com';
    
    const cleanDigits = (val?: string) => {
      if (!val) return undefined;
      const digits = String(val).replace(/\D/g, '');
      return (digits.length === 11 || digits.length === 14) ? digits : undefined;
    };
    const validCpfCnpj = cleanDigits(customerCpfCnpj);

    if (validCpfCnpj) {
      const cpfSearchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${encodeURIComponent(validCpfCnpj)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      const cpfSearchData = await cpfSearchRes.json();
      if (cpfSearchData && cpfSearchData.data && cpfSearchData.data.length > 0) {
        customerId = cpfSearchData.data[0].id;
      }
    }

    if (!customerId) {
      const emailSearchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(emailToSearch)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      const emailSearchData = await emailSearchRes.json();
      if (emailSearchData && emailSearchData.data && emailSearchData.data.length > 0) {
        customerId = emailSearchData.data[0].id;
      }
    }

    if (!customerId) {
      const customerPayload: any = {
        name: customerName || 'Cliente AçaíFood',
        email: emailToSearch
      };
      if (validCpfCnpj) customerPayload.cpfCnpj = validCpfCnpj;

      let createRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });
      let createData = await createRes.json();

      if (!createData.id && customerPayload.cpfCnpj) {
        delete customerPayload.cpfCnpj;
        createRes = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerPayload)
        });
        createData = await createRes.json();
      }

      if (createData.id) {
        customerId = createData.id;
      } else {
        const msg = createData.errors
          ? createData.errors.map((e: any) => e.description).join(', ')
          : (createData.message || JSON.stringify(createData));
        return NextResponse.json({ error: `Asaas Cliente: ${msg}` }, { status: 400 });
      }
    }

    const dueDateObj = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    // Ajustar split formatado para respeitar limites do Asaas
    let totalSplitValue = 0;
    let formattedSplit = calculatedSplits.map((s) => {
      const roundedVal = Number(s.fixedValue.toFixed(2));
      totalSplitValue += roundedVal;
      return {
        walletId: s.walletId,
        fixedValue: roundedVal
      };
    });

    const maxAllowedSplit = Number((calculatedValue - 0.05).toFixed(2));
    if (formattedSplit.length > 0 && maxAllowedSplit > 0 && totalSplitValue >= calculatedValue) {
      const ratio = maxAllowedSplit / totalSplitValue;
      formattedSplit = formattedSplit.map((s) => ({
        ...s,
        fixedValue: Number((s.fixedValue * ratio).toFixed(2))
      }));
    }

    const validSplit = formattedSplit.length > 0 ? formattedSplit : undefined;

    // Criar Cobrança (BillingType PIX)
    const paymentBody: any = {
      customer: customerId,
      billingType: 'PIX',
      value: calculatedValue,
      dueDate: dueDate,
      externalReference: orderId,
      description: `Pedido AçaíFood #${String(orderId).substring(0, 8)}`
    };

    if (validSplit && validSplit.length > 0) {
      paymentBody.split = validSplit;
    }

    const payRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    });

    const paymentData = await payRes.json();
    if (!paymentData.id) {
      const msg = paymentData.errors
        ? paymentData.errors.map((e: any) => e.description).join(', ')
        : (paymentData.message || JSON.stringify(paymentData));
      return NextResponse.json({ error: `Asaas Cobrança: ${msg}` }, { status: 400 });
    }

    // Atualizar order no Supabase com o paymentId
    await supabase
      .from('orders')
      .update({
        asaas_payment_id: paymentData.id,
        asaas_charge_status: paymentData.status
      })
      .eq('id', orderId);

    // Buscar QR Code Pix
    let pixData: any = {};
    try {
      const pixRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      });
      pixData = await pixRes.json();
    } catch (e) {
      console.warn("Erro ao buscar QR Code Pix do Asaas:", e);
    }

    return NextResponse.json({
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl,
      pixQrCode: pixData.encodedImage || null,
      pixCopiaECola: pixData.payload || null,
      status: paymentData.status,
      isSandbox: false
    });

  } catch (error: any) {
    console.error("Erro na API de Checkout do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar Asaas' },
      { status: 500 }
    );
  }
}

