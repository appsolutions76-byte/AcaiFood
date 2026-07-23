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
    const { orderId, value, split, customerEmail, customerName, customerCpfCnpj } = await req.json();

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada nas variáveis de ambiente do Supabase Secrets');
    }

    const ASAAS_ENV = Deno.env.get('ASAAS_ENV') || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox 
      ? 'https://sandbox.asaas.com/api/v3' 
      : 'https://www.asaas.com/api/v3';

    console.log(`Iniciando checkout no Asaas (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}):`, { orderId, value });

    // 1. Criar ou buscar cliente no Asaas
    let customerId = '';
    const emailToSearch = customerEmail || 'cliente@acaifood.com.br';
    
    const cleanCpfCnpj = (val?: string) => {
      if (!val) return undefined;
      const digits = String(val).replace(/\D/g, '');
      return (digits.length === 11 || digits.length === 14) ? digits : undefined;
    };
    const validCpfCnpj = cleanCpfCnpj(customerCpfCnpj);

    const searchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(emailToSearch)}`, {
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const searchData = await searchRes.json();
    if (searchData && searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customerName || 'Cliente AçaíFood',
          email: emailToSearch,
          cpfCnpj: validCpfCnpj
        })
      });
      const createData = await createRes.json();
      if (createData.id) {
        customerId = createData.id;
      } else {
        const msg = createData.errors ? createData.errors.map((e: any) => e.description).join(', ') : JSON.stringify(createData);
        throw new Error(`Falha ao criar cliente no Asaas: ${msg}`);
      }
    }

    // Data de vencimento para hoje
    const today = new Date().toISOString().split('T')[0];

    // Formata o split de pagamentos caso existam regras
    const formattedSplit = Array.isArray(split) ? split.map((s: any) => {
      const val = typeof s.fixedValue === 'number' ? s.fixedValue : (typeof s.amount === 'number' ? s.amount : null);
      if (s.walletId && val !== null && typeof s.walletId === 'string' && s.walletId.length > 5 && !s.walletId.includes('loja_parceira')) {
        return {
          walletId: s.walletId,
          fixedValue: Number(val.toFixed(2))
        };
      }
      return null;
    }).filter(Boolean) : undefined;

    // 2. Criar Cobrança (Payment) no Asaas (com billingType PIX)
    const paymentBody: any = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(value.toFixed(2)),
      dueDate: today,
      externalReference: orderId,
      description: `Pedido AçaíFood #${orderId.substring(0, 8)}`
    };

    if (formattedSplit && formattedSplit.length > 0) {
      paymentBody.split = formattedSplit;
    }

    const payRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    });

    const paymentData = await payRes.json();
    if (!paymentData.id) {
      const msg = paymentData.errors ? paymentData.errors.map((e: any) => e.description).join(', ') : JSON.stringify(paymentData);
      throw new Error(`Erro ao gerar cobrança no Asaas: ${msg}`);
    }

    // 3. Buscar Pix QR Code e Copia e Cola
    let pixData: any = {};
    try {
      const pixRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      });
      pixData = await pixRes.json();
    } catch (e) {
      console.warn("Não foi possível gerar o Pix QR Code imediatamente:", e);
    }

    // 4. Salvar o ID da cobrança no pedido Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('orders')
      .update({ 
        asaas_payment_id: paymentData.id,
        asaas_charge_status: paymentData.status 
      })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({
        paymentId: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl,
        pixQrCode: pixData.encodedImage || null,
        pixCopiaECola: pixData.payload || null,
        status: paymentData.status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error("Erro na Edge Function asaas-checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno ao processar Asaas' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
