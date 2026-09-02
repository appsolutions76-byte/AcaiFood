import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Monta o body da transferência Asaas detectando o tipo da chave Pix
function buildTransferBody(pixKey: string, value: number, description: string): any {
  const cleanKey = String(pixKey).trim()
  const cleanDigits = cleanKey.replace(/\D/g, '')
  const isWalletId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey)
  const body: any = { value, description }

  if (isWalletId) {
    body.walletId = cleanKey
  } else if (cleanDigits.length === 11) {
    body.pixAddressKey = cleanDigits
    body.pixAddressKeyType = 'CPF'
  } else if (cleanDigits.length === 14) {
    body.pixAddressKey = cleanDigits
    body.pixAddressKeyType = 'CNPJ'
  } else if (cleanKey.includes('@')) {
    body.pixAddressKey = cleanKey.toLowerCase()
    body.pixAddressKeyType = 'EMAIL'
  } else if (cleanDigits.length >= 10 && cleanDigits.length <= 11) {
    body.pixAddressKey = cleanKey.startsWith('+') ? cleanKey : `+55${cleanDigits}`
    body.pixAddressKeyType = 'PHONE'
  } else {
    body.pixAddressKey = cleanKey
    body.pixAddressKeyType = 'EVP'
  }
  return body
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada nos Supabase Secrets')

    const ASAAS_URL = 'https://www.asaas.com/api/v3'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Ler configurações de pagamento da plataforma (modo FIXO vs KM e valores fixos)
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    const courierMode     = settings?.courier_payment_mode     || 'KM'
    const courierFixed    = Number(settings?.courier_fixed_fee    ?? 8.00)
    const transporterMode = settings?.transporter_payment_mode || 'KM'
    const transporterFixed = Number(settings?.transporter_fixed_fee ?? 150.00)
    const ecopointMode    = settings?.ecopoint_payment_mode    || 'KM'
    const ecopointFixed   = Number(settings?.ecopoint_fixed_fee   ?? 50.00)

    console.log(`[payout-sweep] Iniciando varredura (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'})`)
    console.log(`[payout-sweep] Modos: Moto=${courierMode}(R$${courierFixed}), Caminh=${transporterMode}(R$${transporterFixed}), Eco=${ecopointMode}(R$${ecopointFixed})`)

    // 2. Buscar pedidos recentes do Supabase
    const { data: rawOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (fetchError) throw fetchError

    // 3. Filtrar pedidos concluídos com repasses pendentes
    const validStatuses = ['RECEIVED', 'DELIVERED', 'COMPLETED', 'entregue', 'concluido', 'aguardando_cliente']
    const pendingOrders = (rawOrders || []).filter((o: any) => {
      const isCompleted = validStatuses.includes(String(o.status || ''))
      return isCompleted && (o.payout_seller_done !== true || o.payout_driver_done !== true)
    })

    console.log(`[payout-sweep] Pedidos pendentes de repasse: ${pendingOrders.length}`)

    let sellerPayoutsCount  = 0
    let driverPayoutsCount  = 0
    let totalAmountTransferred = 0

    for (const order of pendingOrders) {
      const orderType = String(order.order_type || 'B2C').toUpperCase()

      // ──────────────────────────────────────────────────────────────────
      // BLOCO A: Repasse do Vendedor (Batedeira no B2C / Fornecedor no B2B)
      // ──────────────────────────────────────────────────────────────────
      if (order.payout_seller_done !== true) {
        try {
          // Resolver partner_id via seller_storefront_id → storefronts
          let sellerPartnerId: string | null = null
          if (order.seller_storefront_id) {
            const { data: sf } = await supabase
              .from('storefronts')
              .select('partner_id')
              .eq('id', order.seller_storefront_id)
              .maybeSingle()
            if (sf?.partner_id) sellerPartnerId = sf.partner_id
          }

          if (sellerPartnerId) {
            const { data: uSeller } = await supabase
              .from('users')
              .select('id, name, pix_key, cpf_cnpj, email, asaas_wallet_id')
              .eq('id', sellerPartnerId)
              .maybeSingle()

            // Preferência: CPF/CNPJ → Pix (se não for UUID de walletId) → email → walletId Asaas
            const isUuid = (s?: string) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
            const sellerPixKey =
              uSeller?.cpf_cnpj ||
              (uSeller?.pix_key && !isUuid(uSeller.pix_key) ? uSeller.pix_key : null) ||
              uSeller?.email ||
              uSeller?.asaas_wallet_id

            // Calcular repasse usando a taxa salva no pedido no momento da criação
            const productSubtotal = Number(order.products_subtotal || 0)
            const platformFee     = Number(order.applied_platform_fee_percent ?? 10)
            const sellerValue     = Number((productSubtotal * (1 - platformFee / 100)).toFixed(2))

            if (sellerPixKey && sellerValue > 0) {
              const transferBody = buildTransferBody(
                sellerPixKey,
                sellerValue,
                `Varredura Repasse Venda AçaíFood #${String(order.id).substring(0, 8)}`
              )
              console.log(`[payout-sweep] Seller #${String(order.id).substring(0,8)} → R$ ${sellerValue} (platFee ${platformFee}%)`, transferBody)

              const res = await fetch(`${ASAAS_URL}/transfers`, {
                method: 'POST',
                headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify(transferBody)
              })
              const resData = await res.json()

              // Marcar como pago independentemente do resultado (evita reprocessamento)
              await supabase.from('orders').update({ payout_seller_done: true }).eq('id', order.id)

              const ok = res.ok || resData.id || String(resData.status || '').includes('PENDING') || String(resData.status || '').includes('AUTHORIZATION')
              if (ok) {
                sellerPayoutsCount++
                totalAmountTransferred += sellerValue
                console.log(`✅ Seller repasse R$ ${sellerValue} → ${uSeller?.name || sellerPartnerId}`)
              } else {
                console.warn(`⚠️ Seller repasse falhou (${order.id}):`, resData)
              }
            } else {
              // Mesmo sem chave Pix, marcar para não re-processar indefinidamente
              if (!sellerPixKey) {
                console.warn(`[payout-sweep] Seller sem chave Pix (${sellerPartnerId}), marcando como done`)
                await supabase.from('orders').update({ payout_seller_done: true }).eq('id', order.id)
              }
            }
          } else {
            // Sem storefront → marcar como done para não re-processar
            console.warn(`[payout-sweep] Sem seller_storefront_id para pedido ${order.id}`)
            await supabase.from('orders').update({ payout_seller_done: true }).eq('id', order.id)
          }
        } catch (errSeller) {
          console.warn(`[payout-sweep] Erro seller pedido ${order.id}:`, errSeller)
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // BLOCO B: Repasse do Motorista / Entregador
      // ──────────────────────────────────────────────────────────────────
      const driverId = order.driver_id
      if (order.payout_driver_done !== true && driverId) {
        try {
          const { data: uDriver } = await supabase
            .from('users')
            .select('id, name, pix_key, cpf_cnpj, email, asaas_wallet_id')
            .eq('id', driverId)
            .maybeSingle()

          const isUuid = (s?: string) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
          const driverPixKey =
            uDriver?.cpf_cnpj ||
            (uDriver?.pix_key && !isUuid(uDriver.pix_key) ? uDriver.pix_key : null) ||
            uDriver?.email ||
            uDriver?.asaas_wallet_id

          // Calcular total da entrega respeitando modo de pagamento (FIXO vs KM)
          const distKm       = Number(order.delivery_distance_km || 3)
          const feePerKm     = Number(order.applied_delivery_fee_per_km || 2)
          const platPct      = Number(order.applied_delivery_platform_fee_percent ?? 10)

          let deliveryTotal: number
          if (orderType === 'COLETA') {
            deliveryTotal = ecopointMode === 'FIXED' ? ecopointFixed : distKm * feePerKm
          } else if (orderType === 'B2B') {
            deliveryTotal = transporterMode === 'FIXED' ? transporterFixed : distKm * feePerKm
          } else {
            // B2C (Motoboy)
            deliveryTotal = courierMode === 'FIXED' ? courierFixed : distKm * feePerKm
          }

          const driverValue = Number((deliveryTotal * (1 - platPct / 100)).toFixed(2))

          if (driverPixKey && driverValue > 0) {
            const transferBody = buildTransferBody(
              driverPixKey,
              driverValue,
              `Varredura Repasse Frete AçaíFood #${String(order.id).substring(0, 8)}`
            )
            console.log(`[payout-sweep] Driver #${String(order.id).substring(0,8)} → R$ ${driverValue} (${orderType}, platPct ${platPct}%)`, transferBody)

            const res = await fetch(`${ASAAS_URL}/transfers`, {
              method: 'POST',
              headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify(transferBody)
            })
            const resData = await res.json()

            await supabase.from('orders').update({ payout_driver_done: true }).eq('id', order.id)

            const ok = res.ok || resData.id || String(resData.status || '').includes('PENDING') || String(resData.status || '').includes('AUTHORIZATION')
            if (ok) {
              driverPayoutsCount++
              totalAmountTransferred += driverValue
              console.log(`✅ Driver repasse R$ ${driverValue} → ${uDriver?.name || driverId}`)
            } else {
              console.warn(`⚠️ Driver repasse falhou (${order.id}):`, resData)
            }
          } else if (!driverPixKey) {
            console.warn(`[payout-sweep] Driver sem chave Pix (${driverId}), marcando como done`)
            await supabase.from('orders').update({ payout_driver_done: true }).eq('id', order.id)
          }
        } catch (errDriver) {
          console.warn(`[payout-sweep] Erro driver pedido ${order.id}:`, errDriver)
        }
      } else if (order.payout_driver_done !== true && !driverId) {
        // Pedido sem motorista atribuído (ex: coleta sem entregador) → marcar como done
        await supabase.from('orders').update({ payout_driver_done: true }).eq('id', order.id)
      }
    }

    const summary = {
      success: true,
      processedOrders: pendingOrders.length,
      sellerPayoutsCount,
      driverPayoutsCount,
      totalAmountTransferred
    }
    console.log('[payout-sweep] Concluído:', summary)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[payout-sweep] Erro fatal:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
