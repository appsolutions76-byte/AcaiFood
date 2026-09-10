import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

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

    return NextResponse.json({ success: true, message: 'Usuário e todos os dados associados foram excluídos com sucesso' });
  } catch (err: any) {
    console.error("Exceção em /api/admin/delete-user:", err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
