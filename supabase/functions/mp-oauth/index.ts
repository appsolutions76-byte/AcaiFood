import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptToken(token: string, secretKeyHex: string) {
  const keyBytes = new Uint8Array(secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedToken = new TextEncoder().encode(token);
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, encodedToken);
  return `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(encryptedBuffer)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Code or state missing' }), { headers: corsHeaders, status: 400 });
    }

    const userId = state; // We pass the seller's user.id as state
    const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID');
    const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET');
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Default redirect URI provided by Supabase Edge Functions is exactly the function URL itself
    // Or we can construct it dynamically:
    const redirectUri = url.origin + url.pathname;

    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET || !ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response('Missing server configuration', { status: 500 });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("MP OAuth Error:", tokenData);
      return new Response(JSON.stringify({ error: 'Failed to get access token', details: tokenData }), { headers: corsHeaders, status: 400 });
    }

    const encryptedAccessToken = await encryptToken(tokenData.access_token, ENCRYPTION_KEY);
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabaseClient
      .from('users')
      .update({ mp_access_token: encryptedAccessToken, mp_merchant_id: tokenData.user_id?.toString() })
      .eq('id', userId);

    if (error) {
      console.error("DB Error:", error);
      return new Response('Database error during token save', { status: 500 });
    }

    // Redirect user back to the app (App Solutions domain or Vercel domain)
    // We can use a deep link if mobile, or just a success page.
    const htmlResponse = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Conta Vinculada!</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #f4f4f5; color: #18181b;">
          <h1 style="color: #6d28d9;">AçaíFood</h1>
          <h2>Conta vinculada com sucesso!</h2>
          <p>Sua conta do Mercado Pago foi conectada. Você já pode fechar esta tela e voltar para o aplicativo.</p>
        </body>
      </html>
    `;

    return new Response(htmlResponse, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      status: 200,
    });

  } catch (error) {
    console.error("OAuth Execution Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
