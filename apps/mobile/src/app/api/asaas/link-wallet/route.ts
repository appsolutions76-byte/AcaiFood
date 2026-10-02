import { NextResponse } from 'next/server';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Vincula um walletId Asaas já validado (ex.: resolvido fora do fluxo normal de
// criação de subconta) ao cadastro do usuário. asaas_wallet_id e split_enabled não
// são colunas liberadas para UPDATE direto pelo cliente (ver migration
// 20260912000000_fix_users_privilege_escalation.sql), então essa gravação precisa
// passar por uma rota de servidor com Service Role, como o restante do sistema já faz.
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { userId, walletId } = body;

    if (!userId || !walletId || typeof walletId !== 'string') {
      return NextResponse.json({ error: 'userId e walletId são obrigatórios' }, { status: 400 });
    }

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode vincular uma carteira Asaas ao seu próprio perfil.' }, { status: 403 });
    }

    const cleanWalletId = walletId.trim();
    const isValidWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanWalletId);
    if (!isValidWalletId) {
      return NextResponse.json({ error: 'walletId inválido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Obter usuário e dados do Asaas
    const { data: userProfile } = await supabase.from('users').select('cpf_cnpj, email, name, asaas_account_id').eq('id', userId).maybeSingle();

    let isApproved = false;
    let accountStatus = 'PENDING';

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
              const matchedAcc = accData.data.find((a: any) => a.walletId === cleanWalletId) || accData.data[0];
              if (matchedAcc && matchedAcc.walletId === cleanWalletId) {
                accountStatus = matchedAcc.status || 'PENDING';
                if (accountStatus === 'APPROVED' || accountStatus === 'ACTIVE') {
                  isApproved = true;
                }
              }
            }
          }
        }
      }
    } catch (_vErr) {
      console.warn("Aviso ao validar subconta no Asaas em link-wallet:", _vErr);
    }

    const { error } = await supabase
      .from('users')
      .update({ 
        asaas_wallet_id: cleanWalletId, 
        split_enabled: isApproved,
        asaas_account_status: isApproved ? 'APPROVED' : (accountStatus || 'PENDING')
      })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message || 'Erro ao vincular carteira Asaas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, walletId: cleanWalletId, splitEnabled: isApproved });

  } catch (error: any) {
    console.error('Erro na API /api/asaas/link-wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao vincular carteira Asaas' },
      { status: 500 }
    );
  }
}
