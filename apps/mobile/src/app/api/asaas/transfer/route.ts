import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pixKey, value, description, orderId } = body;

    if (!pixKey || !value || value <= 0) {
      return NextResponse.json(
        { error: 'Chave Pix e Valor positivo são obrigatórios para a transferência' },
        { status: 400 }
      );
    }

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada no servidor' },
        { status: 400 }
      );
    }

    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg');
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    // Limpa a chave Pix
    const cleanPixKey = String(pixKey).trim();

    // Determina o tipo de chave Pix se necessário ou envia pixAddressKey direto
    const transferBody: any = {
      value: Number(value.toFixed(2)),
      pixAddressKey: cleanPixKey,
      description: description || `Repasse AçaíFood #${String(orderId || '').substring(0, 8)}`
    };

    console.log(`Iniciando transferência Pix no Asaas (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}):`, transferBody);

    const res = await fetch(`${ASAAS_URL}/transfers`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transferBody)
    });

    const data = await res.json();

    if (!res.ok || data.errors) {
      const msg = data.errors
        ? data.errors.map((e: any) => e.description).join(', ')
        : (data.message || JSON.stringify(data));
      console.warn("Alerta ao realizar transferência Pix Asaas:", msg);
      return NextResponse.json({ error: `Transferência Pix Asaas: ${msg}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transferId: data.id,
      status: data.status,
      value: data.value
    });

  } catch (error: any) {
    console.error("Erro na API de Transferência Pix do Asaas:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar transferência Asaas' },
      { status: 500 }
    );
  }
}
