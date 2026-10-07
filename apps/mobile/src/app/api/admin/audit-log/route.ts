import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Leitura do log de ações de admin (Anexo I, 7). Somente leitura; a tabela é append-only.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const action = searchParams.get('action');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('admin_audit_log')
    .select('id, actor_id, action, target_type, target_id, before_state, after_state, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', `${from}T00:00:00.000Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', `${to}T23:59:59.999Z`);
  if (action) query = query.ilike('action', `%${action.replace(/[%_]/g, '')}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar o log de auditoria' }, { status: 500 });
  }

  // Nome de quem fez a ação
  const actorIds = Array.from(new Set((data || []).map((r: any) => r.actor_id).filter(Boolean)));
  const names: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from('users').select('id, name').in('id', actorIds);
    (actors || []).forEach((a: any) => { names[a.id] = a.name; });
  }

  return NextResponse.json({
    success: true,
    entries: (data || []).map((r: any) => ({ ...r, actor_name: r.actor_id ? (names[r.actor_id] || r.actor_id) : 'Sistema' }))
  });
}
