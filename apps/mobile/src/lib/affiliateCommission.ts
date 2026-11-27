import { SupabaseClient } from '@supabase/supabase-js';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

interface ParticipantCandidate {
  role: 'CLIENT' | 'COURIER' | 'SELLER' | 'SUPPLIER';
  userId: string;
  label: string;
}

/**
 * Processa a comissão e bônus do parceiro afiliado quando um pedido é concluído/entregue (RECEIVED).
 * Suporta múltiplos participantes indicados:
 * - Loja / Vendedor (SELLER / SUPPLIER)
 * - Transporte / Entregador (COURIER)
 * - Cliente / Comprador (CLIENT)
 *
 * Cada indicado pode ter sua comissão calculada sobre:
 * - 'platform_revenue': taxa retida pela plataforma (1,5% da taxa do app)
 * - 'net_revenue': valor líquido movimentado pelo indicado (1,5% do repasse da loja, frete ou compra)
 */
export async function creditAffiliateCommission(orderId: string, supabase: SupabaseClient): Promise<void> {
  try {
    // 1. Buscar detalhes completos financeiros do pedido
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_type,
        buyer_id,
        seller_storefront_id,
        driver_id,
        products_subtotal,
        total_delivery_fee,
        total_amount,
        platform_sales_fee_amount,
        platform_delivery_fee_amount,
        total_platform_fee_amount,
        platform_fee_amount,
        seller_amount,
        seller_payout_amount,
        driver_amount,
        driver_payout_amount
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.warn(`[Affiliate Commission] Pedido ${orderId} não encontrado.`);
      return;
    }

    // 2. Identificar participantes do pedido
    const participants: ParticipantCandidate[] = [];

    // Comprador (CLIENT)
    if (order.buyer_id) {
      participants.push({
        role: 'CLIENT',
        userId: order.buyer_id,
        label: 'Cliente',
      });
    }

    // Entregador (COURIER)
    if (order.driver_id) {
      participants.push({
        role: 'COURIER',
        userId: order.driver_id,
        label: 'Entregador',
      });
    }

    // Vendedor / Loja (SELLER ou SUPPLIER em B2B)
    if (order.seller_storefront_id) {
      const { data: sf } = await supabase
        .from('storefronts')
        .select('partner_id')
        .eq('id', order.seller_storefront_id)
        .maybeSingle();

      if (sf?.partner_id) {
        participants.push({
          role: order.order_type === 'B2B' ? 'SUPPLIER' : 'SELLER',
          userId: sf.partner_id,
          label: order.order_type === 'B2B' ? 'Fornecedor' : 'Loja',
        });
      }
    }

    if (participants.length === 0) return;

    // 3. Buscar configurações e regras de comissão (base da comissão por indicado/perfil)
    const { data: cfgRow } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'affiliate_referral_rules')
      .maybeSingle();

    const rules = cfgRow?.value || { referral_basis: {}, affiliate_defaults: {} };

    // 4. Verificar dados de indicação de cada usuário
    const candidateUserIds = Array.from(new Set(participants.map((p) => p.userId)));
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, referred_by_affiliate')
      .in('id', candidateUserIds);

    const userMap: Record<string, any> = {};
    (usersData || []).forEach((u: any) => {
      userMap[u.id] = u;
    });

    // 5. Processar comissão para cada participante elegível
    for (const participant of participants) {
      const user = userMap[participant.userId];
      if (!user?.referred_by_affiliate) continue;

      const affiliateId = user.referred_by_affiliate;

      // Idempotência: verificar se este pedido já foi creditado para este indicado específico
      const { data: existingLedger } = await supabase
        .from('affiliate_commission_ledger')
        .select('id')
        .eq('order_id', orderId)
        .eq('affiliate_id', affiliateId)
        .eq('referred_user_id', participant.userId)
        .limit(1);

      if (existingLedger && existingLedger.length > 0) {
        continue; // Já creditado anteriormente
      }

      // Buscar cadastro do afiliado
      const { data: affiliate } = await supabase
        .from('partner_affiliates')
        .select('id, status, commission_pct, commission_months, commission_start, asaas_subaccount_id, asaas_wallet_id, withdrawal_mode')
        .eq('id', affiliateId)
        .single();

      if (!affiliate || affiliate.status !== 'active') continue;
      if (!affiliate.commission_pct || affiliate.commission_pct <= 0) continue;

      // Verificar validade da comissão no tempo (ex: 6 meses)
      if (affiliate.commission_start && affiliate.commission_months) {
        const end = new Date(affiliate.commission_start);
        end.setMonth(end.getMonth() + affiliate.commission_months);
        if (new Date() > end) continue;
      }

      // Determinar a base de comissão deste indicado: 'platform_revenue' ou 'net_revenue'
      const basis: 'platform_revenue' | 'net_revenue' =
        rules?.referral_basis?.[participant.userId] ||
        rules?.affiliate_defaults?.[affiliate.id]?.[participant.role] ||
        'platform_revenue';

      let calculationBase = 0;

      if (basis === 'net_revenue') {
        // Base: Receita líquida do indicado
        switch (participant.role) {
          case 'SELLER':
          case 'SUPPLIER':
            calculationBase = Number(
              order.seller_payout_amount ?? order.seller_amount ?? order.products_subtotal ?? 0
            );
            break;
          case 'COURIER':
            calculationBase = Number(
              order.driver_payout_amount ?? order.driver_amount ?? order.total_delivery_fee ?? 0
            );
            break;
          case 'CLIENT':
            calculationBase = Number(
              order.products_subtotal ?? order.total_amount ?? 0
            );
            break;
        }
      } else {
        // Base: Receita da plataforma gerada pelo participante
        switch (participant.role) {
          case 'SELLER':
          case 'SUPPLIER':
            calculationBase = Number(
              order.platform_sales_fee_amount ?? order.platform_fee_amount ?? 0
            );
            break;
          case 'COURIER':
            calculationBase = Number(
              order.platform_delivery_fee_amount ?? 0
            );
            break;
          case 'CLIENT':
            calculationBase = Number(
              ((order.platform_sales_fee_amount ?? 0) + (order.platform_delivery_fee_amount ?? 0)) ||
              (order.platform_fee_amount ?? 0)
            );
            break;
        }
      }

      calculationBase = Number(calculationBase.toFixed(2));
      if (calculationBase <= 0) continue;

      const affiliateAmount = Number((calculationBase * affiliate.commission_pct).toFixed(2));
      if (affiliateAmount <= 0) continue;

      // Buscar registro de indicação (affiliate_referrals) para bônus de ativação
      const { data: referral } = await supabase
        .from('affiliate_referrals')
        .select('id, bonus_paid, bonus_amount')
        .eq('affiliate_id', affiliate.id)
        .eq('referred_user_id', participant.userId)
        .maybeSingle();

      // Inserir no ledger de comissões
      await supabase.from('affiliate_commission_ledger').insert({
        affiliate_id: affiliate.id,
        order_id: orderId,
        referred_user_id: participant.userId,
        platform_commission: calculationBase,
        affiliate_pct: affiliate.commission_pct,
        affiliate_amount: affiliateAmount,
      });

      let bonusAmount = 0;
      // Bônus da primeira indicação (se houver e ainda não pago)
      if (referral && !referral.bonus_paid && Number(referral.bonus_amount || 0) > 0) {
        bonusAmount = Number(referral.bonus_amount);
        await supabase.from('affiliate_commission_ledger').insert({
          affiliate_id: affiliate.id,
          order_id: orderId,
          referred_user_id: participant.userId,
          platform_commission: 0,
          affiliate_pct: 0,
          affiliate_amount: bonusAmount,
        });

        await supabase
          .from('affiliate_referrals')
          .update({ bonus_paid: true, activated_at: new Date().toISOString() })
          .eq('id', referral.id);
      }

      const totalToCredit = Number((affiliateAmount + bonusAmount).toFixed(2));

      // Incrementar saldo do afiliado
      await supabase.rpc('increment_affiliate_earned', {
        p_affiliate_id: affiliate.id,
        p_amount: totalToCredit,
      });

      console.log(
        `[Affiliate Commission] Creditado R$ ${totalToCredit} para afiliado ${affiliate.id} (Indicado: ${participant.label} ${participant.userId}, Base: ${basis} R$ ${calculationBase}, Pct: ${affiliate.commission_pct})`
      );

      // Se o afiliado configurou modo automático de saque e possui carteira Asaas
      if (affiliate.withdrawal_mode === 'auto' && (affiliate.asaas_wallet_id || affiliate.asaas_subaccount_id)) {
        try {
          const apiKey = await getAsaasApiKey();
          const rawWallet = affiliate.asaas_wallet_id || affiliate.asaas_subaccount_id;
          if (apiKey && rawWallet && totalToCredit > 0) {
            const baseUrl = getAsaasBaseUrl(apiKey);
            await fetch(`${baseUrl}/transfers`, {
              method: 'POST',
              headers: {
                access_token: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                value: totalToCredit,
                walletId: rawWallet,
                description: `Comissão Automática Afiliado AçaíFood - Pedido #${orderId.slice(0, 8)} (${participant.label})`,
              }),
            });
          }
        } catch (autoTransferErr) {
          console.warn('[Affiliate Commission] Falha na transferência automática:', autoTransferErr);
        }
      }
    }
  } catch (error) {
    console.error('[Affiliate Commission] Exceção ao creditar comissão:', error);
  }
}
