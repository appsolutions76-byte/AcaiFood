import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, cartItems } = await req.json();
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

    // 2. Fetch Order First to get seller ID
    let { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, seller_storefront_id, buyer_id, driver_id')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) throw new Error('Order not found');

    // 3. Segurança Financeira: Validar produtos contra o Banco de Dados
    let verifiedSubtotal = null;
    if (cartItems && cartItems.length > 0) {
      verifiedSubtotal = 0;
      for (const item of cartItems) {
        if (!item.id || !item.quantity) continue;

        if (['popular', 'medio', 'grosso'].includes(item.id)) {
           // B2C Standard Açaí
           const { data: store } = await supabaseClient.from('storefronts').select(`price_b2c_${item.id}`).eq('id', order.seller_storefront_id).single();
           if (store && store[`price_b2c_${item.id}`]) {
              verifiedSubtotal += (store[`price_b2c_${item.id}`] * item.quantity);
           }
        } else if (item.id === 'B2B') {
           // Lote Fruto B2B
           const { data: store } = await supabaseClient.from('storefronts').select('price_b2b').eq('id', order.seller_storefront_id).single();
           if (store && store.price_b2b) {
              verifiedSubtotal += (store.price_b2b * item.quantity);
           }
        } else {
           // Custom Product
           const { data: product } = await supabaseClient.from('products').select('price').eq('id', item.id).single();
           if (product && product.price) {
             verifiedSubtotal += (product.price * item.quantity);
           }
        }
      }
      
      // Update order with secure server-calculated subtotal
      if (verifiedSubtotal > 0) {
        await supabaseClient.from('orders').update({ products_subtotal: verifiedSubtotal }).eq('id', orderId);
        // Refresh order
        const refreshed = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
        if (refreshed.data) order = refreshed.data;
      }
    }

    if (orderError || !order) throw new Error('Order not found');

    // 3. Segurança Crítica: Validar se quem chama é o dono do pedido
    if (order.buyer_id !== user.id) {
        throw new Error('Forbidden: You can only checkout your own orders');
    }

    // 4. Fetch Seller's MP Token (Encrypted in database)
    let accessToken = '';
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY missing in server config');

    const { data: sellerStore } = await supabaseClient.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).single();
    if (!sellerStore) throw new Error('Seller storefront not found');

    const { data: sellerUser } = await supabaseClient.from('users').select('mp_access_token').eq('id', sellerStore.partner_id).single();
    if (!sellerUser || !sellerUser.mp_access_token) {
        throw new Error('Loja não possui conta do Mercado Pago vinculada.');
    }

    // Decrypt the token
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

    if (!accessToken) throw new Error('Mercado Pago Access Token not configured');

    // 5. Calculate Application Fee (Platform Tax + Driver Fee)
    // The marketplace_fee must capture the Platform's Sales Fee AND the entire Delivery Fee (since it goes to the Virtual Vault)
    const itemsTotal = Number(order.products_subtotal);
    const platformFeePct = Number(order.applied_platform_fee_percent || 0);
    const platformSalesFeeAmount = (itemsTotal * platformFeePct) / 100;
    
    const deliveryDistance = Number(order.delivery_distance_km || 0);
    const deliveryFeePerKm = Number(order.applied_delivery_fee_per_km || 0);
    const totalDeliveryFee = deliveryDistance * deliveryFeePerKm;

    const totalApplicationFee = platformSalesFeeAmount + totalDeliveryFee;
    const finalTotal = itemsTotal + totalDeliveryFee;

    // 6. Create Preference in Mercado Pago
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
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }],
          installments: 1
        },
        back_urls: {
          success: 'https://acaifood.app/success',
          failure: 'https://acaifood.app/failure',
          pending: 'https://acaifood.app/pending'
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`
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
      status: 400,
    });
  }
});
