import { createClient } from '@supabase/supabase-js';

export function isAuthorizedRequest(request: Request): boolean {
  // Segredo interno — lido APENAS de env do servidor (nunca exposto no client)
  const internalSecret = process.env.INTERNAL_API_SECRET || '';

  const headerToken = request.headers.get('x-internal-secret');
  if (headerToken && internalSecret && headerToken === internalSecret) return true;

  // Verificar cron jobs da Vercel
  const cronSecret = process.env.CRON_SECRET || '';
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader === '1' && cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) return true;

  return false;
}

export interface AuthResult {
  authorized: boolean;
  source?: 'internal_secret' | 'cron_secret' | 'user_jwt';
  user?: any;
  profile?: any;
  error?: string;
}

/**
 * Autoriza requisições aceitando:
 * 1. Tokens de segurança estáticos de servidor (internal_secret ou cron_secret).
 * 2. Tokens JWT do Supabase passados pelo Header Authorization: Bearer <token>.
 */
export async function authorizeRequest(
  request: Request,
  allowedRoles?: ('admin' | 'loja' | 'fornecedor' | 'motorista' | 'cliente')[]
): Promise<AuthResult> {
  // 1. Validar tokens secretos de servidor (cron jobs e chamadas internas)
  const internalSecret = process.env.INTERNAL_API_SECRET || '';
  const headerToken = request.headers.get('x-internal-secret');
  if (headerToken && internalSecret && headerToken === internalSecret) {
    return { authorized: true, source: 'internal_secret' };
  }

  const cronSecret = process.env.CRON_SECRET || '';
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader === '1' && cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return { authorized: true, source: 'cron_secret' };
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
            const rawRole = String(profile.role || '').toLowerCase();
            const userRole = 
              (rawRole === 'admin' || rawRole === 'administrador') ? 'admin' :
              (rawRole === 'partner' || rawRole === 'loja' || rawRole === 'batedeira') ? 'loja' :
              (rawRole === 'supplier' || rawRole === 'fornecedor') ? 'fornecedor' :
              (rawRole === 'courier' || rawRole === 'motorista' || rawRole === 'motoboy' || rawRole === 'caminhao' || rawRole === 'driver') ? 'motorista' :
              'cliente';

            if (allowedRoles && allowedRoles.length > 0) {
              const isAdminAuth = allowedRoles.includes('admin') && (
                userRole === 'admin' || 
                profile.is_admin === true || 
                user.user_metadata?.role === 'admin'
              );

              if (!allowedRoles.includes(userRole as any) && !isAdminAuth) {
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

  // 3. Se não houver segredo interno válido nem JWT assinado pelo Supabase, rejeita a requisição
  return { authorized: false, error: 'Não autorizado: credenciais de acesso inválidas ou sessão expirada' };
}

export function unauthorizedResponse(message?: string) {
  return new Response(
    JSON.stringify({ error: message || 'Não autorizado' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Valida se a requisição é um webhook legítimo do Asaas.
 * Verifica o token configurado no ambiente de produção.
 */
export function isValidAsaasWebhook(request: Request): boolean {
  const allowedTokens = new Set([
    process.env.ASAAS_WEBHOOK_TOKEN,
    process.env.ASAAS_WEBHOOK_TOKEN_PREVIOUS,
    process.env.WEBHOOK_SECRET
  ].filter(Boolean) as string[]);

  if (allowedTokens.size === 0) {
    console.warn("⚠️ [Webhook Asaas] Nenhum ASAAS_WEBHOOK_TOKEN configurado no servidor.");
    return false;
  }

  // Verificar header asaas-access-token ou access_token (método oficial do Asaas)
  const asaasToken = request.headers.get('asaas-access-token') || request.headers.get('access_token');
  if (asaasToken && allowedTokens.has(asaasToken.trim())) {
    return true;
  }

  return false;
}

