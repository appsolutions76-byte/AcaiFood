import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const whToken = searchParams.get('wh_token') || request.headers.get('asaas-access-token');

    // Validar token de webhook se configurado
    const expectedToken = process.env.ASAAS_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_ASAAS_WEBHOOK_SECRET;
    if (expectedToken && whToken !== expectedToken) {
      console.warn('[Asaas Account Webhook] Token de webhook inválido recebido.');
      return NextResponse.json({ error: 'Token de webhook não autorizado' }, { status: 401 });
    }

    const eventData = await request.json();
    const event = String(eventData.event || '').toUpperCase();
    const account = eventData.account || eventData.subAccount || {};
    const accountId = account.id || eventData.account_id || eventData.id;

    console.log(`[Asaas Account Webhook] Evento: ${event} | AccountId: ${accountId || 'não informado'}`);

    if (!accountId) {
      return NextResponse.json({ success: true, message: 'Evento sem accountId processado (no-op)' });
    }

    const supabase = getSupabaseAdmin();

    // Achar parceiro pela subconta
    const { data: user } = await supabase
      .from('users')
      .select('id, name, role, asaas_account_status')
      .eq('asaas_account_id', accountId)
      .maybeSingle();

    if (!user) {
      console.warn(`[Asaas Account Webhook] Nenhuma conta de usuário associada ao asaas_account_id: ${accountId}`);
      return NextResponse.json({ success: true, message: 'Conta de usuário não encontrada' });
    }

    let newStatus: string | null = null;

    if (event.includes('APPROVED')) {
      newStatus = 'APPROVED';
    } else if (event.includes('REJECTED')) {
      newStatus = 'REJECTED';
    } else if (event.includes('PENDING') || event.includes('AWAITING')) {
      newStatus = 'AWAITING_APPROVAL';
    }

    if (newStatus) {
      const isApproved = newStatus === 'APPROVED';
      await supabase
        .from('users')
        .update({
          asaas_account_status: newStatus,
          split_enabled: isApproved
        })
        .eq('id', user.id);

      // Registrar evento de log
      await supabase.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'ASAAS_ACCOUNT_STATUS_CHANGE',
        target_type: 'USER',
        target_id: user.id,
        before_state: { status: user.asaas_account_status },
        after_state: { status: newStatus, split_enabled: isApproved, event }
      });
    }

    return NextResponse.json({ success: true, status: newStatus || 'UNCHANGED' });

  } catch (error: any) {
    console.error('[Asaas Account Webhook] Erro ao processar evento:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no webhook' }, { status: 500 });
  }
}
