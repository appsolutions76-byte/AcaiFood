import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async () => {
  return new Response(JSON.stringify({ error: "Endpoint desativado em produção." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  })
})
