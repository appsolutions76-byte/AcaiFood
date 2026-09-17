import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorizedRequest, authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { processWithdrawalApproval } from '@/lib/withdrawalApproval';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Verificar autenticação: aceita admin JWT, internal-secret ou cron da Vercel
  const isInternalOrCron = isAuthorizedRequest(request);
  if (!isInternalOrCron) {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized) {
      console.warn("[API Sweep] Acesso negado:", auth.error);
      return unauthorizedResponse(auth.error);
    }
  }

  try {
    const adminSupabase = getSupabaseAdmin();

    // 1. Obter configurações de auto payout em platform_settings
    const { data: settings } = await adminSupabase
      .from('platform_settings')
      .select('auto_payout_enabled, auto_payout_time, auto_payout_timezone, last_auto_payout_run_at')
      .limit(1)
      .maybeSingle();

    const isEnabled = settings?.auto_payout_enabled === true;
    const targetTime = (settings?.auto_payout_time || '18:00').substring(0, 5);
    const timeZone = settings?.auto_payout_timezone || 'America/Belem';
    const lastRunAt = settings?.last_auto_payout_run_at ? new Date(settings.last_auto_payout_run_at) : null;

    if (!isEnabled) {
      console.log("[Sweep Payout] Pagamento automático está DESLIGADO no painel admin.");
      return NextResponse.json({
        success: true,
        autoPayoutEnabled: false,
        message: 'Pagamento automático desativado pelo administrador. Nenhuma solicitação foi processada.'
      });
    }

    // 2. Verificar data e horário no fuso horário configurado
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const dateMap: Record<string, string> = {};
    parts.forEach(p => { dateMap[p.type] = p.value; });

    const todayStr = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;
    const currentHHMM = `${dateMap.hour}:${dateMap.minute}`;

    // Verificar se já rodou hoje no mesmo fuso
    if (lastRunAt) {
      const lastParts = formatter.formatToParts(lastRunAt);
      const lastDateMap: Record<string, string> = {};
      lastParts.forEach(p => { lastDateMap[p.type] = p.value; });
      const lastRunDateStr = `${lastDateMap.year}-${lastDateMap.month}-${lastDateMap.day}`;

      if (lastRunDateStr === todayStr) {
        console.log(`[Sweep Payout] Pagamento automático já foi executado hoje (${todayStr}).`);
        return NextResponse.json({
          success: true,
          alreadyRunToday: true,
          message: `Pagamento automático já foi executado hoje (${todayStr}).`
        });
      }
    }

    // 3. Buscar solicitações de saque PENDENTES
    const { data: pendingRequests } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, requested_amount, partner_id')
      .eq('status', 'PENDENTE')
      .order('created_at', { ascending: true });

    if (!pendingRequests || pendingRequests.length === 0) {
      console.log("[Sweep Payout] Nenhuma solicitação PENDENTE encontrada para processar.");
      return NextResponse.json({
        success: true,
        pendingCount: 0,
        message: 'Nenhuma solicitação de saque pendente encontrada para pagamento automático.'
      });
    }

    console.log(`⏰ [Sweep Payout] Iniciando pagamento automático de ${pendingRequests.length} solicitações pendentes...`);

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const req of pendingRequests) {
      try {
        const res = await processWithdrawalApproval(req.id, null); // actorId = null -> processed_automatically
        results.push({ requestId: req.id, ...res });
        if (res.success) successCount++;
        else failCount++;
      } catch (procErr: any) {
        results.push({ requestId: req.id, success: false, error: procErr.message });
        failCount++;
      }
    }

    // 4. Registrar horário da última execução em platform_settings
    const nowIso = new Date().toISOString();
    const { data: firstRow } = await adminSupabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (firstRow?.id) {
      await adminSupabase.from('platform_settings').update({ last_auto_payout_run_at: nowIso }).eq('id', firstRow.id);
    }

    console.log(`✅ [Sweep Payout] Varredura concluída: ${successCount} pagas com sucesso, ${failCount} falhas.`);

    return NextResponse.json({
      success: true,
      autoPayoutEnabled: true,
      executedAt: nowIso,
      totalPending: pendingRequests.length,
      successCount,
      failCount,
      results
    });

  } catch (err: any) {
    console.error("Exceção na varredura de pagamento automático:", err);
    return NextResponse.json({ error: err.message || 'Erro interno ao executar varredura.' }, { status: 500 });
  }
}
