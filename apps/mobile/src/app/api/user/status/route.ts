import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json({ error: 'Parâmetros inválidos: userId e status são obrigatórios.' }, { status: 400 });
    }

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || auth.source === 'cron_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin' || auth.profile?.is_admin === true;

    // Usuário comum só pode alterar o próprio status de disponibilidade
    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode alterar o status do seu próprio perfil.' }, { status: 403 });
    }

    // Apenas administrador pode definir status 'blocked'
    if (status === 'blocked' && !isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem bloquear usuários.' }, { status: 403 });
    }

    const cleanStatus = status === 'blocked' ? 'blocked' : (status === 'paused' ? 'paused' : 'active');
    const isOnline = cleanStatus === 'active';

    // 1. Atualizar com Supabase Admin (Service Role)
    let updated = false;
    const adminSupabase = getSupabaseAdmin();
    try {
      const { data, error } = await adminSupabase
        .from('users')
        .update({ 
          status: cleanStatus,
          is_online: isOnline
        })
        .eq('id', userId)
        .select();

      if (!error && data && data.length > 0) {
        updated = true;
      }
    } catch (_admErr) {}

    // 2. Atualizar storefronts (is_active e metadados logo_url)
    try {
      const { data: sfData } = await adminSupabase
        .from('storefronts')
        .select('id, logo_url')
        .eq('partner_id', userId);

      if (sfData && sfData.length > 0) {
        for (const sf of sfData) {
          let parsedMeta: any = {};
          try {
            if (sf.logo_url && sf.logo_url.startsWith('{')) parsedMeta = JSON.parse(sf.logo_url);
          } catch (_) {}
          const newLogoUrl = JSON.stringify({ ...parsedMeta, isOpen: isOnline });
          await adminSupabase
            .from('storefronts')
            .update({
              is_active: isOnline,
              logo_url: newLogoUrl
            })
            .eq('id', sf.id);
        }
      } else {
        await adminSupabase
          .from('storefronts')
          .update({
            is_active: isOnline
          })
          .eq('partner_id', userId);
      }
    } catch (_sf1) {}

    try {
      await adminSupabase
        .from('storefronts')
        .update({
          is_active: isOnline
        })
        .eq('id', userId);
    } catch (_sf2) {}

    return NextResponse.json({
      success: true,
      userId,
      status: cleanStatus,
      isOnline,
      updated
    });
  } catch (err: any) {
    console.error('[API /api/user/status] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar status.' }, { status: 500 });
  }
}
