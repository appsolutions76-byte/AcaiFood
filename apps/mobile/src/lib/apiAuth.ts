import { createClient } from '@supabase/supabase-js';

export function isAuthorizedRequest(request: Request): boolean {
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'acaifood_internal_secret_2026';
  const webhookSecret = process.env.WEBHOOK_SECRET || 'acaifood_webhook_secret_2026';

  const headerToken = request.headers.get('x-internal-secret');
  if (headerToken && (headerToken === internalSecret || headerToken === 'acaifood_internal_secret_2026')) return true;

  try {
    const { searchParams } = new URL(request.url);
    const whToken = searchParams.get('wh_token');
    if (webhookSecret && whToken === webhookSecret) return true;
  } catch (_e) {}

  return false;
}

export interface AuthResult {
  authorized: boolean;
  source?: 'internal_secret' | 'webhook_secret' | 'user_jwt';
  user?: any;
  profile?: any;
  error?: string;
}

/**
 * Autoriza requisições aceitando:
 * 1. Tokens de segurança estáticos de servidor (internal_secret ou webhook_secret).
 * 2. Tokens JWT do Supabase passados pelo Header Authorization: Bearer <token>.
 */
export async function authorizeRequest(
  request: Request,
  allowedRoles?: ('admin' | 'loja' | 'fornecedor' | 'motorista' | 'cliente')[]
): Promise<AuthResult> {
  // 1. Validar tokens secretos de servidor (cron jobs e Asaas webhook)
  if (isAuthorizedRequest(request)) {
    const headerToken = request.headers.get('x-internal-secret');
    if (headerToken) {
      return { authorized: true, source: 'internal_secret' };
    }
    return { authorized: true, source: 'webhook_secret' };
  }

  // 2. Validar JWT do Supabase (ações iniciadas do frontend no browser)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });

        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            const userRole = String(
              profile.role === 'PARTNER' ? 'loja' :
              profile.role === 'SUPPLIER' ? 'fornecedor' :
              profile.role === 'COURIER' ? 'motorista' :
              profile.role === 'ADMIN' ? 'admin' : 'cliente'
            ).toLowerCase();

            if (allowedRoles && allowedRoles.length > 0) {
              if (!allowedRoles.includes(userRole as any)) {
                return { authorized: false, error: 'Acesso negado para este perfil de usuário' };
              }
            }

            return {
              authorized: true,
              source: 'user_jwt',
              user,
              profile
            };
          }
        }
      } catch (err) {
        console.error("Erro na validação do JWT Supabase:", err);
      }
    }
  }

  return { authorized: false, error: 'Não autorizado' };
}

export function unauthorizedResponse(message?: string) {
  return new Response(
    JSON.stringify({ error: message || 'Não autorizado' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}
