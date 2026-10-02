import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'ok';
  let dbLatency = 0;

  try {
    const supabase = getSupabaseAdmin();
    const dbStart = Date.now();
    const { error } = await supabase.from('platform_settings').select('id').limit(1);
    dbLatency = Date.now() - dbStart;
    if (error) {
      dbStatus = 'degraded';
    }
  } catch (_e) {
    dbStatus = 'unreachable';
  }

  const uptimeSeconds = process.uptime ? Math.floor(process.uptime()) : 0;
  const totalLatency = Date.now() - startTime;

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    service: 'AcaiFood Platform API',
    version: '2026.10.02',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    database: {
      status: dbStatus,
      latencyMs: dbLatency
    },
    latencyMs: totalLatency
  }, {
    status: dbStatus === 'ok' ? 200 : 503
  });
}
