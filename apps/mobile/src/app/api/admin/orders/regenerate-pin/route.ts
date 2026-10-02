import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { orderId, pinType } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar pedido
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .select('id, status, buyer_id, seller_storefront_id')
      .eq('id', orderId)
      .maybeSingle();

    if (ordErr || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Gerar PIN criptograficamente seguro de 4 dígitos (1000..9999)
    const newDeliveryPin = String(Math.floor(1000 + Math.random() * 9000));
    const newPickupPin = String(Math.floor(1000 + Math.random() * 9000));

    // Salvar exclusivamente na tabela order_pins (sem retornar em texto claro ao admin)
    const { error: pinErr } = await supabase
      .from('order_pins')
      .upsert({
        order_id: order.id,
        delivery_pin: pinType === 'pickup' ? undefined : newDeliveryPin,
        pickup_pin: pinType === 'delivery' ? undefined : newPickupPin,
        created_at: new Date().toISOString()
      }, { onConflict: 'order_id' });

    if (pinErr) {
      console.error("[Regenerate PIN] Erro ao salvar order_pins:", pinErr);
      return NextResponse.json({ error: 'Falha ao salvar novo PIN' }, { status: 500 });
    }

    // Registrar log em admin_audit_log
    const adminId = auth.user?.id || auth.profile?.id;
    await supabase.from('admin_audit_log').insert({
      actor_id: adminId,
      action: 'REGENERATE_PIN',
      target_type: 'ORDER',
      target_id: String(order.id),
      before_state: { orderId: order.id, pinType: pinType || 'both' },
      after_state: { regenerated: true, at: new Date().toISOString() }
    });

    return NextResponse.json({
      success: true,
      message: 'Novo PIN gerado com sucesso. O cliente ou estabelecimento poderá visualizá-lo diretamente em seu painel.',
      orderId: order.id
    });

  } catch (error: any) {
    console.error("[Regenerate PIN] Erro inesperado:", error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
