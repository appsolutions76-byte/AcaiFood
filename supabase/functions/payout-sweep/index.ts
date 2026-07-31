import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada nos Supabase Secrets')
    }

    const ASAAS_ENV = Deno.env.get('ASAAS_ENVIRONMENT') || 'production'
    const isSandbox = ASAAS_ENV === 'sandbox' || ASAAS_API_KEY.includes('hmlg')
    const ASAAS_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Iniciando Varredura Noturna de Repasses Pix (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'})...`)

    // 1. Buscar todos os pedidos concluídos onde pelo menos um repasse está pendente
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_storefront_id, driver_id, status, products_subtotal, order_type, payout_seller_done, payout_driver_done, received_at, delivered_at')
      .or('payout_seller_done.eq.false,payout_driver_done.eq.false')
      .in('status', ['RECEIVED', 'DELIVERED'])
      .limit(100)

    if (fetchError) {
      console.error('Erro ao buscar pedidos pendentes no Supabase:', fetchError)
      throw fetchError
    }

    let sellerPayoutsCount = 0
    let driverPayoutsCount = 0
    let totalAmountTransferred = 0

    if (pendingOrders && pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        // 2. Resolver Repasse do Vendedor se pendente
        if (!order.payout_seller_done && order.seller_storefront_id) {
          try {
            const { data: sf } = await supabase
              .from('storefronts')
              .select('partner_id')
              .eq('id', order.seller_storefront_id)
              .maybeSingle()

            const sellerPartnerId = sf?.partner_id
            if (sellerPartnerId) {
              const { data: uSeller } = await supabase
                .from('users')
                .select('id, name, email, pix_key, cpf_cnpj, asaas_wallet_id')
                .eq('id', sellerPartnerId)
                .maybeSingle()

              const sellerPixKey = uSeller?.asaas_wallet_id || uSeller?.pix_key || uSeller?.cpf_cnpj || uSeller?.email
              
              const sellerValue = Number(((order.products_subtotal || 0) * 0.9).toFixed(2))

              if (sellerPixKey && sellerValue > 0) {
                const cleanKey = String(sellerPixKey).trim()
                const cleanDigits = cleanKey.replace(/\D/g, '')
                const isWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey) || (cleanKey.length >= 20 && !cleanKey.match(/^\d+$/))

                const transferBody: any = {
                  value: sellerValue,
                  description: `Varredura Repasse Venda AçaíFood #${String(order.id).substring(0, 8)}`
                }

                if (isWalletId) {
                  transferBody.walletId = cleanKey
                } else if (cleanDigits.length === 11) {
                  transferBody.pixAddressKey = cleanDigits
                  transferBody.pixAddressKeyType = 'CPF'
                } else if (cleanDigits.length === 14) {
                  transferBody.pixAddressKey = cleanDigits
                  transferBody.pixAddressKeyType = 'CNPJ'
                } else if (cleanKey.includes('@')) {
                  transferBody.pixAddressKey = cleanKey.toLowerCase()
                  transferBody.pixAddressKeyType = 'EMAIL'
                } else {
                  transferBody.pixAddressKey = cleanKey
                  transferBody.pixAddressKeyType = 'EVP'
                }

                const res = await fetch(`${ASAAS_URL}/transfers`, {
                  method: 'POST',
                  headers: {
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(transferBody)
                })

                const resData = await res.json()
                if (res.ok && (resData.id || resData.status === 'DONE' || resData.status === 'PENDING')) {
                  await supabase.from('orders').update({ payout_seller_done: true }).eq('id', order.id)
                  sellerPayoutsCount++
                  totalAmountTransferred += sellerValue
                  console.log(`✅ Varredura: Repasse de R$ ${sellerValue} enviado à loja ${uSeller?.name || sellerPartnerId}`)
                } else {
                  console.warn(`Alerta varredura loja (${order.id}):`, resData)
                }
              }
            }
          } catch (errSeller) {
            console.warn(`Erro varredura vendedor pedido ${order.id}:`, errSeller)
          }
        }

        // 3. Resolver Repasse do Motorista se pendente
        if (!order.payout_driver_done && order.driver_id) {
          try {
            const { data: uDriver } = await supabase
              .from('users')
              .select('id, name, email, pix_key, cpf_cnpj, asaas_wallet_id')
              .eq('id', order.driver_id)
              .maybeSingle()

            const driverPixKey = uDriver?.asaas_wallet_id || uDriver?.pix_key || uDriver?.cpf_cnpj || uDriver?.email
            const driverValue = 8.00

            if (driverPixKey && driverValue > 0) {
              const cleanKey = String(driverPixKey).trim()
              const cleanDigits = cleanKey.replace(/\D/g, '')
              const isWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey) || (cleanKey.length >= 20 && !cleanKey.match(/^\d+$/))

              const transferBody: any = {
                value: driverValue,
                description: `Varredura Repasse Frete AçaíFood #${String(order.id).substring(0, 8)}`
              }

              if (isWalletId) {
                transferBody.walletId = cleanKey
              } else if (cleanDigits.length === 11) {
                transferBody.pixAddressKey = cleanDigits
                transferBody.pixAddressKeyType = 'CPF'
              } else if (cleanDigits.length === 14) {
                transferBody.pixAddressKey = cleanDigits
                transferBody.pixAddressKeyType = 'CNPJ'
              } else if (cleanKey.includes('@')) {
                transferBody.pixAddressKey = cleanKey.toLowerCase()
                transferBody.pixAddressKeyType = 'EMAIL'
              } else {
                transferBody.pixAddressKey = cleanKey
                transferBody.pixAddressKeyType = 'EVP'
              }

              const res = await fetch(`${ASAAS_URL}/transfers`, {
                method: 'POST',
                headers: {
                  'access_token': ASAAS_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferBody)
              })

              const resData = await res.json()
              if (res.ok && (resData.id || resData.status === 'DONE' || resData.status === 'PENDING')) {
                await supabase.from('orders').update({ payout_driver_done: true }).eq('id', order.id)
                driverPayoutsCount++
                totalAmountTransferred += driverValue
                console.log(`✅ Varredura: Repasse de R$ ${driverValue} enviado ao entregador ${uDriver?.name || order.driver_id}`)
              } else {
                console.warn(`Alerta varredura motorista (${order.id}):`, resData)
              }
            }
          } catch (errDriver) {
            console.warn(`Erro varredura motorista pedido ${order.id}:`, errDriver)
          }
        }
      }
    }

    console.log(`🏁 Varredura concluída: ${sellerPayoutsCount} repasses de loja, ${driverPayoutsCount} repasses de entregador. Total: R$ ${totalAmountTransferred.toFixed(2)}`)

    return new Response(
      JSON.stringify({
        success: true,
        processedOrders: pendingOrders ? pendingOrders.length : 0,
        sellerPayoutsCount,
        driverPayoutsCount,
        totalAmountTransferred: Number(totalAmountTransferred.toFixed(2))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erro na Edge Function payout-sweep:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
