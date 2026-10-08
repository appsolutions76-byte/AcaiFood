import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { loadSubaccountUser, closeSubaccountInAsaas, unlinkSubaccount } from '@/lib/asaasSubaccountClose';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório para exclusão' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const actorId = auth.user?.id || auth.profile?.id || null;

    if (actorId && userId === actorId) {
      return NextResponse.json({ error: 'Você não pode excluir a própria conta de administrador.' }, { status: 400 });
    }

    const { data: before } = await supabase
      .from('users')
      .select('id, name, role, status, asaas_account_status, created_at')
      .eq('id', userId)
      .maybeSingle();

    // Registros financeiros devem ser guardados (contrato BaaS e lei). Com pedidos pagos
    // ou saques, a conta deve ser bloqueada, não apagada — salvo liberação explícita.
    if (process.env.ALLOW_DESTRUCTIVE_ADMIN_RESET !== 'true') {
      const { count: paidOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .or(`buyer_id.eq.${userId},driver_id.eq.${userId}`)
        .not('paid_at', 'is', null);
      const { data: ownStorefronts } = await supabase
        .from('storefronts')
        .select('id')
        .eq('partner_id', userId);
      let sellerPaidOrders = 0;
      const sfIdsForCheck = (ownStorefronts || []).map((s: any) => s.id);
      if (sfIdsForCheck.length > 0) {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('seller_storefront_id', sfIdsForCheck)
          .not('paid_at', 'is', null);
        sellerPaidOrders = count || 0;
      }
      const { count: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', userId);
      if ((paidOrders || 0) > 0 || sellerPaidOrders > 0 || (withdrawals || 0) > 0) {
        await logAdminAction({
          actorId,
          action: 'USER_DELETE_BLOCKED',
          targetType: 'USER',
          targetId: String(userId),
          beforeState: before || null,
          afterState: { paidOrders: paidOrders || 0, sellerPaidOrders, withdrawals: withdrawals || 0 },
          request
        });
        return NextResponse.json({
          error: 'Este usuário tem pedidos pagos ou saques. Bloqueie a conta em vez de excluir (os registros financeiros precisam ser guardados).'
        }, { status: 409 });
      }
    }

    // Subconta Asaas: precisa ser encerrada no Asaas antes de apagar o usuário,
    // senão a conta fica aberta no Asaas sem dono no app.
    const subUser = await loadSubaccountUser(String(userId));
    if (subUser?.asaas_account_id) {
      const closed = await closeSubaccountInAsaas(subUser, 'Exclusão de usuário pelo administrador AçaíFood');
      if (!closed.ok) {
        await logAdminAction({
          actorId, action: 'USER_DELETE_BLOCKED', targetType: 'USER', targetId: String(userId),
          beforeState: before || null, afterState: { motivo: 'subconta Asaas não encerrada', error: closed.error }, request
        });
        return NextResponse.json({
          error: `A subconta Asaas deste usuário não foi encerrada: ${closed.error} Depois de encerrada, use "Desvincular" na aba Conformidade e tente excluir de novo.`
        }, { status: 409 });
      }
      await unlinkSubaccount(subUser);
      await logAdminAction({
        actorId, action: 'ASAAS_SUBACCOUNT_CLOSED', targetType: 'USER', targetId: String(userId),
        beforeState: { accountId: subUser.asaas_account_id }, afterState: { mode: closed.mode, motivo: 'exclusão de usuário' }, request
      });
    }

    // 0. Deletar logs e registros associados onde user_id tem FK
    try { await supabase.from('incident_logs').delete().eq('user_id', userId); } catch (_) {}
    try { await supabase.from('support_messages').delete().eq('user_id', userId); } catch (_) {}
    try { await supabase.from('disputes').delete().or(`opened_by.eq.${userId},resolved_by.eq.${userId}`); } catch (_) {}
    try { await supabase.from('notification_queue').delete().eq('recipient_id', userId); } catch (_) {}
    try { await supabase.from('pin_attempt_log').delete().eq('actor_id', userId); } catch (_) {}
    try { await supabase.from('order_status_history').delete().eq('actor_id', userId); } catch (_) {}
    try { await supabase.from('splits').delete().eq('recipient_id', userId); } catch (_) {}

    // 1. Obter e limpar pedidos vinculados ao usuário (comprador, motorista ou cancelador)
    try {
      const { data: userOrders } = await supabase
        .from('orders')
        .select('id')
        .or(`buyer_id.eq.${userId},driver_id.eq.${userId},cancelled_by.eq.${userId}`);

      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map(o => o.id);
        for (const oid of orderIds) {
          try { await supabase.from('order_items').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('order_messages').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('order_tracking').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('order_status_history').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('print_log').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('splits').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('pin_attempt_log').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('disputes').delete().eq('order_id', oid); } catch (_) {}
          try { await supabase.from('incident_logs').delete().eq('order_id', oid); } catch (_) {}
        }
        await supabase.from('orders').delete().in('id', orderIds);
      }
    } catch (orderErr) {
      console.warn("Aviso ao limpar pedidos do usuário:", orderErr);
    }

    // 2. Deletar anúncios comerciais criados pelo parceiro
    try { await supabase.from('commercial_ads').delete().eq('partner_id', userId); } catch (_) {}

    // 3. Deletar vitrines e seus produtos associados
    try {
      const { data: userStorefronts } = await supabase
        .from('storefronts')
        .select('id')
        .eq('partner_id', userId);

      if (userStorefronts && userStorefronts.length > 0) {
        const sfIds = userStorefronts.map(s => s.id);
        for (const sfId of sfIds) {
          try { await supabase.from('products').delete().eq('storefront_id', sfId); } catch (_) {}
        }
        await supabase.from('storefronts').delete().in('id', sfIds);
      }
    } catch (sfErr) {
      console.warn("Aviso ao limpar vitrines do usuário:", sfErr);
    }

    // 4. Deletar da tabela users com Service Role
    const { error } = await supabase.from('users').delete().eq('id', userId);

    if (error) {
      console.error("Erro ao excluir usuário via API:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. Tentar excluir do Supabase Auth se existir
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (authDeleteErr) {
      console.warn("Aviso ao deletar usuário do Supabase Auth:", authDeleteErr);
    }

    await logAdminAction({
      actorId,
      action: 'USER_DELETED',
      targetType: 'USER',
      targetId: String(userId),
      beforeState: before || null,
      afterState: { deleted: true },
      request
    });

    return NextResponse.json({ success: true, message: 'Usuário e todos os dados associados foram excluídos com sucesso' });
  } catch (err: any) {
    console.error("Exceção em /api/admin/delete-user:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
