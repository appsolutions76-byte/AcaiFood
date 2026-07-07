import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Mercado Pago often sends data in URL parameters or body
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');
    
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
      // Fetch the actual payment status from MP
      const GLOBAL_TEST_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
      const accessToken = GLOBAL_TEST_TOKEN; // In real life, need logic to know which seller's token to use to query this, or use Platform token if Marketplace.

      if (!accessToken) {
         console.error('No Access Token to verify payment');
         return new Response('OK', { status: 200 }); // Return 200 so MP stops retrying
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
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

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
