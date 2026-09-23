import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ['admin']);
    if (!auth.authorized || !auth.profile) {
      return NextResponse.json({ error: auth.error || 'Acesso não autorizado. Apenas administradores podem acessar.' }, { status: 403 });
    }

    const admin = auth.profile;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDENTE';

    const adminSupabase = getSupabaseAdmin();

    // Auto-reconciliar solicitações pendentes/falhas cujos pedidos já foram quitados
    try {
      const { data: openReqs } = await adminSupabase
        .from('withdrawal_requests')
        .select('id, partner_id, role, order_ids')
        .in('status', ['PENDENTE', 'FALHOU'])
        .limit(50);

      if (openReqs && openReqs.length > 0) {
        for (const r of openReqs) {
          if (Array.isArray(r.order_ids) && r.order_ids.length > 0) {
            const isDriver = ['motorista', 'motoboy', 'caminhao', 'courier', 'driver'].includes(String(r.role || '').toLowerCase());
            const { data: ords } = await adminSupabase
              .from('orders')
              .select('id, payout_seller_done, payout_driver_done')
              .in('id', r.order_ids);

            if (ords && ords.length > 0 && ords.every((o: any) => isDriver ? o.payout_driver_done : o.payout_seller_done)) {
              await adminSupabase
                .from('withdrawal_requests')
                .update({
                  status: 'PAGO',
                  failure_reason: null,
                  paid_at: new Date().toISOString()
                })
                .eq('id', r.id);
            }
          }
        }
      }
    } catch (recErr) {
      console.warn("Aviso ao auto-reconciliar no admin:", recErr);
    }

    let query = adminSupabase
      .from('withdrawal_requests')
      .select('*, partner:partner_id(id, name, email, phone, role, pix_key, cpf_cnpj, asaas_wallet_id)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Erro ao listar solicitações de saque:', error);
      return NextResponse.json({ error: 'Erro ao buscar solicitações no banco.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requests: requests || []
    });
  } catch (err: any) {
    console.error('[API /api/admin/withdrawals GET] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno ao listar saques.' }, { status: 500 });
  }
}
