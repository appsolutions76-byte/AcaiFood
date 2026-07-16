import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, cartItems, origin } = await req.json();
    const requestOrigin = origin || 'https://acaifood.app';
    if (!orderId) throw new Error('Order ID is required');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: Missing token');
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verify User Token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    // 2. Fetch Order First
    let { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, seller_storefront_id, buyer_id, driver_id')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) throw new Error('Order not found');
    if (order.buyer_id !== user.id) throw new Error('Forbidden: You can only checkout your own orders');

    // 3. Segurança Crítica 1: Validar carrinho obrigatoriamente (Empty Cart Bypass Fix)
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Forbidden: Cart cannot be empty. Security validation failed.');
    }

    const { data: platformSettings } = await supabaseClient.from('platform_settings').select('*').single();
    if (!platformSettings) throw new Error('System settings missing');

    let verifiedSubtotal = 0;
    const detailedItems = [];

    for (const item of cartItems) {
      if (!item.id || !item.quantity) continue;

      let verifiedPrice = 0;
      let verifiedName = item.id;

      if (['popular', 'medio', 'grosso'].includes(item.id)) {
         const { data: store } = await supabaseClient.from('storefronts').select(`price_b2c_${item.id}`).eq('id', order.seller_storefront_id).single();
         if (store) {
            let p = Number(store[`price_b2c_${item.id}`]);
            if (!p || p <= 0) {
               if (item.id === 'popular') p = 20;
               if (item.id === 'medio') p = 26;
               if (item.id === 'grosso') p = 35;
            }
            verifiedPrice = p;
            verifiedName = `Açaí ${item.id.charAt(0).toUpperCase() + item.id.slice(1)}`;
         }
      } else if (item.id === 'B2B') {
         const { data: store } = await supabaseClient.from('storefronts').select('price_b2b').eq('id', order.seller_storefront_id).single();
         if (store) {
            let p = Number(store.price_b2b);
            if (!p || p <= 0) p = 120;
            verifiedPrice = p;
            verifiedName = 'Paneiro de Açaí';
         }
      } else if (item.id === 'COLETA') {
         verifiedPrice = Number(platformSettings.col_fixed_price || 50);
         verifiedName = 'Serviço de Coleta (Caçamba)';
      } else {
         const { data: product } = await supabaseClient.from('products').select('name, price').eq('id', item.id).single();
         if (product && product.price) {
           verifiedPrice = Number(product.price);
           verifiedName = product.name;
         }
      }

      if (verifiedPrice > 0) {
        verifiedSubtotal += (verifiedPrice * item.quantity);
        detailedItems.push({
          id: item.id,
          name: verifiedName,
          price: verifiedPrice,
          quantity: item.quantity
        });
      }
    }

    if (verifiedSubtotal <= 0 || detailedItems.length === 0) {
      throw new Error('Forbidden: Invalid product price or manipulation detected.');
    }

    // 4. Segurança Crítica 2: Cálculo Dinâmico de Distância no Servidor (Distance Spoofing Fix)
    const { data: buyerUser } = await supabaseClient.from('users').select('latitude, longitude, email, name').eq('id', order.buyer_id).single();
    const { data: sellerStore } = await supabaseClient.from('storefronts').select('partner_id, frete_subsidy_pct').eq('id', order.seller_storefront_id).single();
    if (!sellerStore) throw new Error('Seller storefront not found');
    
    const { data: sellerUser } = await supabaseClient.from('users').select('latitude, longitude, mp_access_token').eq('id', sellerStore.partner_id).single();

    if (!buyerUser || !sellerUser || !sellerUser.mp_access_token) {
        throw new Error('Loja não possui conta do Mercado Pago vinculada ou erro de localização.');
    }

    let serverDistanceKm = 0;
    if (buyerUser.latitude && buyerUser.longitude && sellerUser.latitude && sellerUser.longitude) {
       serverDistanceKm = haversineKm(buyerUser.latitude, buyerUser.longitude, sellerUser.latitude, sellerUser.longitude);
    }
    
    // 5. Segurança Crítica 3: Substituir taxas do cliente pelas do Servidor (Fee Spoofing Fix)

    const isB2C = order.order_type === 'B2C' || order.order_type === 'COLETA';
    const serverPlatformFeePct = isB2C ? platformSettings.b2c_fee_percentage : platformSettings.b2b_fee_percentage;
    const serverDeliveryFeePerKm = isB2C ? platformSettings.motoboy_fee_per_km : platformSettings.truck_fee_per_km;
    const serverDeliveryPlatformFeePct = isB2C ? platformSettings.motoboy_platform_fee_percentage : platformSettings.truck_platform_fee_percentage;

    // Save ALL server-validated values back to the DB before creating preference, completely overriding client inputs
    await supabaseClient.from('orders').update({ 
      products_subtotal: verifiedSubtotal,
      delivery_distance_km: serverDistanceKm,
      applied_platform_fee_percent: serverPlatformFeePct,
      applied_delivery_fee_per_km: serverDeliveryFeePerKm,
      applied_delivery_platform_fee_percent: serverDeliveryPlatformFeePct,
      items: detailedItems
    }).eq('id', orderId);

    // Refresh order state
    const refreshed = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
    if (refreshed.data) order = refreshed.data;

    // 6. Decrypt the Token (or use Master Token for COLETA)
    let accessToken = '';
    
    if (order.order_type === 'COLETA') {
        accessToken = Deno.env.get('MP_ACCESS_TOKEN') || '';
        if (!accessToken) throw new Error('Master MP Access Token not configured for platform');
    } else {
        const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
        if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY missing in server config');

        const [ivBase64, encryptedBase64] = sellerUser.mp_access_token.split(':');
        const keyBytes = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        try {
          const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, encryptedData);
          accessToken = new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
          throw new Error('Falha ao descriptografar token do Mercado Pago da loja');
        }
    }

    if (!accessToken) throw new Error('Mercado Pago Access Token not configured');

    // 7. Calculate Final Application Fee (Platform Tax + Driver Fee)
    const itemsTotal = Number(order.products_subtotal);
    const platformFeePct = Number(order.applied_platform_fee_percent || 0);
    const platformSalesFeeAmount = (itemsTotal * platformFeePct) / 100;
    
    const deliveryDistance = Number(order.delivery_distance_km || 0);
    const deliveryFeePerKm = Number(order.applied_delivery_fee_per_km || 0);
    const totalDeliveryFee = deliveryDistance * deliveryFeePerKm;
    const subsidyPct = Number(sellerStore.frete_subsidy_pct || 0);
    const customerDeliveryFee = totalDeliveryFee * (1 - (subsidyPct / 100));

    let totalApplicationFee = platformSalesFeeAmount + totalDeliveryFee;
    let finalTotal = itemsTotal + customerDeliveryFee;

    if (order.order_type === 'COLETA') {
        // Platform keeps 100% since they receive it and pay driver via PIX
        totalApplicationFee = 0; 
        finalTotal = itemsTotal; // Just the fixed price
    }

    if (totalApplicationFee > finalTotal) {
      throw new Error('O frete total da corrida é maior que o valor do produto. Devido à taxa de subsídio desta loja, não é possível concluir o pedido. Por favor, adicione mais itens ao carrinho.');
    }

    // 8. Create Preference in Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            title: `AçaíFood Order #${orderId.substring(0,8)}`,
            quantity: 1,
            unit_price: Number(finalTotal.toFixed(2)),
            currency_id: 'BRL'
          }
        ],
        marketplace_fee: Number(totalApplicationFee.toFixed(2)),
        external_reference: orderId,
        payer: {
          email: buyerUser.email || 'cliente@acaifood.app',
          name: buyerUser.name || 'Cliente'
        },
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }],
          installments: 1
        },
        back_urls: {
          success: `${requestOrigin}/?payment=success`,
          failure: `${requestOrigin}/?payment=failure`,
          pending: `${requestOrigin}/?payment=pending`
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook?seller_id=${sellerStore.partner_id}${order.order_type === 'COLETA' ? '&is_platform=true' : ''}`
      })
    });

    const preference = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("MP Preference Error:", preference);
        throw new Error(`Failed to create MP Preference: ${preference.message || JSON.stringify(preference)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        init_point: preference.init_point, 
        sandbox_init_point: preference.sandbox_init_point,
        preference_id: preference.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Checkout Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so supabase-js doesn't throw a generic Error
    });
  }
});
