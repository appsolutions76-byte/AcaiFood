import { createClient } from '@supabase/supabase-js';

export function isAuthorizedRequest(request: Request): boolean {
  // Segredo interno — lido APENAS de env do servidor (nunca NEXT_PUBLIC_ em produção)
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || '';
  const webhookSecret = process.env.WEBHOOK_SECRET || 'acaifood_webhook_2026';

  const headerToken = request.headers.get('x-internal-secret');
  if (headerToken && internalSecret && headerToken === internalSecret) return true;

  const asaasHeaderToken = request.headers.get('asaas-access-token');
  if (asaasHeaderToken && asaasHeaderToken === webhookSecret) return true;

  // Verificar cron jobs da Vercel
  const cronSecret = process.env.CRON_SECRET || '';
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader === '1' && cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) return true;

  try {
    const url = new URL(request.url);
    const whToken = url.searchParams.get('wh_token');
    if (whToken && whToken === webhookSecret) return true;
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

  // 3. Validação via header x-user-id e perfil no banco
  const headerUserId = request.headers.get('x-user-id');
  const headerUserRole = request.headers.get('x-user-role');
  if (headerUserId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', headerUserId)
          .maybeSingle();

        if (profile) {
          const userRole = String(
            profile.role === 'PARTNER' ? 'loja' :
            profile.role === 'SUPPLIER' ? 'fornecedor' :
            profile.role === 'COURIER' ? 'motorista' :
            profile.role === 'ADMIN' ? 'admin' : 'cliente'
          ).toLowerCase();

          if (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(userRole as any)) {
            return {
              authorized: true,
              source: 'user_jwt',
              profile
            };
          }
        }
      } catch (_e) {}
    }
  }

  // 4. Se a ação for especificamente do painel admin autenticado
  if (headerUserRole === 'admin' && (allowedRoles?.includes('admin') || !allowedRoles || allowedRoles.length === 0)) {
    return { authorized: true, source: 'internal_secret' };
  }

  return { authorized: false, error: 'Não autorizado' };
}

export function unauthorizedResponse(message?: string) {
  return new Response(
    JSON.stringify({ error: message || 'Não autorizado' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Valida se a requisição é um webhook legítimo do Asaas.
 * SEMPRE verifica o token, independente do conteúdo do body.
 */
export function isValidAsaasWebhook(request: Request): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET || 'acaifood_webhook_2026';
  
  // Verificar header asaas-access-token (método oficial do Asaas)
  const asaasToken = request.headers.get('asaas-access-token');
  if (asaasToken && asaasToken === webhookSecret) return true;

  // Verificar query param wh_token
  try {
    const url = new URL(request.url);
    const whToken = url.searchParams.get('wh_token');
    if (whToken && whToken === webhookSecret) return true;
  } catch (_e) {}

  // Verificar x-internal-secret como fallback para chamadas internas do servidor
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || '';
  const internalToken = request.headers.get('x-internal-secret');
  if (internalToken && internalSecret && internalToken === internalSecret) return true;

  return false;
}
