import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { generateValidPixPayload } from '@/lib/pix';
import { getFounderQuotaStatus } from '@/lib/founderQuota';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const paymentId = searchParams.get('paymentId');

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && userId && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode consultar os dados da sua própria ativação.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const quota = await getFounderQuotaStatus(userId || undefined);
    const { activationFee, freeQuota, activationEnabled, subsidizedCount, freeSlotsRemaining, isUserAlreadyFounder, isFree } = quota;

    let userActivationStatus: any = null;
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id, name, role, asaas_wallet_id, asaas_account_id, status')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        let isPaid = Boolean(user.asaas_wallet_id || user.asaas_account_id || isUserAlreadyFounder);

        const ASAAS_API_KEY = await getAsaasApiKey();
        const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

        if (!isPaid && ASAAS_API_KEY) {
          try {
            const searchUrl = paymentId 
              ? `${ASAAS_URL}/payments/${paymentId}`
              : `${ASAAS_URL}/payments?externalReference=ACTIVATE_${userId}`;
            
            const res = await fetch(searchUrl, {
              headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
            });
            if (res.ok) {
              const payData = await res.json();
              const paymentList = Array.isArray(payData?.data) ? payData.data : [payData];
              if (paymentList.some((p: any) => p && (p.status === 'RECEIVED' || p.status === 'CONFIRMED'))) {
                isPaid = true;
                await supabase
                  .from('users')
                  .update({ status: 'active' })
                  .eq('id', userId);
              }
            }
          } catch (_err) {}
        }

        userActivationStatus = {
          userId: user.id,
          isPaid,
          isFounderSubsidized: isUserAlreadyFounder,
          asaasLinked: Boolean(user.asaas_wallet_id),
          paymentId: paymentId || null
        };
      }
    }

    return NextResponse.json({
      success: true,
      activationEnabled,
      activationFee,
      freeQuota,
      subsidizedCount,
      freeSlotsRemaining,
      isFree,
      userStatus: userActivationStatus
    });

  } catch (error: any) {
    console.error('Erro na API GET /api/asaas/activation:', error);
    return NextResponse.json({ error: error.message || 'Erro ao consultar ativação' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { userId, name, email, cpfCnpj, phone, forceFounder } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode ativar seu próprio cadastro.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    let activationFee = 12.90;
    let freeQuota = 50;
    let activationEnabled = true;

    try {
      const { data: row } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (row?.asaas_platform_wallet_id) {
        try {
          const parsed = JSON.parse(row.asaas_platform_wallet_id);
          if (parsed && typeof parsed === 'object') {
            if (parsed.activationFee !== undefined) activationFee = Number(parsed.activationFee);
            if (parsed.freeQuota !== undefined) freeQuota = Number(parsed.freeQuota);
            if (parsed.activationEnabled !== undefined) activationEnabled = Boolean(parsed.activationEnabled);
          }
        } catch (_e) {}
      }
    } catch (_e) {}

    let subsidizedCount = 0;
    let isUserAlreadyFounder = false;

    try {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, role, created_at, asaas_wallet_id, pix_key, status')
        .order('created_at', { ascending: true });

      if (allUsers && Array.isArray(allUsers)) {
        const partners = allUsers.filter(u => {
          const r = String(u.role || '').toLowerCase();
          return r !== 'cliente' && r !== 'admin' && r !== 'customer' && r !== 'client';
        });

        // Fundadores estritos (primeiros freeQuota cadastrados)
        const founderPartners = partners.slice(0, freeQuota);
        subsidizedCount = founderPartners.length;
        isUserAlreadyFounder = founderPartners.some(p => p.id === userId);
      }
    } catch (_e) {}

    // Validação de segurança: apenas admin autenticado ou segredo interno pode forçar subsídio gratuito
    let isForceAdmin = false;
    if (forceFounder) {
      const auth = await authorizeRequest(request, ['admin']);
      if (auth.authorized && (auth.profile?.role === 'admin' || auth.profile?.role === 'ADMIN' || auth.source === 'internal_secret')) {
        isForceAdmin = true;
      }
    }

    const freeSlotsRemaining = Math.max(0, freeQuota - subsidizedCount);

    // Regra estrita de custo: NUNCA concede gratuidade se a cota foi atingida e o usuário não é fundador histórico
    const qualifiesForFree = isForceAdmin || !activationEnabled || isUserAlreadyFounder;

    if (qualifiesForFree) {
      await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        isFounderSubsidized: true,
        freeSlotsRemaining: freeSlotsRemaining,
        message: 'Vaga de fundador garantida com sucesso!'
      });
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
    }

    const cleanCpf = String(cpfCnpj || '').replace(/\D/g, '');
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    let customerId = '';
    const emailToSearch = email || `user_${userId.slice(0, 8)}@acaifood.app.br`;

    try {
      const custSearchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(emailToSearch)}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      const custSearchData = await custSearchRes.json();
      if (custSearchData?.data?.length > 0) {
        customerId = custSearchData.data[0].id;
      } else {
        const createCustRes = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name || 'Parceiro AçaíFood',
            email: emailToSearch,
            cpfCnpj: cleanCpf.length === 11 || cleanCpf.length === 14 ? cleanCpf : undefined,
            mobilePhone: cleanPhone || undefined
          })
        });
        const newCustData = await createCustRes.json();
        if (newCustData?.id) {
          customerId = newCustData.id;
        } else {
          // Fallback de resiliência: se o Asaas recusou por CPF/CNPJ ou telefone inválido, tenta criar apenas com nome e email
          const retryCustRes = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name || 'Parceiro AçaíFood',
              email: emailToSearch
            })
          });
          const retryData = await retryCustRes.json();
          customerId = retryData?.id || '';
        }
      }
    } catch (_err) {
      console.warn('Aviso ao buscar/criar cliente Asaas para ativação:', _err);
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Não foi possível registrar o cliente no Asaas para cobrança' }, { status: 400 });
    }

    let payData: any = null;

    try {
      const existRes = await fetch(`${ASAAS_URL}/payments?externalReference=ACTIVATE_${userId}`, {
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
      });
      if (existRes.ok) {
        const existJson = await existRes.json();
        const existingList = Array.isArray(existJson?.data) ? existJson.data : [];
        const paidPay = existingList.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
        if (paidPay) {
          return NextResponse.json({
            success: true,
            isPaid: true,
            isFounderSubsidized: false,
            paymentId: paidPay.id,
            message: 'Ativação já paga com sucesso!'
          });
        }
        const pendingPay = existingList.find((p: any) => p.status === 'PENDING');
        if (pendingPay?.id) {
          payData = pendingPay;
        }
      }
    } catch (_exErr) {}

    if (!payData) {
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const paymentPayload = {
        customer: customerId,
        billingType: 'PIX',
        value: activationFee,
        dueDate: dueDate,
        description: 'Taxa Única de Homologação Asaas & Ativação de Parceiro - AçaíFood',
        externalReference: `ACTIVATE_${userId}`
      };

      const payRes = await fetch(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload)
      });

      payData = await payRes.json();
      if (!payData?.id) {
        return NextResponse.json({ error: payData?.errors?.[0]?.description || 'Erro ao gerar Pix no Asaas' }, { status: 400 });
      }
    }

    let pixQrCode = null;
    let pixCopiaECola = null;
    try {
      const qrRes = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixQrCode = qrData.encodedImage || null;
        pixCopiaECola = qrData.payload || null;
      }
    } catch (_qErr) {}

    if (!pixCopiaECola) {
      pixCopiaECola = generateValidPixPayload({
        pixKey: 'contato@acaifood.app.br',
        merchantName: 'AcaiFood Ativacao',
        merchantCity: 'BELEM',
        amount: activationFee,
        txId: `ACT${userId.slice(0, 6)}`
      });
    }

    return NextResponse.json({
      success: true,
      isFounderSubsidized: false,
      paymentId: payData.id,
      pixQrCode,
      pixCopiaECola,
      invoiceUrl: payData.invoiceUrl || payData.bankSlipUrl,
      value: activationFee
    });

  } catch (error: any) {
    console.error('Erro na API POST /api/asaas/activation:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar ativação' }, { status: 500 });
  }
}
