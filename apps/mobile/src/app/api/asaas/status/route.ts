import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENV = process.env.ASAAS_ENVIRONMENT || 'production';
    const isSandbox = ASAAS_ENV === 'sandbox' || (ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg'));
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    // 1. Se forneceu paymentId, consulta diretamente no Asaas
    if (paymentId && ASAAS_API_KEY) {
      const res = await fetch(`${ASAAS_URL}/payments/${paymentId}`, {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const status = data.status; // RECEIVED, CONFIRMED, PENDING, etc.
        const isPaid = status === 'RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED_IN_CASH';
        return NextResponse.json({
          paymentId: data.id,
          orderId: data.externalReference || orderId,
          status,
          isPaid,
          value: data.value
        });
      }
    }

    // 2. Se forneceu orderId, verifica também no Supabase (se atualizado via webhook)
    if (orderId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: order } = await supabase
          .from('orders')
          .select('id, status, asaas_payment_id, asaas_charge_status')
          .eq('id', orderId)
          .maybeSingle();

        if (order) {
          const isPaid = order.status === 'PAID' || order.status === 'PREPARING' || order.status === 'READY' || order.status === 'DELIVERING' || order.status === 'DELIVERED' || order.status === 'RECEIVED' || order.status === 'COMPLETED' || order.asaas_charge_status === 'RECEIVED' || order.asaas_charge_status === 'CONFIRMED';
          return NextResponse.json({
            paymentId: order.asaas_payment_id || paymentId,
            orderId: order.id,
            status: order.asaas_charge_status || order.status,
            isPaid
          });
        }
      }
    }

    return NextResponse.json({ isPaid: false, status: 'PENDING' });

  } catch (error: any) {
    console.error("Erro na rota GET /api/asaas/status:", error);
    return NextResponse.json({ isPaid: false, error: error.message }, { status: 500 });
  }
}
