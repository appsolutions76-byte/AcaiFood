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

    const ASAAS_ENV = Deno.env.get('ASAAS_ENVIRONMENT') || 'production';
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

    // Buscar primeiro por CPF/CNPJ se disponível
    if (validCpfCnpj) {
      const cpfSearchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${encodeURIComponent(validCpfCnpj)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      const cpfSearchData = await cpfSearchRes.json();
      if (cpfSearchData && cpfSearchData.data && cpfSearchData.data.length > 0) {
        customerId = cpfSearchData.data[0].id;
      }
    }

    // Se não encontrou por CPF/CNPJ, buscar por e-mail
    if (!customerId) {
      const emailSearchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(emailToSearch)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      const emailSearchData = await emailSearchRes.json();
      if (emailSearchData && emailSearchData.data && emailSearchData.data.length > 0) {
        customerId = emailSearchData.data[0].id;
      }
    }

    // Se ainda não encontrou, criar novo cliente
    if (!customerId) {
      const customerPayload: any = {
        name: customerName || 'Cliente AçaíFood',
        email: emailToSearch
      };
      if (validCpfCnpj) customerPayload.cpfCnpj = validCpfCnpj;

      let createRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });
      let createData = await createRes.json();

      if (!createData.id && customerPayload.cpfCnpj) {
        delete customerPayload.cpfCnpj;
        createRes = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerPayload)
        });
        createData = await createRes.json();
      }

      if (createData.id) {
        customerId = createData.id;
      } else {
        const msg = createData.errors ? createData.errors.map((e: any) => e.description).join(', ') : JSON.stringify(createData);
        throw new Error(`Falha ao criar cliente no Asaas: ${msg}`);
      }
    }

    // Data de vencimento para 3 dias no futuro (garantindo validade do Pix)
    const dueDateObj = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    // Formata o split de pagamentos caso existam regras (apenas walletId válida de conta Asaas real)
    const isValidAsaasWalletId = (id?: string) => {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim();
      if (clean.length < 10) return false;
      if (clean.includes('@') || clean.includes('loja_parceira') || clean.includes('asaas_wallet_') || clean.includes('wallet_master')) return false;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      const isAsaasId = clean.length >= 20 && !clean.match(/^\d+$/);
      return isUuid || isAsaasId;
    };

    let totalSplitValue = 0;
    let formattedSplit = Array.isArray(split) ? split.map((s: any) => {
      const val = typeof s.fixedValue === 'number' ? s.fixedValue : (typeof s.amount === 'number' ? s.amount : null);
      if (s.walletId && val !== null && val > 0 && isValidAsaasWalletId(s.walletId)) {
        const roundedVal = Number(val.toFixed(2));
        totalSplitValue += roundedVal;
        return {
          walletId: s.walletId.trim(),
          fixedValue: roundedVal
        };
      }
      return null;
    }).filter(Boolean) : undefined;

    const maxAllowedSplit = Number((value - 0.05).toFixed(2));
    if (formattedSplit && formattedSplit.length > 0 && maxAllowedSplit > 0 && totalSplitValue >= value) {
      const ratio = maxAllowedSplit / totalSplitValue;
      formattedSplit = formattedSplit.map((s: any) => ({
        ...s,
        fixedValue: Number((s.fixedValue * ratio).toFixed(2))
      }));
    }

    const validSplit = (formattedSplit && formattedSplit.length > 0) ? formattedSplit : undefined;

    // 2. Criar Cobrança (Payment) no Asaas (com billingType PIX)
    const paymentBody: any = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(value.toFixed(2)),
      dueDate: dueDate,
      externalReference: orderId,
      description: `Pedido AçaíFood #${orderId.substring(0, 8)}`
    };

    if (validSplit && validSplit.length > 0) {
      paymentBody.split = validSplit;
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
        status: paymentData.status,
        isSandbox
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
        status: 200,
      }
    )
  }
})
