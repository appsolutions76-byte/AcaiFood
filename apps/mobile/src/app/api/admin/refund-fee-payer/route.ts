import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';
import { getRefundFeePayer } from '@/lib/sellerRefund';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

// Quem paga a tarifa Pix perdida no estorno (o Asaas não devolve a tarifa): PLATFORM ou SELLER.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  return NextResponse.json({ success: true, payer: await getRefundFeePayer() });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const payer = String(body?.payer || '').toUpperCase();
  if (payer !== 'PLATFORM' && payer !== 'SELLER') {
    return NextResponse.json({ error: 'Valor inválido (use PLATFORM ou SELLER).' }, { status: 400 });
  }

  const before = await getPlatformConfig<{ payer?: string }>('refund_fee_payer');
  const saved = await setPlatformConfig('refund_fee_payer', { payer });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: 'REFUND_FEE_PAYER_CHANGED',
    targetType: 'PLATFORM_CONFIG',
    targetId: 'refund_fee_payer',
    beforeState: { payer: before?.payer || 'PLATFORM' },
    afterState: { payer },
    request
  });

  return NextResponse.json({ success: true, payer });
}
