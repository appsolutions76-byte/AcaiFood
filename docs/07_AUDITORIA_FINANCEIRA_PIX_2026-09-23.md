# AçaíFood — Sétima Auditoria: financeiro e "Pix sendo rejeitado" (23/09/2026, noite)

**Escopo:** código alterado hoje (23/09, das ~12h às 23h) em `apps/mobile/src` e `supabase/`, com foco em cobrança Pix, confirmação de pagamento, saques e segurança do dinheiro. Nenhum arquivo de código foi alterado.
**Método:** leitura do código. O banco de produção e os painéis do Asaas e da Vercel não foram acessados, então os itens 🗄️/⚙️ precisam ser conferidos lá.

---

## 1. Causa do "Pix rejeitado": o QR Code não é o da cobrança Asaas

Hoje o `/api/asaas/checkout` **cria a cobrança no Asaas corretamente**, mas **não entrega ao cliente o Pix dessa cobrança**. No lugar dela, o servidor monta um **Pix estático próprio** (`lib/pix.ts → generateValidPixPayload`) com:

- chave `NEXT_PUBLIC_PLATFORM_PIX_KEY` ou, se não existir, o **CNPJ 42.035.623/0001-40** (Eletromecânica Baia);
- nome "ELETROMECANICA BAIA LTDA", cidade "Portel";
- `txId = '***'` (sem identificação do pedido).

O `PixModal` desenha esse código num site externo (`api.qrserver.com`). O app do cliente (`useAppStore.criarPedido`) ainda tem um **segundo Pix estático de reserva**, usado quando o checkout falha.

**O que isso causa, em ordem de probabilidade:**

| Sintoma | Por quê |
|---|---|
| Banco do cliente recusa: "chave não encontrada" | Se `NEXT_PUBLIC_PLATFORM_PIX_KEY` na Vercel for `suporte@acaifood.app.br` (o valor do `.env.example`) ou outra chave não cadastrada no DICT, o Pix é recusado na hora ⚙️ |
| Cliente paga, mas o pedido fica "aguardando pagamento" para sempre | O Pix estático cai direto na conta dona da chave, **não quita a cobrança do Asaas**. Sem cobrança paga não vem webhook, `/api/asaas/status` diz "pendente" e a loja nunca recebe o pedido |
| Dinheiro fora do Asaas | Se a chave (o CNPJ) estiver em outro banco, o dinheiro vai para lá. A conta Asaas fica sem saldo, e isso também explica **saques (transferências) sendo recusados por saldo insuficiente** |
| Estorno impossível | `/api/asaas/refund` estorna a cobrança do Asaas, que nunca foi paga |
| Pedido fantasma | Se o checkout falha, o app cria um pedido local `PED-###` (que não existe no banco) e mostra o Pix estático: o cliente paga por um pedido que não existe |

**Como deve ser** ([documentação Asaas](https://docs.asaas.com/docs/cobrancas-via-pix)): depois de criar a cobrança `billingType: PIX`, chamar `GET /v3/payments/{id}/pixQrCode` e mostrar o `payload` (copia-e-cola) e o `encodedImage` (QR) que o Asaas devolve. Esse QR é **dinâmico e amarrado à cobrança**: quando é pago, o Asaas quita a cobrança e dispara o webhook. É o que o código fazia até 22/09 e foi trocado hoje.

**Hipótese para a troca** (confirmar no painel Asaas ⚙️): a geração do QR pelo Asaas falhava. Causas comuns: conta sem chave Pix cadastrada no Asaas (a própria documentação avisa que tentar pagar QR de conta sem chave dá erro), conta ainda sem aprovação para cobrar, ou chave de API de um ambiente (sandbox) e URL de outro. O remédio é resolver isso no Asaas, não trocar por Pix estático.

### Problemas ligados ao mesmo trecho

- **CNPJ da empresa usado como CPF de todo cliente.** Quando o cliente não tem CPF, o checkout cadastra o cliente no Asaas com o **CNPJ da plataforma** e o e-mail `appsolutions76@gmail.com`. Isso mistura todos os clientes num cadastro só, não identifica quem pagou (problema fiscal e de KYC) e ainda pode ser barrado pelo Asaas.
- **O checkout aceita chamada sem login.** O resultado de `authorizeRequest` é ignorado, `buyerId` vem do corpo da requisição e a rota cria usuário, loja e pedido com service_role. Subtotal, distância e itens também vêm do celular.

---

## 2. Críticos novos (surgiram hoje)

**N1. Qualquer pessoa vira qualquer usuário, inclusive admin, com um header.** `lib/apiAuth.ts` ganhou o "passo 2.5": se a requisição traz `x-user-id: <id>`, o servidor busca esse usuário e **autoriza como se fosse ele**, sem senha nem token. Com o id de um admin, que aparece em pedidos e lojas, dá para aprovar saques, rodar o `sweep?force=true`, apagar a base (`clear-data`) e excluir usuários. O app manda esse header em `getAuthHeaders()`.
→ Remover o passo 2.5 e o header do app. Aceitar só JWT do Supabase.

**N2. A chave de API do Asaas pode estar visível para qualquer usuário logado** 🗄️. `getAsaasApiKey()` lê primeiro `platform_settings.asaas_api_key`, e a policy dessa tabela libera SELECT para qualquer `authenticated`. O app faz `select('*')` nela no login (`fetchRates`). Se a chave está gravada nessa coluna, **qualquer usuário consegue a chave de produção do Asaas** (e com ela, fazer transferências).
→ Conferir hoje se a coluna está preenchida. Se estiver: **gerar uma nova chave no Asaas**, guardar só em variável de ambiente/Vault, apagar a coluna e restringir o SELECT de `platform_settings` às colunas públicas.

**N3. Os segredos fixos do webhook continuam aceitos.** `isValidAsaasWebhook` aceita `acaifood_webhook_2026` **e mais um novo literal** (`acaifood_webhook_secret_token_2026_prod`), por header ou `?wh_token=`. Com eles, qualquer pessoa marca pedido como pago pelo POST de `/api/asaas/status`. (Melhora: o token não dá mais acesso às rotas admin.)

**N4. Usuário bloqueado se desbloqueia sozinho.** `/api/user/status` agora exige login (melhora), mas permite que o próprio usuário envie `status: 'active'` para si. Como grava com service_role, isso fura o trigger que impede a autorreativação.

---

## 3. Saques (Pix de saída) sendo recusados: causas no código

1. **Duas chaves Asaas diferentes.** A cobrança usa `getAsaasApiKey()` (banco → Vault → env) com `api.asaas.com/v3`. O saque (`withdrawalApproval`) usa **só** `process.env.ASAAS_API_KEY` com `www.asaas.com/api/v3` e `ASAAS_ENVIRONMENT`. Se as duas chaves forem de contas ou ambientes diferentes, o saque sai de uma conta sem saldo ou do ambiente errado ⚙️.
2. **Saldo insuficiente**, consequência do item 1: o dinheiro dos clientes não está entrando no Asaas.
3. **Tipo de chave Pix adivinhado.** `detectPixKeyType` trata qualquer chave de 11 dígitos como **CPF**, então celular sem "+55" (ex.: 91987654321) é enviado como CPF e o Asaas recusa. Uma chave aleatória (UUID) com 11 ou 14 dígitos numéricos também pode cair em CPF/CNPJ.
4. **Autorização de transferência no Asaas** ⚙️: contas Asaas podem exigir autorização extra para transferências feitas por API (token de ação crítica, IP liberado ou webhook de validação de saque). Sem isso, a transferência fica aguardando ou é recusada. Conferir em Minha Conta → Integrações/Segurança.
5. A mensagem de erro do Asaas já é gravada em `withdrawal_requests.failure_reason`. **Consultar essa coluna** é o caminho mais rápido para ver o motivo exato de cada recusa.

---

## 4. O que mudou hoje e melhorou

| Item | Situação |
|---|---|
| A2 saldo só de pedidos entregues com PIN | ✅ corrigido (`partnerBalance` só conta `DELIVERED/RECEIVED/COMPLETED`) |
| A8 `/api/user/status` sem login | ✅ exige login (resta o N4) |
| Token do webhook como acesso admin | ✅ removido de `authorizeRequest` (resta o N3) |
| B1 cron com GET | ✅ a rota `sweep` aceita GET (confirmar nos logs se o header `x-vercel-cron` chega ⚙️) |
| `debug-orders` | ✅ desativada |
| PIN de retirada (`pickup_pin` + `check_pickup_pin`) | Novo. Funciona, mas repete os defeitos do PIN de entrega: texto puro, visível no radar, `p_operator_id` vindo do app |
| `link-wallet` | Parcial: consulta o status da conta no Asaas antes de gravar, mas continua aberto ao próprio usuário |

## 5. Continuam abertos da Sexta Auditoria

A1 (split + saque = pagar em dobro; `partnerBalance` não exclui pedidos com split), A4 (qualquer CPF passa como "subconta ativa" no saque), A5 (webhook não confere o valor pago), A6 (UPDATE livre em `orders`), A7 (`transition_order_status` sem validação), A9 (PIN visível no radar), A10 (valores e distância vindos do celular), B2–B7, C1–C9. O plano de correção R8 (`06_PROMPT_CORRECOES_R8.md`) continua válido. **Antes dele, aplicar o hotfix R9** (`08_PROMPT_HOTFIX_R9_PIX.md`).

---

## 6. Para o Fredson conferir hoje (sem código)

1. **Asaas → Pix → Minhas chaves:** existe chave cadastrada **na conta Asaas**? Se não, cadastre uma chave aleatória.
2. **Vercel → Environment Variables:** qual é o valor de `NEXT_PUBLIC_PLATFORM_PIX_KEY`? Essa chave está cadastrada em qual banco? `ASAAS_API_KEY` e `ASAAS_ENVIRONMENT` são de **produção** e da **mesma conta** usada nas cobranças?
3. **Supabase → `platform_settings`:** a coluna `asaas_api_key` está preenchida? Se sim, trate a chave como vazada e gere outra no Asaas.
4. **Extrato da conta dona da chave Pix (Asaas ou outro banco):** Pix recebidos de clientes nos últimos dias que não aparecem como cobrança paga. Esses pedidos estão travados em "aguardando pagamento" e o dinheiro precisa ser conciliado manualmente.
5. **Supabase → `withdrawal_requests`** com status `FALHOU`: leia `failure_reason` para saber o motivo exato das recusas de saque.

Fontes: [Asaas — Cobranças via Pix / QR Code dinâmico](https://docs.asaas.com/docs/cobrancas-via-pix), [Asaas — Obter QR Code para pagamentos via Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix), [Asaas — QR Code sem chave cadastrada = erro 404](https://docs.asaas.com/docs/tentar-pagar-qr-code-pix-no-sandbox-sem-chave-cadastrada-erro-404)
