import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabaseClient
    .from('orders')
    .select('*, buyer:users!orders_buyer_id_fkey(cidade), storefront:storefronts!orders_seller_storefront_id_fkey(partner:users!storefronts_partner_id_fkey(cidade))')
    .eq('id', '9b0b35b9-723c-4939-866f-7cd26648f31c')
    .single()

  return new Response(JSON.stringify({ data, error }), {
    headers: { "Content-Type": "application/json" },
  })
})
