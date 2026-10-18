import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest } from '@/lib/apiAuth';
import { executeSubaccountPixPayout } from '@/lib/withdrawalApproval';
import { reconcilePartnerWithdrawals } from '@/lib/partnerBalance';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdmin();

    // 1. Executar reconciliação geral
    await reconcilePartnerWithdrawals();

    // 2. Buscar todas as solicitações com status PROCESSING
    const { data: processingRows, error: pErr } = await adminSupabase
      .from('withdrawal_requests')
      .select('id, partner_id, requested_amount, asaas_transfer_id, created_at')
      .eq('status', 'PROCESSING')
      .order('created_at', { ascending: true });

    if (pErr) {
      return NextResponse.json({ error: 'Erro ao buscar solicitações em processamento.' }, { status: 500 });
    }

    const results = [];
    if (processingRows && processingRows.length > 0) {
      for (const req of processingRows) {
        try {
          const res = await executeSubaccountPixPayout(req.id);
          results.push({
            id: req.id,
            partner_id: req.partner_id,
            requested_amount: req.requested_amount,
            result: res
          });
        } catch (err: any) {
          results.push({
            id: req.id,
            partner_id: req.partner_id,
            error: err?.message || 'Falha ao processar'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results
    });
  } catch (err: any) {
    console.error('[API /api/admin/withdrawals/reconcile POST] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao reconciliar saques.' }, { status: 500 });
  }
}
