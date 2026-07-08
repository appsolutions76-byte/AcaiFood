import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Server configuration missing')
    }

    // 1. Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 2. Initialize a client with the caller's JWT to verify their identity
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const jwt = authHeader.replace('Bearer ', '').trim()

    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser(jwt)
    
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'User not found'}` }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 3. Verify if caller is an ADMIN
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: `Forbidden. Admin role required. Profile error: ${JSON.stringify(profileError)}` }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 4. Parse the request body to get the target user ID
    const { targetUserId } = await req.json()
    if (!targetUserId || typeof targetUserId !== 'string') {
      return new Response(JSON.stringify({ error: 'targetUserId is required and must be a string' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return new Response(JSON.stringify({ error: 'Invalid targetUserId format. Must be a UUID.' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 5. Initialize Admin Client with Service Role Key to bypass RLS and Auth restrictions
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 6. Delete the user from auth.users (This cascades to public.users and everything else)
    const { data: deleteData, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

    if (deleteError) {
      console.error("Error deleting user:", deleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete user', details: deleteError }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ success: true, message: `User ${targetUserId} successfully deleted` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("Exception in remove-account:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
