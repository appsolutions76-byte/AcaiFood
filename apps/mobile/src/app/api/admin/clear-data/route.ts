import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do Supabase ausente no servidor' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Limpa todos os pedidos da tabela orders
    const { error } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error("Erro ao apagar pedidos via API de Admin:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Todos os pedidos foram excluídos do banco de dados com sucesso' });
  } catch (err: any) {
    console.error("Exceção em /api/admin/clear-data:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
