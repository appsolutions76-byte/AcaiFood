import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['cliente', 'admin', 'loja', 'motorista']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { orderId, rating, comment } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId é obrigatório.' }, { status: 400 });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 0 || numRating > 5) {
      return NextResponse.json({ error: 'A avaliação deve ser um número entre 0 e 5 estrelas.' }, { status: 400 });
    }

    const cleanRating = Math.max(0, Math.min(5, Math.round(numRating)));
    const cleanComment = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';

    const adminSupabase = getSupabaseAdmin();
    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || auth.source === 'cron_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin' || auth.profile?.is_admin === true;

    // Buscar pedido
    const { data: order, error: fetchErr } = await adminSupabase
      .from('orders')
      .select('id, buyer_id, driver_id, status, pricing_snapshot')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    // Apenas o cliente comprador ou admin pode avaliar o motoboy do pedido
    if (!isAdmin && callerId && order.buyer_id && order.buyer_id !== callerId) {
      return NextResponse.json({ error: 'Apenas o cliente comprador pode avaliar a entrega deste pedido.' }, { status: 403 });
    }

    // Atualizar pricing_snapshot com a avaliação do motoboy
    const currentSnapshot = (order.pricing_snapshot && typeof order.pricing_snapshot === 'object') ? order.pricing_snapshot : {};
    const driverRatingPayload = {
      rating: cleanRating,
      comment: cleanComment,
      ratedAt: new Date().toISOString(),
      ratedBy: callerId || 'cliente'
    };

    const updatedSnapshot = {
      ...currentSnapshot,
      driverRating: driverRatingPayload
    };

    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({ pricing_snapshot: updatedSnapshot })
      .eq('id', orderId);

    if (updateErr) {
      console.error('Erro ao salvar avaliação do motoboy:', updateErr);
      return NextResponse.json({ error: 'Erro ao salvar avaliação no banco de dados.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId,
      rating: cleanRating,
      driverRating: driverRatingPayload
    });
  } catch (err: any) {
    console.error('Exceção ao avaliar motoboy:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno ao processar avaliação.' }, { status: 500 });
  }
}
