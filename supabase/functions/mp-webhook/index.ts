import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Mercado Pago often sends data in URL parameters or body
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');
    const sellerId = url.searchParams.get('seller_id');
    
    // Sometimes it sends it in the JSON body
    let body: any = {};
    if (req.body) {
      try {
        body = await req.json();
      } catch (e) {
        // ignore
      }
    }

    const eventType = topic || body.type || body.topic;
    const resourceId = id || body.data?.id;

    if (eventType === 'payment' && resourceId) {
      if (!sellerId) {
         console.error('No seller_id provided in webhook URL');
         return new Response('OK', { status: 200 }); // Return 200 so MP stops retrying
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
      if (!ENCRYPTION_KEY) {
         console.error('No ENCRYPTION_KEY found in environment');
         return new Response('OK', { status: 200 });
      }

      // Fetch the seller's encrypted token
      const { data: sellerUser, error: sellerError } = await supabaseClient
         .from('users')
         .select('mp_access_token')
         .eq('id', sellerId)
         .single();
         
      if (sellerError || !sellerUser || !sellerUser.mp_access_token) {
         console.error('Seller not found or no mp_access_token configured');
         return new Response('OK', { status: 200 });
      }

      // Decrypt token
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
          console.error('Failed to decrypt token in webhook:', e);
          return new Response('OK', { status: 200 });
      }

      const response = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const paymentData = await response.json();

      if (paymentData.status === 'approved') {
        const orderId = paymentData.external_reference;
        
        if (orderId) {
          // Update order status in DB
          await supabaseClient
            .from('orders')
            .update({ 
              status: 'PAID', 
              mp_payment_id: resourceId.toString() 
            })
            .eq('id', orderId)
            .eq('status', 'PENDING'); // Only update if it's currently pending
            
          console.log(`Order ${orderId} marked as PAID`);
        }
      }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    })
  }
})
