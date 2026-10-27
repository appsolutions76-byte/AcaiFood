import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { setPlatformConfig } from '@/lib/platformConfig';
import { getTransferValidationConfig } from '@/lib/transferValidation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

// Painel da validação de saques (R32): modo, liberação temporária de saque manual e últimas validações.
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const cfg = await getTransferValidationConfig();
  let logs: any[] = [];
  let tableReady = true;
  const { data, error } = await getSupabaseAdmin()
    .from('transfer_validation_log')
    .select('id, created_at, operation_type, operation_id, value, external_reference, decision, kind, reason')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) tableReady = false;
  else logs = data || [];

  return NextResponse.json({ success: true, config: cfg, logs, tableReady });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const before = await getTransferValidationConfig();
  const next = { ...before };

  if (body?.mode !== undefined) {
    const mode = String(body.mode).toUpperCase();
    if (mode !== 'MONITOR' && mode !== 'ENFORCE') {
      return NextResponse.json({ error: 'Modo inválido (use MONITOR ou ENFORCE).' }, { status: 400 });
    }
    next.mode = mode as any;
  }
  if (body?.manualMinutes !== undefined) {
    const min = Number(body.manualMinutes);
    if (!Number.isFinite(min) || min < 0 || min > 120) {
      return NextResponse.json({ error: 'Informe de 0 a 120 minutos.' }, { status: 400 });
    }
    next.manualUntil = min > 0 ? new Date(Date.now() + min * 60000).toISOString() : null;
  }

  const saved = await setPlatformConfig('transfer_validation', next);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: 'TRANSFER_VALIDATION_CHANGED',
    targetType: 'PLATFORM_CONFIG',
    targetId: 'transfer_validation',
    beforeState: before,
    afterState: next,
    request
  });

  return NextResponse.json({ success: true, config: next });
}
