import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Identificação do chamador (se logado)
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);

  try {
    const body = await request.json();
    const { 
      orderId, 
      orderType = 'B2C',
      targetId,
      buyerId,
      customerEmail, 
      customerName, 
      customerPhone,
      customerCpfCnpj,
      productsSubtotal,
      deliveryDistanceKm,
      deliveryInfo,
      items = [],
      taxas
    } = body;

    const supabase = getSupabaseAdmin();
    let order: any = null;

    // 1. Se orderId foi passado e é válido, tentar buscar pedido existente
    if (orderId && typeof orderId === 'string' && orderId.length >= 10 && !orderId.startsWith('PED-')) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (existingOrder) {
        order = existingOrder;
      }
    }

    // 2. Se o pedido não existe no banco, criar com Service Role no servidor (100% à prova de falhas de RLS)
    if (!order) {
      const callerId = auth.user?.id || auth.profile?.id || buyerId;
      
      // Garantir que o comprador existe na tabela users
      let validBuyerId: string | null = null;
      if (callerId) {
        const { data: uBuyer } = await supabase.from('users').select('id, name, email, phone').eq('id', callerId).maybeSingle();
        if (uBuyer) {
          validBuyerId = uBuyer.id;
        } else {
          // Inserir registro do cliente no banco
          const { data: newBuyer } = await supabase.from('users').insert({
            id: callerId,
            name: customerName || 'Cliente AçaíFood',
            email: customerEmail || 'appsolutions76@gmail.com',
            phone: customerPhone || null,
            role: 'cliente',
            cpf_cnpj: customerCpfCnpj || null
          }).select('id').maybeSingle();

          if (newBuyer) validBuyerId = newBuyer.id;
        }
      }

      // Resolver seller_storefront_id
      let sellerStorefrontId: string | null = null;
      const storeTargetId = orderType === 'COLETA' ? validBuyerId : (targetId || validBuyerId);

      if (storeTargetId) {
        // Verificar se é ID de storefront
        const { data: sfById } = await supabase.from('storefronts').select('id, partner_id').eq('id', storeTargetId).maybeSingle();
        if (sfById) {
          sellerStorefrontId = sfById.id;
        } else {
          // Verificar se é partner_id
          const { data: sfByPartner } = await supabase.from('storefronts').select('id, partner_id').eq('partner_id', storeTargetId).maybeSingle();
          if (sfByPartner) {
            sellerStorefrontId = sfByPartner.id;
          } else {
            // Auto-criar storefront para a loja/parceiro
            try {
              const { data: targetUser } = await supabase.from('users').select('name').eq('id', storeTargetId).maybeSingle();
              const { data: newSf } = await supabase.from('storefronts').insert({
                partner_id: storeTargetId,
                store_name: targetUser?.name || 'Loja AçaíFood'
              }).select('id').maybeSingle();
              if (newSf) sellerStorefrontId = newSf.id;
            } catch (_sfErr) {
              console.warn("Aviso ao criar storefront:", _sfErr);
            }
          }
        }
      }

      const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
      const pickupPin = orderType !== 'COLETA' ? Math.floor(1000 + Math.random() * 9000).toString() : null;

      const { data: newOrder, error: createOrderErr } = await supabase.from('orders').insert({
        buyer_id: validBuyerId,
        seller_storefront_id: sellerStorefrontId,
        order_type: orderType,
        status: 'PENDING',
        products_subtotal: Number(productsSubtotal || 0),
        delivery_distance_km: Number(deliveryDistanceKm || 0),
        delivery_pin: deliveryPin,
        pickup_pin: pickupPin,
        delivery_address: deliveryInfo?.address || null,
        delivery_lat: deliveryInfo?.lat || null,
        delivery_lng: deliveryInfo?.lng || null,
        delivery_reference: deliveryInfo?.reference || null
      }).select().single();

      if (createOrderErr || !newOrder) {
        console.error("Erro fatal ao criar pedido no banco:", createOrderErr);
        return NextResponse.json({ error: 'Erro ao registrar pedido no banco de dados' }, { status: 500 });
      }

      order = newOrder;

      // Inserir itens do pedido
      if (items && Array.isArray(items) && items.length > 0) {
        const itemsPayload = items.map((it: any) => ({
          order_id: order.id,
          product_id: it.id || null,
          product_name: it.name || 'Açaí',
          quantity: it.quantity || 1,
          unit_price_cents: Math.round((it.price || 0) * 100),
          total_price_cents: Math.round((it.price || 0) * (it.quantity || 1) * 100)
        }));

        try {
          await supabase.from('order_items').insert(itemsPayload);
        } catch (_itErr) {
          console.warn("Aviso ao salvar order_items:", _itErr);
        }
      }
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

    // 3. Recalcular o valor total e o split no SERVIDOR usando o módulo de precificação
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

    const calculatedValue = pricing.buyerTotal > 0 ? pricing.buyerTotal : (Number(productsSubtotal || 0) + 2.00);

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
    const sellerSfOrUserId = order.seller_storefront_id || (order as any).loja_id || (order as any).fornecedor_id || (order as any).origem_id || targetId || null;
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

    const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    // Idempotência: verificar se este order.id já possui cobrança gerada no Asaas
    try {
      const existingPayRes = await fetch(`${ASAAS_URL}/payments?externalReference=${encodeURIComponent(order.id)}`, {
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
              success: true,
              orderId: order.id,
              paymentId: existingPayment.id,
              invoiceUrl: existingPayment.invoiceUrl || existingPayment.bankSlipUrl,
              pixQrCode: existingPix.encodedImage || null,
              pixCopiaECola: existingPix.payload || null,
              status: existingPayment.status,
              totalValue: calculatedValue,
              deliveryPin: order.delivery_pin,
              pickupPin: order.pickup_pin,
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
        // Garantir que o cliente existente tenha CPF/CNPJ no Asaas para liberar o Pix
        const existingCust = emailSearchData.data[0];
        if (!existingCust.cpfCnpj) {
          const cpfToAttach = validCpfCnpj || '42035623000140';
          try {
            await fetch(`${ASAAS_URL}/customers/${customerId}`, {
              method: 'POST',
              headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ cpfCnpj: cpfToAttach })
            });
          } catch (_e) {}
        }
      }
    }

    if (!customerId) {
      const customerPayload: any = {
        name: customerName || 'Cliente AçaíFood',
        email: emailToSearch,
        cpfCnpj: validCpfCnpj || '42035623000140'
      };

      let createRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });
      let createData = await createRes.json();

      if (!createData.id && customerPayload.cpfCnpj !== '42035623000140') {
        customerPayload.cpfCnpj = '42035623000140';
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
      externalReference: order.id,
      description: `Pedido AçaíFood #${String(order.id).substring(0, 8)}`
    };

    if (validSplit && validSplit.length > 0) {
      paymentBody.split = validSplit;
    }

    let payRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    });

    let paymentData = await payRes.json();

    // Se falhar devido ao split da loja/carteira, tenta criar direto para a plataforma sem split
    if (!paymentData.id && paymentBody.split) {
      console.warn("Falha ao criar cobrança Asaas com split, tentando sem split...", paymentData);
      delete paymentBody.split;
      payRes = await fetch(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentBody)
      });
      paymentData = await payRes.json();
    }

    // Se falhar por exigência de CPF no cliente Asaas, atualiza o cadastro do cliente e retenta
    if (!paymentData.id && JSON.stringify(paymentData).toLowerCase().includes('cpf')) {
      console.warn("Exigência de CPF detectada no Asaas, atualizando cadastro e retentando...", paymentData);
      try {
        await fetch(`${ASAAS_URL}/customers/${customerId}`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpfCnpj: '42035623000140' })
        });
        payRes = await fetch(`${ASAAS_URL}/payments`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentBody)
        });
        paymentData = await payRes.json();
      } catch (_cpfRetryErr) {}
    }

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
      .eq('id', order.id);

    // Buscar QR Code Pix oficial no Asaas
    let pixData: any = {};
    try {
      const pixRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      });
      pixData = await pixRes.json();
    } catch (e) {
      console.warn("Erro ao buscar QR Code Pix do Asaas:", e);
    }

    // Se o Asaas não retornou payload, gerar payload compatível BACEN
    const { generateValidPixPayload } = await import('@/lib/pix');
    const finalPixCopiaECola = pixData.payload || generateValidPixPayload({
      pixKey: process.env.NEXT_PUBLIC_PLATFORM_PIX_KEY || '42035623000140',
      merchantName: 'ELETROMECANICA BAIA LTDA',
      merchantCity: 'PORTEL',
      amount: calculatedValue,
      txId: '***'
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl,
      pixQrCode: pixData.encodedImage || null,
      pixCopiaECola: finalPixCopiaECola,
      status: paymentData.status,
      totalValue: calculatedValue,
      deliveryPin: order.delivery_pin,
      pickupPin: order.pickup_pin,
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
