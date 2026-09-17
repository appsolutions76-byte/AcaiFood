import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.warn('[payout-sweep DEPRECATION] Esta Edge Function foi substituída pela rota /api/asaas/sweep (Rodada 5). Nenhuma transferência foi executada por este endpoint.')

  return new Response(
    JSON.stringify({
      deprecated: true,
      message: 'payout-sweep foi substituída pela rota /api/asaas/sweep (rodada 5) — esta função não deve mais transferir dinheiro.'
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
})
