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

    // 2. Segurança Financeira: Validar produtos contra o Banco de Dados
    let verifiedSubtotal = null;
    if (cartItems && cartItems.length > 0) {
      verifiedSubtotal = 0;
      for (const item of cartItems) {
        if (!item.id || !item.quantity) continue;
        const { data: product } = await supabaseClient.from('products').select('price').eq('id', item.id).single();
        if (product && product.price) {
          verifiedSubtotal += (product.price * item.quantity);
        }
      }
      
      // Update order with secure server-calculated subtotal
      if (verifiedSubtotal > 0) {
        await supabaseClient.from('orders').update({ products_subtotal: verifiedSubtotal }).eq('id', orderId);
      }
    }

    // 3. Fetch Order with Triple Split details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, seller_storefront_id, buyer_id, driver_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // 3. Segurança Crítica: Validar se quem chama é o dono do pedido
    if (order.buyer_id !== user.id) {
        throw new Error('Forbidden: You can only checkout your own orders');
    }

    // 2. Fetch Seller's MP Token (For testing, we can use the global test token if available)
    const GLOBAL_TEST_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    let accessToken = GLOBAL_TEST_TOKEN;

    // Real life scenario: fetch from seller's user profile (encrypted)
    if (!accessToken) {
        const { data: sellerStore } = await supabaseClient.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).single();
        if (sellerStore) {
            const { data: sellerUser } = await supabaseClient.from('users').select('mp_access_token').eq('id', sellerStore.partner_id).single();
            // In a real scenario, you'd decrypt `sellerUser.mp_access_token` here using ENCRYPTION_KEY
            // accessToken = decryptToken(sellerUser.mp_access_token, Deno.env.get('ENCRYPTION_KEY'));
            // For now, if no test token, we fail
            throw new Error('Seller has not connected Mercado Pago and no TEST token provided');
        }
    }

    if (!accessToken) throw new Error('Mercado Pago Access Token not configured');

    // 3. Create MP Preference Payload
    const totalAmount = Number(order.total_amount);
    const platformFee = Number(order.total_platform_fee_amount);
    const driverAmount = Number(order.driver_amount);

    const preferenceData: any = {
      items: [
        {
          title: `AçaíFood Order #${order.id.split('-')[0]}`,
          unit_price: totalAmount,
          quantity: 1,
        }
      ],
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }],
        installments: 1
      },
      marketplace_fee: platformFee,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      external_reference: order.id,
    };

    // If there's a driver and a split is needed, we would add the driver to `disbursements` array.
    // Note: Mercado Pago Advanced Split requires configuring OAuth for the driver as well.
    // For this prototype, we'll keep it simple (Marketplace Fee -> App, Rest -> Seller).
    // The seller is responsible for paying the driver manually, OR we use full MP Split.
    // To use full split, we need driver's collector_id:
    /*
    if (driverAmount > 0 && order.driver_id) {
       // ... fetch driver's collector ID ...
       preferenceData.disbursements = [{
          collector_id: driverCollectorId,
          marketplace_fee: 0,
          amount: driverAmount
       }]
    }
    */

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    const preference = await response.json();

    if (!response.ok) {
        console.error(preference);
        throw new Error('Failed to create MP Preference');
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
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
