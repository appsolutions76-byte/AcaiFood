import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAsaasApiKey } from '@/lib/asaasConfig';
import { isAuthorizedRequest, authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  // Verificar autenticação: aceita admin JWT, internal-secret ou cron da Vercel
  const isInternalOrCron = isAuthorizedRequest(request);
  if (!isInternalOrCron) {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized) {
      console.warn("[API Sweep] Acesso negado:", auth.error);
      return unauthorizedResponse(auth.error);
    }
  }

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
        console.warn("Edge function payout-sweep falhou, executando varredura via backend Next.js:", edgeErr);
      }
    }

    // 2. Fallback: Identificar pedidos com repasses pendentes para revisão manual
    // IMPORTANTE: Este fallback NÃO envia PIX automaticamente e NÃO marca como liquidado.
    // A liquidação real deve ocorrer via Asaas (Edge Function) ou via admin manual no painel.
    const ASAAS_API_KEY = await getAsaasApiKey();
    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
    }

    const validStatuses = ['RECEIVED', 'DELIVERED', 'COMPLETED', 'entregue', 'concluido'];
    const { data: rawOrders } = await supabase
      .from('orders')
      .select('id, order_type, status, products_subtotal, delivery_distance_km, seller_storefront_id, driver_id, payout_seller_done, payout_driver_done')
      .order('created_at', { ascending: false })
      .limit(100);

    const pendingOrders = (rawOrders || []).filter((o: any) => 
      validStatuses.includes(String(o.status || '')) && (!o.payout_seller_done || !o.payout_driver_done)
    );

    const pendingList = pendingOrders.map((o: any) => ({
      id: o.id,
      sellerPending: !o.payout_seller_done,
      driverPending: !o.payout_driver_done,
    }));

    console.log(`[Sweep] ${pendingOrders.length} pedidos com repasses pendentes identificados. Nenhum PIX foi enviado automaticamente neste fallback.`);

    return NextResponse.json({
      success: true,
      message: `Varredura executada. ${pendingOrders.length} pedidos com repasses pendentes para revisão.`,
      pendingCount: pendingOrders.length,
      pendingOrders: pendingList,
      note: 'O fallback identifica pendências mas não envia PIX automaticamente. Use o painel admin ou a Edge Function payout-sweep para liquidar.'
    });

  } catch (err: any) {
    console.error("Exceção na rota /api/asaas/sweep:", err);
    return NextResponse.json({ error: err.message || 'Erro interno na varredura' }, { status: 500 });
  }
}
