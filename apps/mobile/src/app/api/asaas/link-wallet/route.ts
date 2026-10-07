import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';

// Vincula um walletId Asaas já validado (ex.: resolvido fora do fluxo normal de
// criação de subconta) ao cadastro do usuário. asaas_wallet_id e split_enabled não
// são colunas liberadas para UPDATE direto pelo cliente (ver migration
// 20260912000000_fix_users_privilege_escalation.sql), então essa gravação precisa
// passar por uma rota de servidor com Service Role, como o restante do sistema já faz.
export async function POST(request: Request) {
  // Vinculação manual de walletId: só admin (com MFA). Parceiros recebem a walletId
  // automaticamente ao abrir a subconta por /api/asaas/subaccount.
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { userId, walletId } = body;

    if (!userId || !walletId || typeof walletId !== 'string') {
      return NextResponse.json({ error: 'userId e walletId são obrigatórios' }, { status: 400 });
    }


    const cleanWalletId = walletId.trim();
    const isValidWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanWalletId);
    if (!isValidWalletId) {
      return NextResponse.json({ error: 'walletId inválido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Obter usuário e dados do Asaas
    const { data: userProfile } = await supabase.from('users').select('cpf_cnpj, email, name, asaas_account_id').eq('id', userId).maybeSingle();

    // Só aceita walletId de subconta da NOSSA conta raiz com o MESMO CPF/CNPJ do usuário.
    // A aprovação (APPROVED) vem só do webhook/consulta de situação da conta.
    let walletBelongsToUser = false;
    let matchedAccountId: string | null = null;

    try {
      const { getAsaasApiKey, getAsaasBaseUrl } = await import('@/lib/asaasConfig');
      const apiKey = await getAsaasApiKey();
      if (apiKey) {
        const baseUrl = getAsaasBaseUrl(apiKey);
        const cleanCpfCnpj = String(userProfile?.cpf_cnpj || '').replace(/\D/g, '');

        if (cleanCpfCnpj) {
          const accRes = await fetch(`${baseUrl}/accounts?cpfCnpj=${cleanCpfCnpj}`, {
            headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
          });
          if (accRes.ok) {
            const accData = await accRes.json();
            if (accData?.data && accData.data.length > 0) {
              const matchedAcc = accData.data.find((a: any) => a.walletId === cleanWalletId);
              if (matchedAcc) {
                walletBelongsToUser = true;
                matchedAccountId = matchedAcc.id || null;
              }
            }
          }
        }
      }
    } catch (_vErr) {
      console.warn("Aviso ao validar subconta no Asaas em link-wallet:", _vErr);
    }

    if (!walletBelongsToUser) {
      return NextResponse.json({ error: 'walletId não pertence a uma subconta desta conta Asaas com o CPF/CNPJ do usuário.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        asaas_wallet_id: cleanWalletId,
        asaas_account_id: matchedAccountId || userProfile?.asaas_account_id || null,
        split_enabled: false,
        asaas_account_status: 'NEEDS_ADMIN'
      })
      .eq('id', userId);

    await logAdminAction({
      actorId: auth.user?.id || auth.profile?.id || null,
      action: 'ASAAS_WALLET_LINKED_MANUALLY',
      targetType: 'USER',
      targetId: userId,
      afterState: { walletId: cleanWalletId, accountId: matchedAccountId },
      request
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Erro ao vincular carteira Asaas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, walletId: cleanWalletId, splitEnabled: false, note: 'A chave de API da subconta não é devolvida pelo Asaas após a criação; o status será atualizado pela consulta de situação da conta.' });

  } catch (error: any) {
    console.error('Erro na API /api/asaas/link-wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao vincular carteira Asaas' },
      { status: 500 }
    );
  }
}
