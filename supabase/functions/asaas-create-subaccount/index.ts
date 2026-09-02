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
    const {
      userId,     // UUID do usuário já salvo no Supabase
      name,       // Nome ou Razão Social
      email,      // E-mail
      cpfCnpj,    // CPF ou CNPJ (apenas dígitos)
      phone,      // Telefone (apenas dígitos)
      endereco,   // Endereço completo
      bairro,     // Bairro
      cidade,     // Cidade
      role,       // 'PARTNER' | 'SUPPLIER' | 'COURIER'
    } = await req.json()

    if (!userId || !name || !email || !cpfCnpj) {
      return new Response(
        JSON.stringify({ error: 'userId, name, email e cpfCnpj são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada nos Supabase Secrets')
    }

    const ASAAS_URL = 'https://www.asaas.com/api/v3'
    console.log(`Criando sub-conta Asaas (PRODUÇÃO) para: ${name} (${role})`)

    // Limpa e prepara dados
    const cleanCpfCnpj = String(cpfCnpj).replace(/\D/g, '')
    const cleanPhone = String(phone || '').replace(/\D/g, '')

    // Extrai número do endereço (ex: "Rua das Flores, 123" → "123")
    const addressMatch = (endereco || '').match(/,?\s*(\d+[^\s,]*)/)
    const addressNumber = addressMatch ? addressMatch[1] : 'S/N'
    const addressStreet = (endereco || '').replace(/,?\s*\d+[^\s,]*/, '').trim() || endereco

    // Monta payload da sub-conta Asaas
    // Documentação: https://docs.asaas.com/reference/criar-subconta
    const isCpf = cleanCpfCnpj.length === 11
    const accountPayload: any = {
      name: name,
      email: email,
      cpfCnpj: cleanCpfCnpj,
      companyType: !isCpf ? 'MEI' : undefined, // CNPJ = MEI por padrão
      phone: cleanPhone || undefined,
      mobilePhone: cleanPhone || undefined,
      address: addressStreet || undefined,
      addressNumber: addressNumber,
      province: bairro || undefined,
      city: cidade || 'Belém',
      state: 'PA',
      country: 'Brasil',
      postalCode: '66015000', // CEP válido de Belém (Centro)
      birthDate: isCpf ? '1990-01-01' : undefined, // Exigido para CPF
      incomeValue: isCpf ? 3000 : undefined,      // Exigido para CPF
    }

    // Remove campos undefined
    Object.keys(accountPayload).forEach(k => {
      if (accountPayload[k] === undefined) delete accountPayload[k]
    })

    const accountRes = await fetch(`${ASAAS_URL}/accounts`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(accountPayload)
    })

    const accountData = await accountRes.json()
    console.log('Resposta Asaas sub-conta:', JSON.stringify(accountData))

    if (!accountData.walletId && !accountData.id) {
      const errMsg = accountData.errors
        ? accountData.errors.map((e: any) => e.description).join(', ')
        : (accountData.message || JSON.stringify(accountData))
      throw new Error(`Falha ao criar sub-conta Asaas: ${errMsg}`)
    }

    const walletId = accountData.walletId
    const accountId = accountData.id
    const apiKey = accountData.apiKey // Chave da sub-conta (para uso futuro)

    // Salva walletId e accountId no banco (service role bypassa RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabase
      .from('users')
      .update({
        asaas_wallet_id: walletId,
        asaas_account_id: accountId,
        asaas_account_status: 'APPROVED',
        split_enabled: true,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Erro ao salvar walletId no Supabase:', updateError)
      // Não falha — retorna os dados para o cliente salvar via fallback
    }

    console.log(`✅ Sub-conta Asaas criada com sucesso! walletId: ${walletId} | userId: ${userId}`)

    return new Response(
      JSON.stringify({
        success: true,
        walletId,
        accountId,
        apiKey,      // Chave da sub-conta (armazenar com segurança se necessário)
        isSandbox,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erro na Edge Function asaas-create-subaccount:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
