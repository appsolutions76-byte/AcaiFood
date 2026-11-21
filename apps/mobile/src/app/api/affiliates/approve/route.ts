import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const {
      affiliate_id,
      action, // 'approve' | 'reject'
      bonus_per_store,
      bonus_per_client,
      commission_pct,
      commission_months,
      withdrawal_mode,
      notes,
    } = body;

    if (!affiliate_id) {
      return NextResponse.json({ error: 'ID do afiliado é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: affiliate, error: fetchErr } = await supabase
      .from('partner_affiliates')
      .select('*, users!partner_affiliates_user_id_fkey(id, name, email, phone, cpf_cnpj)')
      .eq('id', affiliate_id)
      .maybeSingle();

    if (fetchErr || !affiliate) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 });
    }

    if (action === 'reject') {
      await supabase
        .from('partner_affiliates')
        .update({
          status: 'revoked',
          notes: notes || 'Recusado pelo administrador',
        })
        .eq('id', affiliate_id);

      return NextResponse.json({ success: true, message: 'Afiliado recusado com sucesso.' });
    }

    // Ação: Aprovar
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const updatePayload: any = {
      status: 'active',
      bonus_per_store: Number(bonus_per_store) || 0,
      bonus_per_client: Number(bonus_per_client) || 0,
      commission_pct: Number(commission_pct) || 0,
      commission_months: Number(commission_months) || 6,
      commission_start: today,
      withdrawal_mode: withdrawal_mode === 'auto' ? 'auto' : 'manual',
      activated_at: nowIso,
      notes: notes || affiliate.notes,
    };

    // Tentativa de criação de subconta Asaas se ainda não existir
    let asaasSubaccountId = affiliate.asaas_subaccount_id;
    let asaasWalletId = affiliate.asaas_wallet_id;

    const apiKey = await getAsaasApiKey();
    const userObj = affiliate.users;
    const userCpfCnpj = userObj?.cpf_cnpj ? String(userObj.cpf_cnpj).replace(/\D/g, '') : null;

    if (apiKey && !asaasSubaccountId && userCpfCnpj && (userCpfCnpj.length === 11 || userCpfCnpj.length === 14)) {
      try {
        const asaasUrl = getAsaasBaseUrl(apiKey);
        const accountPayload = {
          name: affiliate.name,
          email: userObj?.email || `${affiliate.referral_code.toLowerCase()}@parceiro.acaifood.app.br`,
          cpfCnpj: userCpfCnpj,
          phone: affiliate.contact ? affiliate.contact.replace(/\D/g, '') : undefined,
          companyType: userCpfCnpj.length === 14 ? 'LIMITED' : 'MEI',
        };

        const createRes = await fetch(`${asaasUrl}/accounts`, {
          method: 'POST',
          headers: {
            access_token: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(accountPayload),
        });

        const accountData = await createRes.json();
        if (accountData?.id) {
          asaasSubaccountId = accountData.id;
          asaasWalletId = accountData.walletId || null;
          updatePayload.asaas_subaccount_id = asaasSubaccountId;
          updatePayload.asaas_wallet_id = asaasWalletId;

          if (affiliate.user_id) {
            await supabase.from('users').update({
              asaas_account_id: asaasSubaccountId,
              asaas_wallet_id: asaasWalletId,
            }).eq('id', affiliate.user_id);
          }
        }
      } catch (asaasErr) {
        console.warn('[Affiliate Approve] Falha ao criar subconta Asaas inicial (pode ser configurada depois):', asaasErr);
      }
    }

    const { error: updateErr } = await supabase
      .from('partner_affiliates')
      .update(updatePayload)
      .eq('id', affiliate_id);

    if (updateErr) {
      console.error('[Affiliate Approve] Erro no update:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Afiliado aprovado e ativado com sucesso!',
      affiliate_id,
      status: 'active',
    });
  } catch (error: any) {
    console.error('[Affiliate Approve] Exceção:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
