import { SupabaseClient } from '@supabase/supabase-js';
import { getAsaasApiKey, getAsaasBaseUrl } from '@/lib/asaasConfig';

/**
 * Processa a comissão e bônus do parceiro afiliado quando um pedido é concluído/entregue (RECEIVED).
 */
export async function creditAffiliateCommission(orderId: string, supabase: SupabaseClient): Promise<void> {
  try {
    // 0. Idempotência: verificar se este pedido já foi creditado no ledger
    const { data: existingLedger } = await supabase
      .from('affiliate_commission_ledger')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (existingLedger && existingLedger.length > 0) {
      return; // Já creditado anteriormente
    }

    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, applied_platform_fee, applied_platform_fee_driver')
      .eq('id', orderId)
      .single();

    if (!order || !order.buyer_id) return;

    const platformCommission = Number(
      ((order.applied_platform_fee ?? 0) + (order.applied_platform_fee_driver ?? 0)).toFixed(2)
    );

    const { data: buyer } = await supabase
      .from('users')
      .select('referred_by_affiliate')
      .eq('id', order.buyer_id)
      .single();

    if (!buyer?.referred_by_affiliate) return;

    const { data: affiliate } = await supabase
      .from('partner_affiliates')
      .select('id, status, commission_pct, commission_months, commission_start, asaas_subaccount_id, asaas_wallet_id, withdrawal_mode')
      .eq('id', buyer.referred_by_affiliate)
      .single();

    if (!affiliate || affiliate.status !== 'active') return;
    if (!affiliate.commission_pct || affiliate.commission_pct <= 0) return;

    // Verificar se o período de comissão ainda está válido
    if (affiliate.commission_start && affiliate.commission_months) {
      const end = new Date(affiliate.commission_start);
      end.setMonth(end.getMonth() + affiliate.commission_months);
      if (new Date() > end) return;
    }

    const affiliateAmount = Number((platformCommission * affiliate.commission_pct).toFixed(2));
    if (affiliateAmount <= 0) return;

    const { data: referral } = await supabase
      .from('affiliate_referrals')
      .select('id, bonus_paid, bonus_amount')
      .eq('affiliate_id', affiliate.id)
      .eq('referred_user_id', order.buyer_id)
      .maybeSingle();

    // Inserir comissão do pedido
    await supabase.from('affiliate_commission_ledger').insert({
      affiliate_id: affiliate.id,
      order_id: orderId,
      referred_user_id: order.buyer_id,
      platform_commission: platformCommission,
      affiliate_pct: affiliate.commission_pct,
      affiliate_amount: affiliateAmount,
    });

    let bonusAmount = 0;
    // Bônus da primeira indicação (se ainda não pago)
    if (referral && !referral.bonus_paid && Number(referral.bonus_amount || 0) > 0) {
      bonusAmount = Number(referral.bonus_amount);
      await supabase.from('affiliate_commission_ledger').insert({
        affiliate_id: affiliate.id,
        order_id: orderId,
        referred_user_id: order.buyer_id,
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

    await supabase.rpc('increment_affiliate_earned', {
      p_affiliate_id: affiliate.id,
      p_amount: totalToCredit,
    });

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
              description: `Comissão Automática Afiliado AçaíFood - Pedido #${orderId.slice(0, 8)}`,
            }),
          });
        }
      } catch (autoTransferErr) {
        console.warn('[Affiliate Commission] Falha na transferência automática:', autoTransferErr);
      }
    }
  } catch (error) {
    console.error('[Affiliate Commission] Exceção ao creditar comissão:', error);
  }
}
