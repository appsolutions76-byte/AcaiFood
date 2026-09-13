import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json({ error: 'Parâmetros inválidos: userId e status são obrigatórios.' }, { status: 400 });
    }

    const cleanStatus = status === 'paused' ? 'paused' : 'active';
    const isOnline = cleanStatus === 'active';

    const supabase = getSupabaseAdmin();

    // 1. Atualizar tabela users
    const { error: userError } = await supabase
      .from('users')
      .update({ 
        status: cleanStatus,
        is_online: isOnline,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) {
      console.error('[API /api/user/status] Erro ao atualizar usuário:', userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // 2. Atualizar storefronts se existir
    try {
      await supabase
        .from('storefronts')
        .update({
          is_active: isOnline,
          updated_at: new Date().toISOString()
        })
        .eq('partner_id', userId);
    } catch (_sfErr) {
      // storefronts opcional
    }

    return NextResponse.json({
      success: true,
      userId,
      status: cleanStatus,
      isOnline
    });
  } catch (err: any) {
    console.error('[API /api/user/status] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar status.' }, { status: 500 });
  }
}
