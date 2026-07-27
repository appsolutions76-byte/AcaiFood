import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, value, split, customerEmail, customerName, customerCpfCnpj } = body;

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor (env)' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    // 1. Criar ou Buscar Cliente no Asaas
    let customerId = '';
    const emailToSearch = customerEmail || 'cliente@acaifood.com.br';
    
    const cleanDigits = (val?: string) => {
      if (!val) return undefined;
      const digits = String(val).replace(/\D/g, '');
      return (digits.length === 11 || digits.length === 14) ? digits : undefined;
    };
    const validCpfCnpj = cleanDigits(customerCpfCnpj);

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
        const msg = createData.errors
          ? createData.errors.map((e: any) => e.description).join(', ')
          : (createData.message || JSON.stringify(createData));
        return NextResponse.json({ error: `Asaas Cliente: ${msg}` }, { status: 400 });
      }
    }

    // Vencimento para 3 dias no futuro (para garantir validade do Pix sem expiração prematura no BACEN)
    const dueDateObj = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    // Formatar Split (apenas enviar walletId se for um UUID/ID de conta Asaas real e não um e-mail ou chave Pix simples)
    const isValidAsaasWalletId = (id?: string) => {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim();
      if (clean.length < 10) return false;
      if (clean.includes('@') || clean.includes('loja_parceira') || clean.includes('asaas_wallet_') || clean.includes('wallet_master')) return false;
      return true;
    };

    const formattedSplit = Array.isArray(split) ? split.map((s: any) => {
      const val = typeof s.fixedValue === 'number' ? s.fixedValue : (typeof s.amount === 'number' ? s.amount : null);
      if (s.walletId && val !== null && val > 0 && isValidAsaasWalletId(s.walletId)) {
        return {
          walletId: s.walletId.trim(),
          fixedValue: Number(val.toFixed(2))
        };
      }
      return null;
    }).filter(Boolean) : undefined;

    // 2. Criar Cobrança (BillingType PIX)
    const paymentBody: any = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(value.toFixed(2)),
      dueDate: dueDate,
      externalReference: orderId,
      description: `Pedido AçaíFood #${String(orderId).substring(0, 8)}`
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
      const msg = paymentData.errors
        ? paymentData.errors.map((e: any) => e.description).join(', ')
        : (paymentData.message || JSON.stringify(paymentData));
      return NextResponse.json({ error: `Asaas Cobrança: ${msg}` }, { status: 400 });
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
      console.warn("Erro ao buscar QR Code Pix do Asaas:", e);
    }

    return NextResponse.json({
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl,
      pixQrCode: pixData.encodedImage || null,
      pixCopiaECola: pixData.payload || null,
      status: paymentData.status,
      isSandbox
    });

  } catch (error: any) {
    console.error("Erro na API de Checkout do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar Asaas' },
      { status: 500 }
    );
  }
}
