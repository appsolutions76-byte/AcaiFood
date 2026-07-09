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
    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('Order ID is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized: Invalid token')

    // System Client for admin bypass
    const systemClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch Order and Payment ID
    const { data: order, error: orderError } = await systemClient
      .from('orders')
      .select('*, seller_storefront_id, buyer_id, mp_payment_id, status')
      .eq('id', orderId)
      .single();
      
    if (orderError || !order) throw new Error('Order not found')
    
    // Authorization: Only Buyer, Seller or Admin can cancel
    if (order.buyer_id !== user.id) {
       // Let's check if the user is the seller
       const { data: sellerStore } = await systemClient.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).single()
       if (!sellerStore || sellerStore.partner_id !== user.id) {
           throw new Error('Forbidden: You do not have permission to refund this order')
       }
    }

    if (!order.mp_payment_id) {
      // If there's no payment ID, maybe it wasn't paid via MP yet. Just return success so the app can cancel it locally.
      return new Response(JSON.stringify({ success: true, message: 'No payment to refund' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Fetch Seller's MP Token
    const { data: sellerStore } = await systemClient.from('storefronts').select('partner_id').eq('id', order.seller_storefront_id).single()
    if (!sellerStore) throw new Error('Seller storefront not found')

    const { data: sellerUser } = await systemClient.from('users').select('mp_access_token').eq('id', sellerStore.partner_id).single()
    if (!sellerUser || !sellerUser.mp_access_token) {
        throw new Error('Seller does not have Mercado Pago linked.')
    }

    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY missing in server config');

    let accessToken = '';
    try {
        const [ivBase64, encryptedBase64] = sellerUser.mp_access_token.split(':');
        const keyBytes = new Uint8Array(ENCRYPTION_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, encryptedData);
        accessToken = new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        console.error("Decryption error:", e);
        throw new Error('Failed to decrypt seller MP token');
    }

    // 3. Issue Refund via Mercado Pago API
    const refundResponse = await fetch(`https://api.mercadopago.com/v1/payments/${order.mp_payment_id}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund_${order.id}_${Date.now()}` // Prevent double refunds
      }
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok) {
        console.error("MP Refund Error:", refundData);
        // If the error is that it was already refunded, we can ignore it
        if (refundData.message && refundData.message.includes('already refunded')) {
           // Proceed as success
        } else {
           throw new Error(refundData.message || 'Failed to issue refund on Mercado Pago');
        }
    }

    // 4. Update order to cancelled/refunded
    await systemClient
      .from('orders')
      .update({ status: 'CANCELLED' }) // You can create a 'REFUNDED' status if preferred, but CANCELLED maps well
      .eq('id', orderId);

    return new Response(JSON.stringify({ success: true, refund: refundData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Refund Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
