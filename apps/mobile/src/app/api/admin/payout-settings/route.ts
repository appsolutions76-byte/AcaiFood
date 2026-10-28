import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';
import { isInstantPayoutEnabled } from '@/lib/payoutHold';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const admin = auth.profile;

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
        last_auto_payout_run_at: settings?.last_auto_payout_run_at || null,
        instant_payout_enabled: await isInstantPayoutEnabled()
      }
    });
  } catch (err: any) {
    console.error('[API /api/admin/payout-settings GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar configurações.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Acesso não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const admin = auth.profile;

    const body = await request.json();
    const { auto_payout_enabled, auto_payout_time, min_withdrawal_value, instant_payout_enabled } = body;

    // R34: saque na hora (paga assim que o parceiro pede) fica em platform_config
    if (typeof instant_payout_enabled === 'boolean') {
      const before = await getPlatformConfig<{ enabled?: boolean }>('instant_payout');
      const saved = await setPlatformConfig('instant_payout', { enabled: instant_payout_enabled });
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
      await logAdminAction({
        actorId: admin.id,
        action: 'INSTANT_PAYOUT_CHANGED',
        targetType: 'PLATFORM_CONFIG',
        targetId: 'instant_payout',
        beforeState: { enabled: before?.enabled === true },
        afterState: { enabled: instant_payout_enabled },
        request
      });
      if (auto_payout_enabled === undefined && !auto_payout_time && (min_withdrawal_value === undefined || min_withdrawal_value === null)) {
        return NextResponse.json({
          success: true,
          message: instant_payout_enabled ? 'Saque na hora LIGADO: o Pix sai assim que o parceiro pedir.' : 'Saque na hora DESLIGADO: os saques aguardam aprovação (ou o horário).',
          updates: { instant_payout_enabled }
        });
      }
    }

    const updates: any = {};
    if (typeof auto_payout_enabled === 'boolean') {
      // R34: liberado pelo admin. O saque sai da subconta do próprio parceiro para a chave do CPF/CNPJ dele
      // (mandato aceito no cadastro); chave trocada fica bloqueada até o admin liberar.
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
      .select('id, auto_payout_enabled, auto_payout_time, min_withdrawal_value')
      .limit(1)
      .maybeSingle();

    if (firstRow?.id) {
      await adminSupabase.from('platform_settings').update(updates).eq('id', firstRow.id);
    } else {
      await adminSupabase.from('platform_settings').insert(updates);
    }

    await logAdminAction({
      actorId: admin.id,
      action: 'PAYOUT_SETTINGS_UPDATED',
      targetType: 'PLATFORM_SETTINGS',
      targetId: firstRow?.id ? String(firstRow.id) : undefined,
      beforeState: firstRow ? { auto_payout_enabled: (firstRow as any).auto_payout_enabled, auto_payout_time: (firstRow as any).auto_payout_time, min_withdrawal_value: (firstRow as any).min_withdrawal_value } : null,
      afterState: updates,
      request
    });

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
