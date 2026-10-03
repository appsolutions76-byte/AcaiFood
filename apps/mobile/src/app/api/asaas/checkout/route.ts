import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Lê o PIN de entrega atual em order_pins (o PIN não fica mais na tabela orders)
async function readDeliveryPin(supabase: any, orderId: string): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('order_pins')
      .select('delivery_pin')
      .eq('order_id', orderId)
      .maybeSingle();
    return data?.delivery_pin || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  // 1. Identificação e autorização obrigatórias do chamador
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error || 'Acesso negado: faça login para continuar');
  }

  try {
    const body = await request.json();
    const { 
      orderId, 
      orderType = 'B2C',
      targetId,
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
      const resExisting = await supabase
        .from('orders')
        .select('id, status, buyer_id, seller_storefront_id, order_type, products_subtotal, delivery_distance_km, asaas_payment_id, delivery_address, delivery_lat, delivery_lng, delivery_reference, delivery_bairro, seller_payout_amount, driver_payout_amount, platform_fee_amount, delivery_fee_amount, asaas_fee_amount, pricing_snapshot')
        .eq('id', orderId)
        .maybeSingle();

      if (resExisting.data) {
        order = resExisting.data;
      } else if (resExisting.error) {
        const resLegacy = await supabase
          .from('orders')
          .select('id, status, buyer_id, seller_storefront_id, order_type, products_subtotal, delivery_distance_km, asaas_payment_id, delivery_address, delivery_lat, delivery_lng, delivery_reference, delivery_bairro')
          .eq('id', orderId)
          .maybeSingle();
        if (resLegacy.data) {
          order = resLegacy.data;
        }
      }
    }

    // 2. Determinar o comprador estritamente a partir do JWT autenticado
    const validBuyerId = (auth.source === 'internal_secret' || auth.source === 'cron_secret')
      ? (body.buyerId || auth.user?.id)
      : auth.user?.id;

    if (!validBuyerId) {
      return NextResponse.json({ error: 'Usuário comprador não identificado na sessão' }, { status: 401 });
    }

    // Garantir que o perfil do comprador autenticado existe na tabela users para integridade de FK
    const { data: existingBuyer } = await supabase.from('users').select('id, cpf_cnpj').eq('id', validBuyerId).maybeSingle();
    if (!existingBuyer) {
      try {
        await supabase.from('users').insert({
          id: validBuyerId,
          name: customerName || auth.user?.user_metadata?.name || 'Cliente AçaíFood',
          email: customerEmail || auth.user?.email || `cliente_${validBuyerId}@acaifood.app.br`,
          phone: customerPhone || null,
          cpf_cnpj: customerCpfCnpj || null,
          role: 'cliente'
        });
      } catch (_buyerErr) {
        console.warn("Aviso ao sincronizar perfil do comprador em users:", _buyerErr);
      }
    } else if (customerCpfCnpj && !existingBuyer.cpf_cnpj) {
      // Só completa o CPF/CNPJ se o cadastro ainda não tiver um. Nunca sobrescreve
      // (parceiros com subconta Asaas têm CPF/CNPJ travado — contrato BaaS 8.2.3)
      try {
        await supabase.from('users').update({ cpf_cnpj: customerCpfCnpj }).eq('id', validBuyerId);
      } catch (_updErr) {}
    }

    // Se o pedido não existe no banco, criar com Service Role no servidor
    if (!order) {
      // Resolver seller_storefront_id
      let sellerStorefrontId: string | null = null;
      const storeTargetId = orderType === 'COLETA' ? null : targetId;

      if (storeTargetId) {
        // 1. Verificar se é ID de storefront
        const { data: sfById } = await supabase.from('storefronts').select('id, partner_id').eq('id', storeTargetId).maybeSingle();
        if (sfById) {
          sellerStorefrontId = sfById.id;
        } else {
          // 2. Verificar se é partner_id
          const { data: sfByPartner } = await supabase.from('storefronts').select('id, partner_id').eq('partner_id', storeTargetId).maybeSingle();
          if (sfByPartner) {
            sellerStorefrontId = sfByPartner.id;
          } else {
            // 3. Se o parceiro existe em users mas ainda não tem storefront, auto-criar
            try {
              const { data: partnerUser } = await supabase.from('users').select('id, name').eq('id', storeTargetId).maybeSingle();
              if (partnerUser) {
                const { data: newSf } = await supabase.from('storefronts').insert({
                  partner_id: partnerUser.id,
                  store_name: partnerUser.name || 'Loja AçaíFood'
                }).select('id').maybeSingle();
                if (newSf) sellerStorefrontId = newSf.id;
              }
            } catch (_sfAutoErr) {
              console.warn("Aviso ao auto-criar storefront para parceiro:", _sfAutoErr);
            }
          }
        }
      }

      if (orderType !== 'COLETA' && !sellerStorefrontId) {
        return NextResponse.json({ error: 'Loja ou fornecedor do pedido não encontrado' }, { status: 400 });
      }

      const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
      const pickupPin = orderType !== 'COLETA' ? Math.floor(1000 + Math.random() * 9000).toString() : null;

      // Calcular precificação e regras de frete (Fixo vs KM) antes de persistir no banco
      const { calculateOrderPricing } = await import('@/lib/pricingEngine');
      let orderCity: string | null = null;
      if (validBuyerId) {
        const { data: uBuyer } = await supabase.from('users').select('cidade').eq('id', validBuyerId).maybeSingle();
        if (uBuyer?.cidade) orderCity = uBuyer.cidade;
      }
      if (!orderCity && sellerStorefrontId) {
        const { data: sf } = await supabase.from('storefronts').select('partner_id').eq('id', sellerStorefrontId).maybeSingle();
        if (sf?.partner_id) {
          const { data: uPartner } = await supabase.from('users').select('cidade').eq('id', sf.partner_id).maybeSingle();
          if (uPartner?.cidade) orderCity = uPartner.cidade;
        }
      }

      const prePricing = await calculateOrderPricing({
        orderType,
        distanceKm: Number(deliveryDistanceKm || 0),
        cityName: orderCity,
        productsSubtotal: Number(productsSubtotal || 0),
        sellerStorefrontId
      }, supabase);

      const isFixedFreight = prePricing.courierPaymentMode === 'FIXED';
      const effectiveDbDistance = isFixedFreight ? 1.0 : Number(deliveryDistanceKm || 0);
      const distInfoText = `Distância estimada: ${deliveryDistanceKm || 0} km${isFixedFreight ? ' (Valor Fixo da Moto aplicado)' : ''}`;
      const effectiveReference = deliveryInfo?.reference
        ? `${deliveryInfo.reference} | ${distInfoText}`
        : distInfoText;

      let newOrder: any = null;
      let createOrderErr: any = null;

      const basePayload: any = {
        buyer_id: validBuyerId,
        seller_storefront_id: sellerStorefrontId,
        order_type: orderType,
        status: 'PENDING',
        products_subtotal: Number(productsSubtotal || 0),
        delivery_distance_km: effectiveDbDistance,
        delivery_pin: deliveryPin,
        delivery_address: deliveryInfo?.address || null,
        delivery_lat: deliveryInfo?.lat ? Number(deliveryInfo.lat) : null,
        delivery_lng: deliveryInfo?.lng ? Number(deliveryInfo.lng) : null,
        delivery_reference: effectiveReference,
        delivery_bairro: deliveryInfo?.bairro || auth.user?.bairro || null,
        seller_payout_amount: prePricing.netSellerPayout,
        driver_payout_amount: prePricing.netDriverPayout,
        platform_fee_amount: (prePricing.platformSalesFee || 0) + (prePricing.platformDeliveryFee || 0),
        delivery_fee_amount: prePricing.deliveryTotal || prePricing.clientDeliveryFee || 0,
        asaas_fee_amount: prePricing.asaasPixFeeFixed || 0,
        pricing_snapshot: prePricing
      };

      const fullPayload = { ...basePayload, pickup_pin: pickupPin };
      const ORDER_RETURN_COLS = 'id, buyer_id, seller_storefront_id, status, order_type, products_subtotal, delivery_distance_km, delivery_address, delivery_lat, delivery_lng, delivery_reference, delivery_bairro, seller_payout_amount, driver_payout_amount, platform_fee_amount, delivery_fee_amount, asaas_fee_amount, pricing_snapshot, created_at';
      const ORDER_RETURN_COLS_LEGACY = 'id, buyer_id, seller_storefront_id, status, order_type, products_subtotal, delivery_distance_km, delivery_address, delivery_lat, delivery_lng, delivery_reference, delivery_bairro, created_at';

      // 1. Tentar inserção completa com snapshot e pickup_pin
      const resFull = await supabase.from('orders').insert(fullPayload).select(ORDER_RETURN_COLS).single();
      if (resFull.data && !resFull.error) {
        newOrder = resFull.data;
      } else {
        // 2. Fallback: tentar sem pickup_pin mas com snapshot
        const resBase = await supabase.from('orders').insert(basePayload).select(ORDER_RETURN_COLS).single();
        if (resBase.data && !resBase.error) {
          newOrder = resBase.data;
        } else {
          // 3. Fallback resiliente: se o banco ainda não tiver as colunas de snapshot (ex: asaas_fee_amount)
          const legacyPayload: any = {
            buyer_id: validBuyerId,
            seller_storefront_id: sellerStorefrontId,
            order_type: orderType,
            status: 'PENDING',
            products_subtotal: Number(productsSubtotal || 0),
            delivery_distance_km: effectiveDbDistance,
            delivery_pin: deliveryPin,
            delivery_address: deliveryInfo?.address || null,
            delivery_lat: deliveryInfo?.lat ? Number(deliveryInfo.lat) : null,
            delivery_lng: deliveryInfo?.lng ? Number(deliveryInfo.lng) : null,
            delivery_reference: effectiveReference,
            delivery_bairro: deliveryInfo?.bairro || auth.user?.bairro || null
          };
          const resLegacy = await supabase.from('orders').insert(legacyPayload).select(ORDER_RETURN_COLS_LEGACY).single();
          if (resLegacy.data && !resLegacy.error) {
            newOrder = resLegacy.data;
          } else {
            createOrderErr = resLegacy.error || resBase.error || resFull.error;
          }
        }
      }

      if (createOrderErr || !newOrder) {
        console.error("Erro fatal ao criar pedido no banco:", createOrderErr);
        return NextResponse.json({ 
          error: `Erro ao registrar pedido no banco: ${createOrderErr?.message || createOrderErr?.details || 'Falha de gravação'}` 
        }, { status: 500 });
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

    // Fase 3.1: Cobrança gerada 100% para a conta da plataforma (repasses liquidados após confirmação do PIN)

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
            const qrRes = await fetch(`${ASAAS_URL}/payments/${existingPayment.id}/pixQrCode`, {
              headers: { 'access_token': ASAAS_API_KEY }
            });
            const qrData = qrRes.ok ? await qrRes.json() : null;
            if (!qrData || !qrData.encodedImage || !qrData.payload) {
              const msg = qrData?.errors?.[0]?.description || qrData?.message || 'Falha ao obter QR Code do Asaas';
              return NextResponse.json({ error: `Não foi possível gerar o Pix: ${msg}` }, { status: 502 });
            }

            return NextResponse.json({
              success: true,
              orderId: order.id,
              paymentId: existingPayment.id,
              invoiceUrl: existingPayment.invoiceUrl || existingPayment.bankSlipUrl,
              pixQrCode: qrData.encodedImage,
              pixCopiaECola: qrData.payload,
              status: existingPayment.status,
              totalValue: existingPayment.value || calculatedValue,
              deliveryPin: await readDeliveryPin(supabase, order.id),
              isSandbox: ASAAS_URL.includes('sandbox'),
              isExisting: true
            });
          }
        }
      }
    } catch (checkErr) {
      console.warn("Aviso ao checar idempotência de cobrança no Asaas:", checkErr);
    }

    // Criar ou Buscar Cliente no Asaas
    const { validateCpfCnpjDigits } = await import('@/lib/pix');
    const cleanDigits = (val?: string) => {
      if (!val) return undefined;
      const digits = String(val).replace(/\D/g, '');
      return (digits.length === 11 || digits.length === 14) ? digits : undefined;
    };
    const validCpfCnpj = cleanDigits(customerCpfCnpj);

    if (!validCpfCnpj || !validateCpfCnpjDigits(validCpfCnpj)) {
      return NextResponse.json(
        { error: 'CPF ou CNPJ válido do cliente é obrigatório para emissão do Pix no Banco Central.' },
        { status: 400 }
      );
    }

    let customerId = '';
    const emailToSearch = customerEmail || (order?.buyer_id ? `cliente_${order.buyer_id}@acaifood.app.br` : undefined);

    const cpfSearchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${encodeURIComponent(validCpfCnpj)}`, {
      headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
    });
    if (cpfSearchRes.ok) {
      const cpfSearchData = await cpfSearchRes.json();
      if (cpfSearchData && cpfSearchData.data && cpfSearchData.data.length > 0) {
        customerId = cpfSearchData.data[0].id;
      }
    }

    if (!customerId && emailToSearch) {
      const emailSearchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(emailToSearch)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      if (emailSearchRes.ok) {
        const emailSearchData = await emailSearchRes.json();
        if (emailSearchData && emailSearchData.data && emailSearchData.data.length > 0) {
          const existingCust = emailSearchData.data[0];
          customerId = existingCust.id;
          if (!existingCust.cpfCnpj || existingCust.cpfCnpj !== validCpfCnpj) {
            try {
              await fetch(`${ASAAS_URL}/customers/${customerId}`, {
                method: 'POST',
                headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpfCnpj: validCpfCnpj })
              });
            } catch (_e) {}
          }
        }
      }
    }

    if (!customerId) {
      const customerPayload: any = {
        name: customerName || 'Cliente AçaíFood',
        email: emailToSearch || `cliente_${Date.now()}@acaifood.app.br`,
        cpfCnpj: validCpfCnpj,
        mobilePhone: customerPhone ? String(customerPhone).replace(/\D/g, '') : undefined
      };

      const createRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });
      const createData = await createRes.json();

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

    // Criar Cobrança (BillingType PIX) para a plataforma
    const paymentBody: any = {
      customer: customerId,
      billingType: 'PIX',
      value: calculatedValue,
      dueDate: dueDate,
      externalReference: order.id,
      description: `Pedido AçaíFood #${String(order.id).substring(0, 8)}`
    };

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

    // Obter QR Code dinâmico oficial do Asaas para a cobrança criada
    const qrRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
      headers: { 'access_token': ASAAS_API_KEY }
    });
    const qrData = qrRes.ok ? await qrRes.json() : null;

    if (!qrData || !qrData.encodedImage || !qrData.payload) {
      const msg = qrData?.errors?.[0]?.description || qrData?.message || 'Falha ao obter QR Code do Asaas';
      console.error("Erro Asaas ao obter pixQrCode:", qrData);
      return NextResponse.json(
        { error: `Não foi possível gerar o Pix oficial da cobrança: ${msg}` },
        { status: 502 }
      );
    }

    // Atualizar order no Supabase com o paymentId, status, charged_amount e snapshot de precificação
    const updPayload: any = {
      asaas_payment_id: paymentData.id,
      asaas_charge_status: paymentData.status,
      charged_amount: calculatedValue,
      seller_payout_amount: pricing.netSellerPayout,
      driver_payout_amount: pricing.netDriverPayout,
      platform_fee_amount: (pricing.platformSalesFee || 0) + (pricing.platformDeliveryFee || 0),
      delivery_fee_amount: pricing.deliveryTotal || pricing.clientDeliveryFee || 0,
      asaas_fee_amount: pricing.asaasPixFeeFixed || 0,
      pricing_snapshot: pricing
    };
    const updRes = await supabase.from('orders').update(updPayload).eq('id', order.id);
    if (updRes.error) {
      // Fallback seguro: se falhar por colunas inexistentes, atualizar apenas os dados de pagamento do Asaas
      console.warn("Aviso ao salvar snapshot no update, tentando payload básico de pagamento:", updRes.error.message);
      const safeUpd: any = {
        asaas_payment_id: paymentData.id,
        asaas_charge_status: paymentData.status
      };
      await supabase.from('orders').update(safeUpd).eq('id', order.id);
    }

    // PIN de entrega lido de order_pins (fonte única). O PIN de retirada é da loja e não vai ao comprador.
    const finalDeliveryPin = await readDeliveryPin(supabase, order.id);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl,
      pixQrCode: qrData.encodedImage,
      pixCopiaECola: qrData.payload,
      status: paymentData.status,
      totalValue: calculatedValue,
      deliveryPin: finalDeliveryPin,
      isSandbox: ASAAS_URL.includes('sandbox')
    });

  } catch (error: any) {
    console.error("Erro na API de Checkout do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar Asaas' },
      { status: 500 }
    );
  }
}
