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

    // 1. Buscar últimos 200 pedidos do Supabase
    const { data: rawOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (fetchError) {
      console.error('Erro ao buscar pedidos no Supabase:', fetchError)
      throw fetchError
    }

    // Filtrar pedidos concluídos com repasses pendentes
    const validStatuses = ['RECEIVED', 'DELIVERED', 'COMPLETED', 'entregue', 'concluido', 'aguardando_cliente']
    const pendingOrders = (rawOrders || []).filter((o: any) => {
      const isCompleted = validStatuses.includes(String(o.status || ''))
      const sellerPending = o.payout_seller_done !== true
      const driverPending = o.payout_driver_done !== true
      return isCompleted && (sellerPending || driverPending)
    })

    console.log(`Pedidos pendentes de repasse encontrados: ${pendingOrders.length}`)

    let sellerPayoutsCount = 0
    let driverPayoutsCount = 0
    let totalAmountTransferred = 0

    if (pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        // 2. Resolver Repasse do Vendedor (Loja no B2C ou Fornecedor no B2B)
        if (order.payout_seller_done !== true) {
          try {
            const isB2B = String(order.order_type || '').toUpperCase() === 'B2B'
            let sellerPartnerId = isB2B ? (order.fornecedor_id || order.seller_id) : (order.loja_id || order.seller_id)

            if (!sellerPartnerId && order.seller_storefront_id) {
              const { data: sf } = await supabase
                .from('storefronts')
                .select('partner_id')
                .eq('id', order.seller_storefront_id)
                .maybeSingle()
              if (sf?.partner_id) {
                sellerPartnerId = sf.partner_id
              }
            }

            if (!sellerPartnerId) {
              sellerPartnerId = order.fornecedor_id || order.loja_id || order.origem_id || order.partner_id
            }

            if (sellerPartnerId) {
              const { data: uSeller } = await supabase
                .from('users')
                .select('id, name, email, pix_key, cpf_cnpj, asaas_wallet_id')
                .eq('id', sellerPartnerId)
                .maybeSingle()

              const isRealUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
              const sellerPixKey = isRealUuid(uSeller?.asaas_wallet_id) ? uSeller?.asaas_wallet_id : (uSeller?.cpf_cnpj || uSeller?.pix_key || uSeller?.email || uSeller?.asaas_wallet_id)
              
              const sellerValue = Number(((order.products_subtotal || order.subtotal || order.total || 0) * 0.9).toFixed(2))

              if (sellerPixKey && sellerValue > 0) {
                const cleanKey = String(sellerPixKey).trim()
                const cleanDigits = cleanKey.replace(/\D/g, '')
                const isWalletId = isRealUuid(cleanKey)

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
                } else if (cleanDigits.length >= 10 && cleanDigits.length <= 11) {
                  transferBody.pixAddressKey = cleanKey.startsWith('+') ? cleanKey : `+55${cleanDigits}`
                  transferBody.pixAddressKeyType = 'PHONE'
                } else {
                  transferBody.pixAddressKey = cleanKey
                  transferBody.pixAddressKeyType = 'EVP'
                }

                console.log(`Disparando repasse Loja/Fornecedor #${order.id.substring(0,8)} (R$ ${sellerValue}) ->`, transferBody)

                const res = await fetch(`${ASAAS_URL}/transfers`, {
                  method: 'POST',
                  headers: {
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(transferBody)
                })

                const resData = await res.json()
                const isSuccess = res.ok && (resData.id || resData.status === 'DONE' || resData.status === 'PENDING' || String(resData.status || '').includes('AUTHORIZATION') || String(resData.status || '').includes('PENDING'))
                if (isSuccess) {
                  await supabase.from('orders').update({ payout_seller_done: true }).eq('id', order.id)
                  sellerPayoutsCount++
                  totalAmountTransferred += sellerValue
                  console.log(`✅ Varredura: Repasse de R$ ${sellerValue} enviado ao parceiro ${uSeller?.name || sellerPartnerId}`)
                } else {
                  console.warn(`Alerta varredura loja (${order.id}):`, resData)
                }
              }
            }
          } catch (errSeller) {
            console.warn(`Erro varredura vendedor pedido ${order.id}:`, errSeller)
          }
        }

        // 3. Resolver Repasse do Motorista
        const driverId = order.driver_id || order.motorista_id
        if (order.payout_driver_done !== true && driverId) {
          try {
            const { data: uDriver } = await supabase
              .from('users')
              .select('id, name, email, pix_key, cpf_cnpj, asaas_wallet_id')
              .eq('id', driverId)
              .maybeSingle()

            const isRealUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            const driverPixKey = isRealUuid(uDriver?.asaas_wallet_id) ? uDriver?.asaas_wallet_id : (uDriver?.cpf_cnpj || uDriver?.pix_key || uDriver?.email || uDriver?.asaas_wallet_id)
            const driverValue = Number((order.freight_price || order.frete || 8.00).toFixed(2))

            if (driverPixKey && driverValue > 0) {
              const cleanKey = String(driverPixKey).trim()
              const cleanDigits = cleanKey.replace(/\D/g, '')
              const isWalletId = isRealUuid(cleanKey)

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
              } else if (cleanDigits.length >= 10 && cleanDigits.length <= 11) {
                transferBody.pixAddressKey = cleanKey.startsWith('+') ? cleanKey : `+55${cleanDigits}`
                transferBody.pixAddressKeyType = 'PHONE'
              } else {
                transferBody.pixAddressKey = cleanKey
                transferBody.pixAddressKeyType = 'EVP'
              }

              console.log(`Disparando repasse Motorista #${order.id.substring(0,8)} (R$ ${driverValue}) ->`, transferBody)

              const res = await fetch(`${ASAAS_URL}/transfers`, {
                method: 'POST',
                headers: {
                  'access_token': ASAAS_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferBody)
              })

              const resData = await res.json()
              const isDriverSuccess = res.ok && (resData.id || resData.status === 'DONE' || resData.status === 'PENDING' || String(resData.status || '').includes('AUTHORIZATION') || String(resData.status || '').includes('PENDING'))
              if (isDriverSuccess) {
                await supabase.from('orders').update({ payout_driver_done: true }).eq('id', order.id)
                driverPayoutsCount++
                totalAmountTransferred += driverValue
                console.log(`✅ Varredura: Repasse de R$ ${driverValue} enviado ao entregador ${uDriver?.name || driverId}`)
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

    return new Response(
      JSON.stringify({
        success: true,
        processedOrders: pendingOrders.length,
        sellerPayoutsCount,
        driverPayoutsCount,
        totalAmountTransferred
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro na Varredura Noturna:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
