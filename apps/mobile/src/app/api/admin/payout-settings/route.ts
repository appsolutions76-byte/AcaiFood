import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function authorizeAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const adminSupabase = getSupabaseAdmin();
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: dbUser } = await adminSupabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!dbUser || String(dbUser.role).toUpperCase() !== 'ADMIN') {
    return null;
  }

  return dbUser;
}

export async function GET(request: Request) {
  try {
    const admin = await authorizeAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: settings } = await adminSupabase
      .from('platform_settings')
      .select('auto_payout_enabled, auto_payout_time, auto_payout_timezone, min_withdrawal_value, last_auto_payout_run_at')
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      settings: {
        auto_payout_enabled: settings?.auto_payout_enabled ?? false,
        auto_payout_time: (settings?.auto_payout_time || '18:00').substring(0, 5),
        auto_payout_timezone: settings?.auto_payout_timezone || 'America/Belem',
        min_withdrawal_value: Number(settings?.min_withdrawal_value ?? 20.00),
        last_auto_payout_run_at: settings?.last_auto_payout_run_at || null
      }
    });
  } catch (err: any) {
    console.error('[API /api/admin/payout-settings GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar configurações.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await authorizeAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const { auto_payout_enabled, auto_payout_time, min_withdrawal_value } = body;

    const updates: any = {};
    if (typeof auto_payout_enabled === 'boolean') {
      updates.auto_payout_enabled = auto_payout_enabled;
    }

    if (auto_payout_time && typeof auto_payout_time === 'string') {
      const cleanTime = auto_payout_time.trim();
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(cleanTime)) {
        return NextResponse.json({ error: 'Horário de pagamento automático inválido. Use o formato HH:MM (ex: 18:00).' }, { status: 400 });
      }
      updates.auto_payout_time = cleanTime;
    }

    if (min_withdrawal_value !== undefined && min_withdrawal_value !== null) {
      const numVal = Number(min_withdrawal_value);
      if (isNaN(numVal) || numVal <= 0) {
        return NextResponse.json({ error: 'O valor mínimo de saque deve ser um número positivo (ex: 20.00).' }, { status: 400 });
      }
      updates.min_withdrawal_value = numVal;
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: firstRow } = await adminSupabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (firstRow?.id) {
      await adminSupabase.from('platform_settings').update(updates).eq('id', firstRow.id);
    } else {
      await adminSupabase.from('platform_settings').insert(updates);
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações de pagamento automático atualizadas com sucesso!',
      updates
    });
  } catch (err: any) {
    console.error('[API /api/admin/payout-settings POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao salvar configurações.' }, { status: 500 });
  }
}
