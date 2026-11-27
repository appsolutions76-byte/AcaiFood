import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';
import { getFounderQuotaStatus, isStoreRole, isCourierRole } from '@/lib/founderQuota';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const paymentId = searchParams.get('paymentId');
    const queryRole = searchParams.get('role') || undefined;
    const queryCity = searchParams.get('city') || undefined;

    // Se for verificação direta de pagamento por paymentId (usado no fluxo de pré-cadastro antes de criar a conta)
    if (!userId && paymentId) {
      const ASAAS_API_KEY = await getAsaasApiKey();
      const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

      if (!ASAAS_API_KEY) {
        return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
      }

      try {
        const payRes = await fetch(`${ASAAS_URL}/payments/${paymentId}`, {
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' }
        });

        if (payRes.ok) {
          const payData = await payRes.json();
          const isPaid = payData?.status === 'RECEIVED' || payData?.status === 'CONFIRMED';
          return NextResponse.json({
            success: true,
            isPaid,
            status: payData?.status,
            paymentId: payData?.id,
            value: payData?.value
          });
        }
      } catch (_err) {
        console.warn('Aviso ao consultar paymentId no Asaas:', _err);
      }
    }

    // Se não houver userId, é uma consulta pública sobre a cota de ativação (usada pela tela de cadastro pública)
    if (!userId) {
      const quota = await getFounderQuotaStatus({ role: queryRole, city: queryCity });

      const isStore = isStoreRole(queryRole);
      const isCourier = isCourierRole(queryRole);

      // Números específicos para o papel solicitado (se informado), ou consolidado geral
      const effectiveFreeQuota = isStore ? quota.stores.freeQuota : isCourier ? quota.couriers.freeQuota : quota.freeQuota;
      const effectiveSubsidized = isStore ? quota.stores.subsidizedCount : isCourier ? quota.couriers.subsidizedCount : quota.subsidizedCount;
      const effectiveFreeSlots = isStore ? quota.stores.freeSlotsRemaining : isCourier ? quota.couriers.freeSlotsRemaining : quota.freeSlotsRemaining;
      const effectiveFee = isStore ? quota.stores.activationFee : isCourier ? quota.couriers.activationFee : quota.activationFee;

      return NextResponse.json({
        success: true,
        // Propriedades retrocompatíveis refinadas para o papel solicitado
        activationEnabled: quota.activationEnabled,
        activationFee: effectiveFee,
        freeQuota: effectiveFreeQuota,
        subsidizedCount: effectiveSubsidized,
        freeSlotsRemaining: effectiveFreeSlots,
        isFree: !quota.activationEnabled || effectiveFreeSlots > 0,
        userStatus: null,
        // Propriedades estruturadas por papel e cidade
        targetRole: quota.targetRole,
        targetCity: quota.targetCity,
        stores: quota.stores,
        couriers: quota.couriers
      });
    }

    // Se userId for fornecido, exige autenticação do usuário ou admin
    const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
    if (!auth.authorized) return unauthorizedResponse(auth.error);

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode consultar os dados da sua própria ativação.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Obter dados do usuário para papel e cidade
    const { data: user } = await supabase
      .from('users')
      .select('id, name, role, cidade, asaas_wallet_id, asaas_account_id, status')
      .eq('id', userId)
      .maybeSingle();

    const effectiveRole = queryRole || user?.role;
    const effectiveCity = queryCity || user?.cidade;

    const quota = await getFounderQuotaStatus({
      userId,
      role: effectiveRole,
      city: effectiveCity
    });

    const isStore = isStoreRole(effectiveRole);
    const isCourier = isCourierRole(effectiveRole);
    const effectiveFee = isStore ? quota.stores.activationFee : isCourier ? quota.couriers.activationFee : quota.activationFee;
    const effectiveFreeQuota = isStore ? quota.stores.freeQuota : isCourier ? quota.couriers.freeQuota : quota.freeQuota;
    const effectiveSubsidized = isStore ? quota.stores.subsidizedCount : isCourier ? quota.couriers.subsidizedCount : quota.subsidizedCount;
    const effectiveFreeSlots = isStore ? quota.stores.freeSlotsRemaining : isCourier ? quota.couriers.freeSlotsRemaining : quota.freeSlotsRemaining;

    let userActivationStatus: any = null;
    if (user) {
      let isPaid = Boolean(user.asaas_wallet_id || user.asaas_account_id || quota.isUserAlreadyFounder);

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
        isFounderSubsidized: quota.isUserAlreadyFounder,
        asaasLinked: Boolean(user.asaas_wallet_id),
        paymentId: paymentId || null
      };
    }

    return NextResponse.json({
      success: true,
      activationEnabled: quota.activationEnabled,
      activationFee: effectiveFee,
      freeQuota: effectiveFreeQuota,
      subsidizedCount: effectiveSubsidized,
      freeSlotsRemaining: effectiveFreeSlots,
      isFree: quota.isFree,
      userStatus: userActivationStatus,
      targetRole: quota.targetRole,
      targetCity: quota.targetCity,
      stores: quota.stores,
      couriers: quota.couriers
    });

  } catch (error: any) {
    console.error('Erro na API GET /api/asaas/activation:', error);
    return NextResponse.json({ error: error.message || 'Erro ao consultar ativação' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, forceFounder, role: bodyRole, city: bodyCity, cpfCnpj, name: bodyName, email: bodyEmail, phone: bodyPhone } = body;

    // -----------------------------------------------------------------------------------
    // FLUXO DE PRÉ-CADASTRO (Sem conta criada ainda: paga o Pix primeiro para liberar a conta)
    // -----------------------------------------------------------------------------------
    if (!userId) {
      const cleanCpf = String(cpfCnpj || '').replace(/\D/g, '');
      const cleanPhone = String(bodyPhone || '').replace(/\D/g, '');
      const payerName = String(bodyName || '').trim();
      const payerEmail = String(bodyEmail || '').trim();

      if (!payerName || !payerEmail || !(cleanCpf.length === 11 || cleanCpf.length === 14)) {
        return NextResponse.json({
          error: 'Informe nome, e-mail e CPF/CNPJ válidos para gerar a ativação.'
        }, { status: 400 });
      }

      // Checa a cota para o perfil e cidade solicitados
      const quota = await getFounderQuotaStatus({ role: bodyRole, city: bodyCity });
      const isStore = isStoreRole(bodyRole);
      const isCourier = isCourierRole(bodyRole);
      const effectiveSlots = isStore ? quota.stores.freeSlotsRemaining : isCourier ? quota.couriers.freeSlotsRemaining : quota.freeSlotsRemaining;
      const effectiveFee = isStore ? quota.stores.activationFee : isCourier ? quota.couriers.activationFee : quota.activationFee;

      // Se ainda tiver vaga de fundador para esse perfil, NÃO cobra nada!
      if (!quota.activationEnabled || effectiveSlots > 0) {
        return NextResponse.json({
          success: true,
          isFounderSubsidized: true,
          freeSlotsRemaining: effectiveSlots,
          message: 'Vaga gratuita garantida!'
        });
      }

      // Cota esgotada: gerar Pix no Asaas
      const ASAAS_API_KEY = await getAsaasApiKey();
      const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

      if (!ASAAS_API_KEY) {
        return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
      }

      let customerId = '';
      try {
        const custSearchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${encodeURIComponent(cleanCpf)}`, {
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
              name: payerName,
              email: payerEmail,
              cpfCnpj: cleanCpf,
              mobilePhone: cleanPhone || undefined
            })
          });
          const newCustData = await createCustRes.json();
          if (newCustData?.id) {
            customerId = newCustData.id;
          } else {
            const msg = Array.isArray(newCustData?.errors) ? newCustData.errors.map((e: any) => e.description).join(', ') : '';
            return NextResponse.json({ error: `O Asaas recusou os dados: ${msg || 'Confira seus dados.'}` }, { status: 400 });
          }
        }
      } catch (_err) {
        console.warn('Aviso ao registrar cliente Asaas pré-cadastro:', _err);
      }

      if (!customerId) {
        return NextResponse.json({ error: 'Falha ao conectar com gateway Asaas para cobrança' }, { status: 400 });
      }

      // Verificar se já existe Pix pendente ou pago para este CPF
      let payData: any = null;
      try {
        const existRes = await fetch(`${ASAAS_URL}/payments?externalReference=ACTIVATE_CPF_${cleanCpf}`, {
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
          value: effectiveFee,
          dueDate: dueDate,
          description: `Taxa de ativação AçaíFood (${isStore ? 'Batedeira' : isCourier ? 'Motoboy' : 'Parceiro'})`,
          externalReference: `ACTIVATE_CPF_${cleanCpf}`
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

      const qrRes = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      });
      const qrData = qrRes.ok ? await qrRes.json() : null;

      if (!qrData || !qrData.encodedImage || !qrData.payload) {
        return NextResponse.json({ error: 'Falha ao obter QR Code do Asaas' }, { status: 502 });
      }

      return NextResponse.json({
        success: true,
        isFounderSubsidized: false,
        paymentId: payData.id,
        pixQrCode: qrData.encodedImage,
        pixCopiaECola: qrData.payload,
        value: effectiveFee
      });
    }

    // -----------------------------------------------------------------------------------
    // FLUXO DE USUÁRIO JÁ CADASTRADO (Autenticado, no Guard ou Admin)
    // -----------------------------------------------------------------------------------
    const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
    if (!auth.authorized) return unauthorizedResponse(auth.error);

    const callerId = auth.user?.id || auth.profile?.id;
    const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && callerId !== userId) {
      return NextResponse.json({ error: 'Você só pode ativar seu próprio cadastro.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, cpf_cnpj, phone, telefone, role, cidade, status, asaas_wallet_id, asaas_account_id')
      .eq('id', userId)
      .maybeSingle();

    const effectiveRole = bodyRole || user?.role;
    const effectiveCity = bodyCity || user?.cidade;

    const quota = await getFounderQuotaStatus({
      userId,
      role: effectiveRole,
      city: effectiveCity
    });

    const isStore = isStoreRole(effectiveRole);
    const isCourier = isCourierRole(effectiveRole);
    const effectiveFee = isStore ? quota.stores.activationFee : isCourier ? quota.couriers.activationFee : quota.activationFee;
    const effectiveFreeSlots = isStore ? quota.stores.freeSlotsRemaining : isCourier ? quota.couriers.freeSlotsRemaining : quota.freeSlotsRemaining;

    let isForceAdmin = false;
    if (forceFounder) {
      const authAdmin = await authorizeRequest(request, ['admin']);
      if (authAdmin.authorized && (authAdmin.profile?.role === 'admin' || authAdmin.profile?.role === 'ADMIN' || authAdmin.source === 'internal_secret')) {
        isForceAdmin = true;
      }
    }

    const qualifiesForFree = isForceAdmin || !quota.activationEnabled || quota.isUserAlreadyFounder;

    if (qualifiesForFree) {
      await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        isFounderSubsidized: true,
        freeSlotsRemaining: effectiveFreeSlots,
        message: 'Vaga de fundador garantida com sucesso!'
      });
    }

    const ASAAS_API_KEY = await getAsaasApiKey();
    const ASAAS_URL = getAsaasBaseUrl(ASAAS_API_KEY);

    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 400 });
    }

    let payerEmail = String(user?.email || '').trim();
    if (!payerEmail && !isAdmin) payerEmail = String(auth.user?.email || '').trim();
    const cleanCpf = String(user?.cpf_cnpj || '').replace(/\D/g, '');
    const cleanPhone = String(user?.phone || user?.telefone || '').replace(/\D/g, '');
    const payerName = String(user?.name || '').trim();

    if (!payerName || !payerEmail || !(cleanCpf.length === 11 || cleanCpf.length === 14)) {
      return NextResponse.json({
        error: 'Complete nome, e-mail e CPF/CNPJ no seu cadastro antes de pagar a ativação.'
      }, { status: 400 });
    }

    let customerId = '';
    try {
      const custSearchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${encodeURIComponent(cleanCpf)}`, {
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
            name: payerName,
            email: payerEmail,
            cpfCnpj: cleanCpf,
            mobilePhone: cleanPhone || undefined
          })
        });
        const newCustData = await createCustRes.json();
        if (newCustData?.id) {
          customerId = newCustData.id;
        } else {
          const msg = Array.isArray(newCustData?.errors) ? newCustData.errors.map((e: any) => e.description).join(', ') : '';
          return NextResponse.json({ error: `O Asaas recusou o cadastro do pagador${msg ? `: ${msg}` : ''}. Confira seus dados.` }, { status: 400 });
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
        value: effectiveFee,
        dueDate: dueDate,
        description: 'Taxa de ativação da plataforma AçaíFood',
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

    const qrRes = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, {
      headers: { 'access_token': ASAAS_API_KEY }
    });
    const qrData = qrRes.ok ? await qrRes.json() : null;

    if (!qrData || !qrData.encodedImage || !qrData.payload) {
      const msg = qrData?.errors?.[0]?.description || qrData?.message || 'Falha ao obter QR Code do Asaas';
      return NextResponse.json(
        { error: `Não foi possível obter o Pix oficial de ativação: ${msg}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      isFounderSubsidized: false,
      paymentId: payData.id,
      pixQrCode: qrData.encodedImage,
      pixCopiaECola: qrData.payload,
      invoiceUrl: payData.invoiceUrl || payData.bankSlipUrl,
      value: effectiveFee
    });

  } catch (error: any) {
    console.error('Erro na API POST /api/asaas/activation:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar ativação' }, { status: 500 });
  }
}
