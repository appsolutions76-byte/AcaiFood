# Prompt — Hotfix R9: Pix da cobrança + brechas críticas (AçaíFood)

> Base: `docs/07_AUDITORIA_FINANCEIRA_PIX_2026-09-23.md`. Vem **antes** do R8. Cole no Antigravity a partir de "Contexto".

---

## Contexto

O AçaíFood está **no ar, em operação, com dinheiro real**. Clientes estão com o **Pix recusado** ou pagando sem o pedido ser confirmado. A causa está em `api/asaas/checkout/route.ts`: a rota cria a cobrança no Asaas, mas devolve ao cliente um **Pix estático** montado por `lib/pix.ts` (chave `NEXT_PUBLIC_PLATFORM_PIX_KEY` ou o CNPJ da empresa, `txId '***'`), em vez do Pix **da cobrança**. Esse Pix não quita a cobrança, então não vem webhook e o pedido trava. Leia `docs/07_...` antes de começar.

## Regras (obrigatórias)

1. **O app não pode parar.** Cada item é um deploy separado, testado antes no preview da Vercel apontando para o **Asaas sandbox**, e verificado em produção logo depois com um pedido real de valor baixo (pagar, ver virar `PAID` sozinho, estornar).
2. **Rollback pronto:** anote o deploy anterior da Vercel ("Instant Rollback") antes de cada publicação. Migration só com backup/PITR confirmado e SQL de reversão em `supabase/rollback/`.
3. Código em inglês, telas em PT-BR. Nada de segredo, chave Pix, CNPJ ou e-mail fixo no código.
4. Ao fim de cada item: o que mudou, como foi testado, o resultado da verificação em produção. **Pare e espere aprovação antes do próximo.**

---

## Item 1 — Pix da cobrança Asaas (URGENTE)

**Pré-condição (o dono do produto confirma no painel Asaas):** a conta está aprovada, tem **chave Pix cadastrada no Asaas**, e a chave de API usada no servidor é de **produção**, da mesma conta. Faça antes uma chamada de teste em produção: criar uma cobrança Pix de R$ 1,00 e chamar `GET /v3/payments/{id}/pixQrCode`; se der erro, **pare e reporte a mensagem do Asaas** (não contorne com Pix estático).

1. Em `api/asaas/checkout/route.ts`, depois de criar a cobrança (e também no caminho "cobrança já existente"): chamar `GET {ASAAS_URL}/payments/{paymentId}/pixQrCode` e devolver `pixCopiaECola = payload` e `pixQrCode = encodedImage` (base64). Se o Asaas não devolver o QR, responder **erro 502** com a mensagem do Asaas (o app mostra "Não foi possível gerar o Pix, tente novamente"), **nunca** um Pix alternativo.
2. Remover do checkout e do app (`useAppStore.criarPedido`, "Fallback Pix estático") **todo uso** de `generateValidPixPayload`, de `NEXT_PUBLIC_PLATFORM_PIX_KEY` e do CNPJ `42035623000140`. Se o checkout falhar, o app **não cria pedido local `PED-###`** nem mostra Pix: mostra o erro e mantém o carrinho.
3. `PixModal`: usar o `encodedImage` do Asaas como imagem (remover `api.qrserver.com`). Manter o link `invoiceUrl` do Asaas como alternativa ("Abrir fatura").
4. **CPF do cliente:** o Asaas exige CPF/CNPJ do pagador para Pix. Se o cliente não tiver CPF válido (`validateCpfCnpjDigits`), o app pede o CPF no carrinho antes de pagar, grava no perfil e envia. **Nunca** usar o CNPJ da empresa nem `appsolutions76@gmail.com` como dado de cliente. Clientes antigos já cadastrados no Asaas com o CNPJ da empresa: na próxima compra, criar um customer novo com os dados reais.
5. Testes: B2C, B2B e Coleta no sandbox (pagar o QR pelo simulador do Asaas → webhook → `PAID`), cobrança já existente devolve o mesmo QR, estorno funciona. Em produção: um pedido real de R$ 1–5 pago e estornado.

## Item 2 — Conciliar os pedidos pagos por Pix estático

Clientes que pagaram o Pix estático têm pedidos travados em "aguardando pagamento", e o dinheiro está na conta dona da chave.

1. Criar uma tela no admin, "Pagamentos a conciliar": lista os pedidos `PENDING` com `asaas_payment_id` criados desde 23/09, com valor, cliente, telefone e data.
2. Ação **"Confirmar pagamento recebido fora do Asaas"**, só para admin: exige o ID/E2E do Pix e o valor; grava `paid_at`, `payment_reconciled_manually = true`, quem confirmou e o comprovante em `incident_logs`; **cancela a cobrança pendente no Asaas** (`DELETE /v3/payments/{id}`) para não ser paga duas vezes; e muda o pedido para `PAID` via service_role, gerando o PIN.
3. Pedidos conciliados assim **não entram em split nem saque automático**; o repasse ao parceiro é manual e registrado.
4. Ação **"Cancelar e devolver"**, para o cliente que desistiu: cancela o pedido e registra que a devolução foi feita manualmente pelo admin.

## Item 3 — Fechar as brechas críticas (um deploy por subitem)

1. **`x-user-id`:** remover o "passo 2.5" de `authorizeRequest` e o envio de `x-user-id`/`x-user-role` em `getAuthHeaders()`. **Ordem segura:** primeiro publicar o app garantindo que toda chamada envia `Authorization: Bearer <jwt>` (conferir `getAuthHeaders` e todos os `fetch('/api/...')`); acompanhar 24 h nos logs quantas requisições chegam só com `x-user-id`; quando zerar, remover o passo 2.5.
2. **Checkout exige login:** `if (!auth.authorized) return 401`; `buyer_id` sempre = usuário do JWT (ignorar `buyerId` do corpo); não criar usuário nem loja dentro do checkout.
3. **Webhook:** remover os literais `acaifood_webhook_2026` e `acaifood_webhook_secret_token_2026_prod` e o `?wh_token=`. **Antes:** confirmar no painel Asaas qual token e qual URL estão cadastrados e que `ASAAS_WEBHOOK_TOKEN` na Vercel/Supabase é igual. Se o Asaas usa um dos literais, trocar primeiro no Asaas + env (aceitando o antigo por 48 h via `ASAAS_WEBHOOK_TOKEN_PREVIOUS`) e só depois remover. Nos dois webhooks, só marcar `PAID` se `payment.value` for igual ao valor cobrado gravado (`orders.charged_amount`, coluna nova preenchida pelo checkout; pedidos antigos sem a coluna seguem como hoje).
4. **Chave Asaas no banco:** se `platform_settings.asaas_api_key` estiver preenchida, o dono do produto gera uma nova chave no Asaas. O agente passa a ler a chave **só** de `ASAAS_API_KEY` (env) / Vault, apaga o valor da coluna e faz `REVOKE SELECT ON platform_settings FROM authenticated` + `GRANT SELECT (<colunas públicas de taxas>)`. Conferir que `fetchRates` continua funcionando (trocar `select('*')` pelas colunas públicas **antes** do REVOKE).
5. **Autodesbloqueio:** em `/api/user/status`, se o usuário atual está `blocked` ou `paused` por admin, ele não pode mudar o próprio `status`; só `is_online`.

## Item 4 — Saques (Pix de saída)

1. `withdrawalApproval` e `transfer` usam a **mesma** função `getAsaasApiKey()`/`getAsaasBaseUrl()` da cobrança (uma conta, um ambiente). Logar no início: ambiente e os últimos 4 caracteres da chave.
2. Antes de transferir, consultar `GET /v3/finance/balance` e falhar com a mensagem "Saldo insuficiente na conta Asaas" se não houver saldo.
3. **Tipo da chave Pix:** gravar `pix_key_type` (CPF, CNPJ, EMAIL, PHONE, EVP) escolhido pelo parceiro no perfil, com validação (CPF/CNPJ com dígito verificador, telefone no formato `+55DDDNUMERO`, EVP como UUID). `detectPixKeyType` só como sugestão na tela, nunca para decidir o envio.
4. Ler a resposta do `POST /transfers`: tratar `status` `PENDING`/`BANK_PROCESSING` como "em processamento" (não como falha) e ouvir o webhook `TRANSFER_*` para marcar `PAGO` ou `FALHOU` de fato.
5. Não mudar ainda o modelo de repasse (isso é a Etapa 3 do R8). Manter o pagamento automático **desligado** até lá.

## Critério de aceite do hotfix

- 10 pedidos reais seguidos pagos pelo QR do Asaas viram `PAID` sozinhos, sem ação manual.
- Não existe no código Pix estático, chave/CNPJ/e-mail fixos, `x-user-id` como autenticação ou literal de webhook.
- Todo pedido travado desde 23/09 foi conciliado ou devolvido pela tela do Item 2.
- Um saque de teste de R$ 1,00 para uma chave de cada tipo (CPF, telefone, e-mail, aleatória) chega ao destino.
