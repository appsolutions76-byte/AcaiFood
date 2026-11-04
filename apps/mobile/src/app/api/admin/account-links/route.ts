import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * R47 — Admin: vínculos de contas à mesma subconta (mesmo CPF/CNPJ) e registro das
 * requisições enviadas ao Asaas (para copiar e mandar ao suporte do Asaas).
 * As ações (aprovar, recusar, desfazer, liberar saque) usam POST /api/asaas/account-links.
 */
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const sb = getSupabaseAdmin();
  const { data: links, error: lErr } = await sb
    .from('payment_account_links')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(200);
  const { data: logs, error: gErr } = await sb
    .from('asaas_request_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const ids = Array.from(new Set([
    ...(links || []).flatMap((l: any) => [l.owner_user_id, l.linked_user_id]),
    ...(logs || []).map((g: any) => g.user_id).filter(Boolean),
  ]));
  const names: Record<string, { name: string; email: string; role: string }> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('users').select('id, name, email, role, storefronts(store_name)').in('id', ids.slice(i, i + 200));
    (data || []).forEach((u: any) => {
      const sf = Array.isArray(u.storefronts) ? u.storefronts[0] : u.storefronts;
      names[u.id] = { name: sf?.store_name || u.name || '', email: u.email || '', role: u.role || '' };
    });
  }

  return NextResponse.json({
    success: true,
    migrationApplied: !lErr && !gErr,
    links: (links || []).map((l: any) => ({ ...l, owner: names[l.owner_user_id] || null, linked: names[l.linked_user_id] || null })),
    logs: (logs || []).map((g: any) => ({ ...g, user: g.user_id ? names[g.user_id] || null : null })),
  });
}
