/**
 * apiAuth.ts — Helper para autenticação interna das rotas privadas do AçaíFood
 * 
 * Protege as rotas /api/asaas/transfer, /api/asaas/refund e POST /api/asaas/status
 * contra chamadas não autorizadas externas.
 */

/**
 * Verifica se a requisição contém o token interno válido.
 * Aceita o token via header 'x-internal-secret' (chamadas internas do app)
 * ou via query param 'wh_token' (Webhooks do Asaas).
 */
export function isAuthorizedRequest(request: Request): boolean {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Se nenhum segredo estiver configurado, permite (backward compat com env não configurado)
  if (!internalSecret && !webhookSecret) return true;

  // Verifica header de token interno (chamadas do próprio app)
  const headerToken = request.headers.get('x-internal-secret');
  if (internalSecret && headerToken === internalSecret) return true;

  // Verifica query param para Webhooks do Asaas
  try {
    const { searchParams } = new URL(request.url);
    const whToken = searchParams.get('wh_token');
    if (webhookSecret && whToken === webhookSecret) return true;
  } catch (_e) {}

  return false;
}

export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Não autorizado' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}
