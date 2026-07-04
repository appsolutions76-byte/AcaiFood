import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to encrypt using AES-256-GCM
async function encryptToken(token: string, secretKeyHex: string) {
  // Convert hex key to crypto key
  const keyBytes = new Uint8Array(secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedToken = new TextEncoder().encode(token);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    cryptoKey,
    encodedToken
  );

  const ivBase64 = arrayBufferToBase64(iv.buffer);
  const encryptedBase64 = arrayBufferToBase64(encryptedBuffer);

  return `${ivBase64}:${encryptedBase64}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, state } = await req.json()

    if (!code || !state) {
      throw new Error('Code or state missing')
    }

    // `state` should contain the `userId` requesting the OAuth binding
    const userId = state;

    const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID')
    const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET')
    const MP_REDIRECT_URI = Deno.env.get('MP_REDIRECT_URI')
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') // Must be 32 bytes hex string

    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET || !ENCRYPTION_KEY) {
      throw new Error('Missing server configuration')
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: MP_REDIRECT_URI || 'https://acaifood.app/api/oauth-callback'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to get access token from Mercado Pago');
    }

    // Encrypt the token
    const encryptedAccessToken = await encryptToken(tokenData.access_token, ENCRYPTION_KEY);

    // Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need service role to update arbitrary user
    )

    // Update user in database
    const { error } = await supabaseClient
      .from('User')
      .update({
        mpAccessToken: encryptedAccessToken,
        mpMerchantId: tokenData.user_id?.toString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Conta vinculada com sucesso' }),
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
