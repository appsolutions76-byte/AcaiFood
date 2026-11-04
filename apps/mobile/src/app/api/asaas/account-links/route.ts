import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { logAsaasRequest } from '@/lib/asaasRequestLog';
import { cleanDoc, maskEmail } from '@/lib/accountGroup';

export const dynamic = 'force-dynamic';

/**
 * R47 — Contas do app que usam a mesma subconta Asaas (mesmo CPF/CNPJ).
 * GET: vínculos da conta logada (como principal e como vinculada).
 * POST: a conta PRINCIPAL (ou o admin) aprova, recusa, desfaz e libera/bloqueia saque.
 */

const roleLabel = (r: string, v?: string | null) => {
  const x = String(r || '').toUpperCase();
  if (x === 'PARTNER' || x === 'LOJA') return 'Batedeira';
  if (x === 'SUPPLIER' || x === 'FORNECEDOR') return 'Fornecedor';
  if (['COURIER', 'MOTORISTA', 'MOTOBOY', 'DRIVER', 'CAMINHAO'].includes(x)) {
    const vv = String(v || '').toUpperCase();
    return vv === 'TRUCK' || vv === 'DUMP_TRUCK' ? 'Caminhão' : 'Motoboy';
  }
  return 'Conta';
};

async function loadNames(ids: string[]) {
  const map: Record<string, any> = {};
  if (ids.length === 0) return map;
  const { data } = await getSupabaseAdmin()
    .from('users')
    .select('id, name, email, role, vehicle_type, storefronts(store_name)')
    .in('id', ids);
  (data || []).forEach((u: any) => {
    const sf = Array.isArray(u.storefronts) ? u.storefronts[0] : u.storefronts;
    map[u.id] = { name: sf?.store_name || u.name || '', email: maskEmail(u.email || ''), tipo: roleLabel(u.role, u.vehicle_type) };
  });
  return map;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin'], { allowBlocked: true });
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  const me = auth.user?.id || auth.profile?.id;
  if (!me) return unauthorizedResponse('Sessão inválida');

  const sb = getSupabaseAdmin();
  const { data: asOwner, error } = await sb
    .from('payment_account_links')
    .select('id, linked_user_id, status, can_withdraw, requested_at')
    .eq('owner_user_id', me)
    .in('status', ['PENDING', 'ACTIVE'])
    .order('requested_at', { ascending: true });
  if (error) return NextResponse.json({ success: true, available: false, asOwner: [], asLinked: null });

  const { data: mine } = await sb
    .from('payment_account_links')
    .select('id, owner_user_id, status, can_withdraw')
    .eq('linked_user_id', me)
    .in('status', ['PENDING', 'ACTIVE'])
    .maybeSingle();

  const ids = [...(asOwner || []).map((l: any) => l.linked_user_id), ...(mine ? [mine.owner_user_id] : [])];
  const names = await loadNames(ids);

  return NextResponse.json({
    success: true,
    available: true,
    asOwner: (asOwner || []).map((l: any) => ({ id: l.id, status: l.status, canWithdraw: l.can_withdraw, requestedAt: l.requested_at, account: names[l.linked_user_id] || null })),
    asLinked: mine ? { id: mine.id, status: mine.status, canWithdraw: mine.can_withdraw, owner: names[mine.owner_user_id] || null } : null,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['loja', 'fornecedor', 'motorista', 'admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);
  const me = auth.user?.id || auth.profile?.id || null;
  const isAdmin = String(auth.profile?.role || '').toLowerCase() === 'admin';

  const body = await request.json().catch(() => ({} as any));
  const action = String(body?.action || '');
  const linkId = String(body?.linkId || '');
  if (!linkId || !['approve', 'reject', 'revoke', 'set_withdraw'].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: link, error: linkErr } = await sb.from('payment_account_links').select('*').eq('id', linkId).maybeSingle();
  if (linkErr || !link) return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
  if (!isAdmin && link.owner_user_id !== me) {
    return NextResponse.json({ error: 'Só a conta principal pode decidir sobre este vínculo.' }, { status: 403 });
  }
  const now = new Date().toISOString();
  const audit = (a: string, extra: any) => logAdminAction({
    actorId: me, action: a, targetType: 'PAYMENT_ACCOUNT_LINK', targetId: linkId,
    beforeState: { status: link.status, canWithdraw: link.can_withdraw }, afterState: extra, request,
  });

  if (action === 'reject') {
    if (link.status !== 'PENDING') return NextResponse.json({ error: 'Só pedidos pendentes podem ser recusados.' }, { status: 400 });
    await sb.from('payment_account_links').update({ status: 'REJECTED', decided_at: now, decided_by: me }).eq('id', linkId);
    await audit('PAYMENT_LINK_REJECTED', { status: 'REJECTED' });
    return NextResponse.json({ success: true });
  }

  if (action === 'set_withdraw') {
    if (link.status !== 'ACTIVE') return NextResponse.json({ error: 'O vínculo precisa estar ativo.' }, { status: 400 });
    const canWithdraw = Boolean(body?.canWithdraw);
    await sb.from('payment_account_links').update({ can_withdraw: canWithdraw, decided_at: now, decided_by: me }).eq('id', linkId);
    await audit('PAYMENT_LINK_WITHDRAW_PERMISSION', { canWithdraw });
    return NextResponse.json({ success: true, canWithdraw });
  }

  if (action === 'approve') {
    if (link.status !== 'PENDING') return NextResponse.json({ error: 'Este pedido não está mais pendente.' }, { status: 400 });
    const { data: users } = await sb
      .from('users')
      .select('id, cpf_cnpj, asaas_wallet_id, asaas_account_id, asaas_account_status, split_enabled')
      .in('id', [link.owner_user_id, link.linked_user_id]);
    const owner = (users || []).find((u: any) => u.id === link.owner_user_id);
    const linked = (users || []).find((u: any) => u.id === link.linked_user_id);
    if (!owner || !linked) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

    // Segurança: as duas contas precisam ter o MESMO CPF/CNPJ do vínculo
    const doc = cleanDoc(link.cpf_cnpj);
    if (!doc || cleanDoc(owner.cpf_cnpj) !== doc || cleanDoc(linked.cpf_cnpj) !== doc) {
      return NextResponse.json({ error: 'CPF/CNPJ das contas não confere. Vínculo não permitido.' }, { status: 400 });
    }
    if (!owner.asaas_account_id || !owner.asaas_wallet_id) {
      return NextResponse.json({ error: 'A conta principal ainda não tem subconta Asaas ativa.' }, { status: 400 });
    }
    if (link.asaas_account_id && link.asaas_account_id !== owner.asaas_account_id) {
      return NextResponse.json({ error: 'A subconta da conta principal mudou desde o pedido. Peça o vínculo novamente.' }, { status: 409 });
    }
    if (linked.asaas_account_id && linked.asaas_account_id !== owner.asaas_account_id) {
      return NextResponse.json({ error: 'Esta conta já tem outra subconta Asaas. Fale com o suporte.' }, { status: 409 });
    }
    const { data: ownerSecret } = await sb.from('partner_secrets').select('asaas_account_api_key').eq('user_id', owner.id).maybeSingle();
    if (!ownerSecret?.asaas_account_api_key) {
      return NextResponse.json({ error: 'A conta principal está sem a chave da subconta. Fale com o suporte.' }, { status: 409 });
    }

    const { error: upErr } = await sb.from('users').update({
      asaas_wallet_id: owner.asaas_wallet_id,
      asaas_account_id: owner.asaas_account_id,
      asaas_account_status: owner.asaas_account_status,
      split_enabled: owner.split_enabled,
    }).eq('id', linked.id);
    if (upErr) return NextResponse.json({ error: 'Não foi possível vincular a conta: ' + upErr.message }, { status: 500 });

    const { error: secErr } = await sb.from('partner_secrets').upsert({
      user_id: linked.id,
      asaas_account_api_key: ownerSecret.asaas_account_api_key,
      updated_at: now,
    }, { onConflict: 'user_id' });
    if (secErr) {
      await sb.from('users').update({ asaas_wallet_id: null, asaas_account_id: null, asaas_account_status: null, split_enabled: false }).eq('id', linked.id);
      return NextResponse.json({ error: 'Não foi possível concluir o vínculo. Nada foi alterado.' }, { status: 500 });
    }

    await sb.from('payment_account_links').update({ status: 'ACTIVE', can_withdraw: Boolean(body?.canWithdraw), decided_at: now, decided_by: me }).eq('id', linkId);
    await audit('PAYMENT_LINK_APPROVED', { status: 'ACTIVE', accountId: owner.asaas_account_id });
    await logAsaasRequest({ userId: linked.id, action: 'SUBACCOUNT_LINK_APPROVED', responseBody: { ownerUserId: owner.id, accountId: owner.asaas_account_id } });
    return NextResponse.json({ success: true });
  }

  // revoke
  if (link.status !== 'ACTIVE' && link.status !== 'PENDING') return NextResponse.json({ error: 'Vínculo já encerrado.' }, { status: 400 });
  if (link.status === 'ACTIVE') {
    const { count } = await sb
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', link.linked_user_id)
      .in('status', ['PENDENTE', 'APROVADO', 'PROCESSING']);
    if ((count || 0) > 0) {
      return NextResponse.json({ error: 'Esta conta tem um saque em andamento. Aguarde a conclusão para desvincular.' }, { status: 409 });
    }
    // Pedidos em andamento cobrados nesta subconta ainda precisam da chave (pagar a corrida, estornar)
    const { data: sfs } = await sb.from('storefronts').select('id').eq('partner_id', link.linked_user_id);
    const sfIds = (sfs || []).map((x: any) => x.id);
    const openStatuses = ['PAID', 'PREPARING', 'READY', 'SEARCHING_OPERATOR', 'IN_TRANSIT', 'DELIVERING', 'DELIVERED'];
    if (sfIds.length > 0) {
      const { count: openOrders } = await sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('seller_storefront_id', sfIds)
        .in('status', openStatuses);
      if ((openOrders || 0) > 0) {
        return NextResponse.json({ error: 'Esta conta tem pedidos em andamento. Desvincule depois que eles forem concluídos.' }, { status: 409 });
      }
    }
    const { count: openRides } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', link.linked_user_id)
      .in('status', openStatuses);
    if ((openRides || 0) > 0) {
      return NextResponse.json({ error: 'Esta conta tem corridas em andamento. Desvincule depois que forem concluídas.' }, { status: 409 });
    }
    await sb.from('users').update({ asaas_wallet_id: null, asaas_account_id: null, asaas_account_status: null, split_enabled: false }).eq('id', link.linked_user_id);
    await sb.from('partner_secrets').delete().eq('user_id', link.linked_user_id);
  }
  await sb.from('payment_account_links').update({ status: 'REVOKED', decided_at: now, decided_by: me }).eq('id', linkId);
  await audit('PAYMENT_LINK_REVOKED', { status: 'REVOKED' });
  return NextResponse.json({ success: true });
}
