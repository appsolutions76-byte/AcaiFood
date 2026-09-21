import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized || !auth.user?.id) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { latitude, longitude, lat, lng } = body;

    const finalLat = Number(latitude ?? lat);
    const finalLng = Number(longitude ?? lng);

    if (isNaN(finalLat) || isNaN(finalLng)) {
      return NextResponse.json({ error: 'Latitude e Longitude são obrigatórias' }, { status: 400 });
    }

    const userId = auth.user.id;
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('users')
      .update({ latitude: finalLat, longitude: finalLng })
      .eq('id', userId);

    if (error) {
      console.error("Erro ao atualizar localização GPS via Service Role:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      latitude: finalLat,
      longitude: finalLng
    });
  } catch (err: any) {
    console.error("Exceção na API /api/user/location:", err);
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar localização' }, { status: 500 });
  }
}
