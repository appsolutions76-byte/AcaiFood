import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export const dynamic = 'force-dynamic';

// Disponibilidade mensal medida por monitor externo (cl. 11 do contrato BaaS).
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { data, error } = await getSupabaseAdmin()
    .from('monthly_sla')
    .select('month, uptime_percent, source, created_at')
    .order('month', { ascending: false })
    .limit(24);

  if (error) return NextResponse.json({ error: 'Erro ao carregar SLA' }, { status: 500 });
  return NextResponse.json({ success: true, rows: data || [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const body = await request.json().catch(() => ({}));
  const month = String(body?.month || '');
  const uptime = Number(body?.uptimePercent);
  const source = String(body?.source || '').trim().slice(0, 120);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'Mês no formato AAAA-MM' }, { status: 400 });
  }
  if (!Number.isFinite(uptime) || uptime < 0 || uptime > 100) {
    return NextResponse.json({ error: 'Disponibilidade entre 0 e 100' }, { status: 400 });
  }
  if (!source) {
    return NextResponse.json({ error: 'Informe a fonte da medição (ex.: UptimeRobot)' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from('monthly_sla').select('*').eq('month', month).maybeSingle();
  const { error } = await supabase
    .from('monthly_sla')
    .upsert({ month, uptime_percent: uptime, source }, { onConflict: 'month' });

  if (error) return NextResponse.json({ error: 'Erro ao salvar SLA' }, { status: 500 });

  await logAdminAction({
    actorId: auth.user?.id || auth.profile?.id || null,
    action: 'MONTHLY_SLA_SET',
    targetType: 'MONTHLY_SLA',
    targetId: month,
    beforeState: before || null,
    afterState: { month, uptime_percent: uptime, source },
    request
  });

  return NextResponse.json({ success: true });
}
