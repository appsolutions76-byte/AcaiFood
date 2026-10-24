import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';
import { getPaymentModel, getRootWalletId } from '@/lib/paymentAccount';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

// Modelo de pagamento dos NOVOS pedidos (docs/25). Pedidos já cobrados seguem no modelo com que foram cobrados.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  const model = await getPaymentModel();
  const rootWalletId = await getRootWalletId();
  return NextResponse.json({ success: true, model, rootWalletReady: Boolean(rootWalletId) });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const model = String(body?.model || '').toUpperCase();
  if (model !== 'ROOT' && model !== 'SELLER_SPLIT') {
    return NextResponse.json({ error: 'Modelo inválido (use ROOT ou SELLER_SPLIT).' }, { status: 400 });
  }
  if (model === 'SELLER_SPLIT' && !(await getRootWalletId())) {
    return NextResponse.json({ error: 'Não foi possível obter a carteira (walletId) da conta raiz no Asaas.' }, { status: 409 });
  }

  const before = await getPlatformConfig<{ model?: string }>('payment_model');
  const saved = await setPlatformConfig('payment_model', { model });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: 'PAYMENT_MODEL_CHANGED',
    targetType: 'PLATFORM_CONFIG',
    targetId: 'payment_model',
    beforeState: { model: before?.model || 'ROOT' },
    afterState: { model },
    request
  });

  return NextResponse.json({ success: true, model });
}
