import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório para exclusão' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do Supabase ausente no servidor' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Deletar pedidos associados ao usuário se houver
    await supabase.from('orders').delete().or(`buyer_id.eq.${userId},driver_id.eq.${userId}`);

    // 2. Deletar vitrines associadas
    await supabase.from('storefronts').delete().eq('partner_id', userId);

    // 3. Deletar da tabela users
    const { error } = await supabase.from('users').delete().eq('id', userId);

    if (error) {
      console.error("Erro ao excluir usuário via API:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Usuário e dados excluídos com sucesso' });
  } catch (err: any) {
    console.error("Exceção em /api/admin/delete-user:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
