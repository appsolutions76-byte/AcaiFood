import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';
import { getRootCtx } from '@/lib/paymentAccount';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

// Saldo da conta raiz (plataforma) no Asaas e o mínimo para alerta.
// A conta raiz precisa de saldo para devolver comissões e tarifas nos estornos e para as taxas do Asaas.
const DEFAULT_MIN = 50;

async function getMin(): Promise<number> {
  const cfg = await getPlatformConfig<{ min?: number }>('root_balance_alert');
  const v = Number(cfg?.min);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MIN;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const min = await getMin();
  const root = await getRootCtx();
  if (!root) return NextResponse.json({ success: false, error: 'Chave da conta raiz não configurada', min }, { status: 200 });

  try {
    const res = await fetch(`${root.baseUrl}/finance/balance`, {
      headers: { access_token: root.apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({}));
    const balance = Number(data?.balance);
    if (!res.ok || !Number.isFinite(balance)) {
      return NextResponse.json({ success: false, error: 'Não foi possível consultar o saldo no Asaas', min });
    }
    return NextResponse.json({ success: true, balance, min, below: balance < min, negative: balance < 0 });
  } catch (_e) {
    return NextResponse.json({ success: false, error: 'Falha de rede ao consultar o Asaas', min });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const min = Math.round(Number(body?.min) * 100) / 100;
  if (!Number.isFinite(min) || min < 0 || min > 100000) {
    return NextResponse.json({ error: 'Valor mínimo inválido (0 a 100.000).' }, { status: 400 });
  }
  const before = await getMin();
  const saved = await setPlatformConfig('root_balance_alert', { min });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: 'ROOT_BALANCE_ALERT_CHANGED',
    targetType: 'PLATFORM_CONFIG',
    targetId: 'root_balance_alert',
    beforeState: { min: before },
    afterState: { min },
    request
  });
  return NextResponse.json({ success: true, min });
}
