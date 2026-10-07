import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Lista completa de usuários para o painel admin (exige admin com MFA).
// Desde a migration 20261006030000 o navegador não lê colunas sensíveis de users.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*, storefronts(*, products(*))')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar usuários' }, { status: 500 });
  }

  const users = (data || []).map((u: any) => {
    const { asaas_account_api_key: _secret, ...rest } = u;
    return rest;
  });

  return NextResponse.json({ success: true, users });
}
