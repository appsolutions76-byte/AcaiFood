import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey } from '@/lib/asaasConfig';

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // 1. Tentar acionar a Edge Function payout-sweep no Supabase
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/payout-sweep`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          }
        });
        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          return NextResponse.json({ success: true, mode: 'edge-function', ...edgeData });
        }
      } catch (edgeErr) {
        console.warn("Edge function payout-sweep falhou, processando via backend Next.js:", edgeErr);
      }
    }

    // 2. Fallback de varredura executado diretamente no servidor Next.js
    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
    }

    const { data: settings } = await supabase.from('platform_settings').select('*').limit(1).maybeSingle();
    const courierMode = settings?.courier_payment_mode || 'KM';
    const courierFixed = Number(settings?.courier_fixed_fee ?? 0);
    const transporterMode = settings?.transporter_payment_mode || 'KM';
    const transporterFixed = Number(settings?.transporter_fixed_fee ?? 0);

    const validStatuses = ['RECEIVED', 'DELIVERED', 'COMPLETED', 'entregue', 'concluido'];
    const { data: rawOrders } = await supabase
      .from('orders')
      .select('id, order_type, status, products_subtotal, delivery_distance_km, applied_delivery_fee_per_km, applied_platform_fee_percent, applied_delivery_platform_fee_percent, seller_storefront_id, driver_id, payout_seller_done, payout_driver_done')
      .order('created_at', { ascending: false })
      .limit(100);

    const pendingOrders = (rawOrders || []).filter((o: any) => 
      validStatuses.includes(String(o.status || '')) && (!o.payout_seller_done || !o.payout_driver_done)
    );

    let processedCount = 0;
    for (const order of pendingOrders) {
      // Marcar repasses pendentes como liquidados na varredura diária
      const updates: any = {};
      if (!order.payout_seller_done) updates.payout_seller_done = true;
      if (!order.payout_driver_done) updates.payout_driver_done = true;
      if (Object.keys(updates).length > 0) {
        await supabase.from('orders').update(updates).eq('id', order.id);
        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Varredura diária executada com sucesso. Pedidos regularizados: ${processedCount}`,
      pendingCount: pendingOrders.length
    });

  } catch (err: any) {
    console.error("Exceção na rota /api/asaas/sweep:", err);
    return NextResponse.json({ error: err.message || 'Erro interno na varredura' }, { status: 500 });
  }
}
