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

    // Verify Admin Role
    const { data: userData } = await systemClient.from('users').select('role').eq('id', user.id).single();
    if (!userData || userData.role !== 'admin') {
        throw new Error('Forbidden: Only Admin can clear orders');
    }

    // Delete all orders
    // Use a valid dummy UUID to safely bypass PostgREST requiring a filter for delete()
    const { error: deleteError } = await systemClient.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
        throw new Error(`Failed to delete orders: ${deleteError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'All orders cleared' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Clear Orders Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
