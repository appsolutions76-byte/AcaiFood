import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

    // 1. Tentar com Supabase Admin (Service Role)
    let updated = false;
    const adminSupabase = getSupabaseAdmin();
    try {
      const { data, error } = await adminSupabase
        .from('users')
        .update({ 
          status: cleanStatus,
          is_online: isOnline,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select();

      if (!error && data && data.length > 0) {
        updated = true;
      }
    } catch (_admErr) {}

    // 2. Se não atualizou ou se o admin usou anon key com RLS, tentar com o Bearer JWT do usuário autenticado
    const authHeader = request.headers.get('Authorization');
    if (!updated && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseAnonKey && token) {
        try {
          const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false }
          });
          const { data: uData } = await userSupabase
            .from('users')
            .update({ 
              status: cleanStatus,
              is_online: isOnline,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select();

          if (uData && uData.length > 0) {
            updated = true;
          }
        } catch (_uErr) {}
      }
    }

    // 3. Atualizar storefronts (is_active e metadados logo_url)
    try {
      const { data: sfData } = await adminSupabase
        .from('storefronts')
        .select('id, logo_url')
        .eq('partner_id', userId);

      if (sfData && sfData.length > 0) {
        for (const sf of sfData) {
          let parsedMeta: any = {};
          try {
            if (sf.logo_url) parsedMeta = JSON.parse(sf.logo_url);
          } catch (_) {}
          const newLogoUrl = JSON.stringify({ ...parsedMeta, isOpen: isOnline });
          await adminSupabase
            .from('storefronts')
            .update({
              is_active: isOnline,
              logo_url: newLogoUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', sf.id);
        }
      } else {
        await adminSupabase
          .from('storefronts')
          .update({
            is_active: isOnline,
            updated_at: new Date().toISOString()
          })
          .eq('partner_id', userId);
      }
    } catch (_sf1) {}

    try {
      await adminSupabase
        .from('storefronts')
        .update({
          is_active: isOnline,
          updated_at: new Date().toISOString()
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
