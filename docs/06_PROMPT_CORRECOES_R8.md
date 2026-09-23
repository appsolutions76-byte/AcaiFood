# Prompt de correções — Rodada 8 (AçaíFood)

> **Base:** Sexta Auditoria (`docs/03_AUDITORIA_2026-09-23.md`) sobre o código de 22/09/2026, conferido de novo em 23/09 (sem alterações).
> **Decisão de negócio já tomada pelo dono do produto:** o repasse passa a ser **liquidação depois do PIN, só para a subconta Asaas aprovada** de cada parceiro. Acabam o split no checkout e o saque por chave Pix.
> **O app está no ar, em operação.** Por isso esta rodada é feita em etapas pequenas, com homologação, backup, chaves liga/desliga e plano de volta em cada passo. Nenhuma etapa pode parar o app.
> **Como usar:** a Parte 1 é para o Fredson (visão rápida). Da Parte 2 em diante, cole no Antigravity.

---

## Parte 1 — O que funciona e o que não funciona hoje

Avaliação pela leitura do código (não foi feito teste em produção).

### ✅ Funciona e deve ser preservado

| Área | Situação |
|---|---|
| Cadastro, login, perfis, painéis por papel | OK |
| Cardápio (4 tipos de açaí + extras), carrinho de 1 loja, revalidação de preço antes de pagar | OK |
| Cobrança Pix (QR + copia-e-cola), consulta de status, Realtime, alertas sonoros | OK |
| Webhook da Edge Function `asaas-webhook` (valida token, idempotente) | OK |
| Aceite de corrida atômico (dois motoboys não pegam a mesma corrida) | OK |
| PIN com hash, 5 tentativas, intervalo de 5 s, log, bloqueio `PIN_LOCKED` | OK |
| Estorno pelo valor real cobrado no Asaas (`refund`) | OK (modelo certo) |
| Trigger contra autopromoção a admin e autorreativação de bloqueado | OK |
| `split_enabled = false` no cadastro | OK |
| Trava atômica e registro no ledger na aprovação de saque | OK (vai ser substituído) |
| Chat do pedido, suporte, ocorrências, anúncios, impressão, mapas/GPS, ativação/fundador, selo Asaas, termos | OK |

### ❌ Não funciona ou funciona errado

| # | Problema | Efeito |
|---|---|---|
| 1 | Split no checkout **e** saque sobre o mesmo pedido | Parceiro recebe duas vezes |
| 2 | Saldo de saque conta pedidos não pagos/não entregues | Saque de dinheiro que não existe |
| 3 | Segredo fixo `acaifood_webhook_2026` + token do webhook vale como admin | Pedido "pago" sem pagar; apagar a base |
| 4 | `/api/user/status` sem login | Qualquer um bloqueia/desbloqueia qualquer usuário |
| 5 | `transition_order_status` não valida transição nem dono | Qualquer logado põe pedido em `PAID` |
| 6 | RLS de `orders` permite UPDATE de qualquer coluna | Alterar valores, status, `payout_*_done` |
| 7 | Edge Function `asaas-checkout` aceita valor do body; webhook não confere o valor | Pagar R$ 1 por um pedido de R$ 300 |
| 8 | PIN, telefone e endereço visíveis a qualquer logado no radar; RPCs aceitam `p_operator_id` de fora | Entrega falsa, vazamento de dados |
| 9 | Subtotal, distância e coordenadas vêm do celular | Preço manipulável |
| 10 | Checkout procura a cidade em colunas inexistentes | Tarifa por cidade nunca vale no servidor |
| 11 | Trigger de taxas sobrescreve `applied_*` em todo UPDATE | Histórico de taxas não é confiável |
| 12 | Três fórmulas diferentes (servidor, carrinho, impressora) | Valores diferentes em cada tela |
| 13 | Coleta: valor entra como produto **e** como frete | Cobrança provavelmente dobrada |
| 14 | Cron do sweep chama GET, rota só tem POST | Pagamento automático nunca roda |
| 15 | `link-wallet` aceita qualquer walletId; `subaccount` liga split antes da aprovação | Dinheiro para conta fora da homologação |
| 16 | Destino do saque = chave Pix editável pelo usuário | Invasor troca a chave e saca |
| 17 | `debug-orders` pública | Vazamento de pedido real |
| 18 | `PixModal` grava `PAID` em cima de status posteriores | Pedido "volta" de estado |
| 19 | Telas falam em "saque instantâneo, 2 por dia" | Promessa falsa ao parceiro |
| 20 | `admin_balances` gravado pelo navegador | Relatório manipulável/duplicado |
| 21 | Configurações e anúncios em JSON dentro de `asaas_platform_wallet_id` | Clique em anúncio pode apagar a configuração de ativação |
| 22 | 6 tabelas sem migration; 2 migrations com `\$\$` inválido | Banco não reconstrói |

---

## Parte 2 — Prompt para o Antigravity (copiar daqui para baixo)

### Contexto

Você vai corrigir o **AçaíFood** (Next.js 16 + Supabase + Asaas). **O app está NO AR, em operação, com clientes, parceiros e dinheiro real.** A prioridade número 1 desta rodada é **o app nunca parar**: nenhum pedido pode travar, nenhum pagamento pode deixar de ser reconhecido e nenhum parceiro pode deixar de receber. A lista completa de problemas está em `docs/03_AUDITORIA_2026-09-23.md`, e a descrição do app em `docs/01_OPERACAO_DO_APP.md` e `docs/02_ARQUITETURA_TECNICA.md`. Leia os três antes de começar.

### Regras de operação contínua (obrigatórias em TODAS as etapas)

1. **Homologação primeiro, sempre.** Criar e usar um projeto Supabase de staging + Asaas **sandbox** + um preview da Vercel. Nenhuma mudança vai para produção sem ter rodado o fluxo completo (B2C, B2B e Coleta) em homologação.
2. **Backup antes de cada migration em produção:** confirmar que o PITR do Supabase está ativo **ou** fazer `pg_dump` completo, e anotar o horário. Sem backup, não aplica.
3. **Padrão "expandir → migrar → contrair":**
   - **Expandir:** adicionar tabela/coluna/RPC/rota nova **sem remover nem restringir nada** (o app antigo continua funcionando).
   - **Migrar:** publicar o código novo que usa o caminho novo; esperar os aparelhos atualizarem (a PWA fica em cache: pelo menos 48 h, com o aviso "Nova versão disponível — toque para atualizar" forçando o reload).
   - **Contrair:** só então remover ou restringir o caminho antigo (REVOKE, DROP, apagar rota), em deploy separado.
   Nunca faça expandir e contrair no mesmo deploy.
4. **Tudo que muda comportamento de dinheiro ou de status fica atrás de uma chave** (colunas booleanas em `platform_settings`, por exemplo `settlements_enabled`, `checkout_split_enabled`, `client_can_mark_paid`), para ligar/desligar pelo admin **sem deploy** e voltar atrás em segundos.
5. **Plano de volta (rollback) escrito para cada etapa** antes de executar: qual deploy da Vercel restaurar ("Instant Rollback"), qual migration de reversão rodar e qual chave desligar. Toda migration de "contrair" vem com o SQL de reversão pronto em `supabase/rollback/`.
6. **Deploy em horário de baixo movimento** (madrugada em Belém), um item por vez, com o dono do produto avisado.
7. **Verificação depois de cada deploy em produção (30 min):** criar um pedido real de valor baixo com uma conta de teste, pagar o Pix, conferir que virou `PAID` sozinho, aceitar, chamar moto, aceitar como motoboy de teste, validar o PIN e estornar. Acompanhar os logs da Vercel e do Supabase e o painel de webhooks do Asaas (fila sem erros). Qualquer falha → rollback imediato, investigar depois.
8. **Compatibilidade:** rotas e RPCs novas não podem quebrar chamadas das versões antigas da PWA que ainda estão nos celulares. Quando for bloquear algo que o app antigo usa, antes publique o app novo e confirme pelos logs que ninguém mais usa o caminho antigo.
9. **Regras gerais:** código em inglês, textos de tela em PT-BR; a Loja/Batedeira é **um papel só**; toda mudança de banco é **migration nova** em `supabase/migrations/` (nada de SQL Editor, nunca editar migration antiga); nada de segredo literal no código.
10. **Relatório ao fim de cada etapa:** arquivos alterados, migrations, resultado dos testes, verificação em produção feita, plano de rollback e o que ficou pendente. **Pare e espere a aprovação do dono do produto antes da etapa seguinte.**

---

### ETAPA 0 — Preparação (sem nenhuma mudança visível em produção)

1. Criar o ambiente de homologação (Supabase staging + Asaas sandbox + preview Vercel) e as migrations que faltam para ele subir do zero: gerar via `supabase db diff` contra produção as tabelas sem migration (`platform_settings`, `cities`, `admin_balances`, `order_messages`, `order_tracking`, `commercial_ads`) e corrigir o `\$\$` das migrations `20260901020000`/`20260901040000` com uma migration **nova** que recria as funções corretamente. Em produção isso tem que ser **no-op** (usar `IF NOT EXISTS` / `CREATE OR REPLACE` com o mesmo conteúdo que já está lá; conferir antes).
2. **Diagnóstico do webhook (crítico para não quebrar pagamentos):** conferir nos logs e no painel do Asaas **qual URL de webhook está ativa** (rota Next `/api/asaas/status` ou Edge Function `asaas-webhook`), **qual token o Asaas está enviando** e se `ASAAS_WEBHOOK_TOKEN` está definida na Vercel e no Supabase. Medir, nos últimos 7 dias, quantos pedidos foram para `PAID` pelo webhook e quantos só pelo app do cliente (`confirmar_pagamento`). **Entregar esse diagnóstico antes de qualquer outra coisa.**
3. Adicionar as chaves de controle em `platform_settings` (expandir): `client_can_mark_paid` (true), `checkout_split_enabled` (true), `settlements_enabled` (false), `legacy_withdrawals_enabled` (true). Por enquanto, o código só lê; o comportamento continua igual ao atual.
4. Adicionar à PWA o aviso de nova versão com reload forçado (necessário para as etapas seguintes).
5. Criar a suíte de testes (Vitest para `pricingEngine` e para a lógica de API; testes SQL com usuários de cada papel para RLS/RPC) rodando contra homologação.

---

### ETAPA 1 — Fechar as portas de segurança

Cada item com o padrão expandir → migrar → contrair. Ordem abaixo.

**1.1 Segredo fixo e autenticação (`lib/apiAuth.ts`)**
- **Pré-condição (do diagnóstico da Etapa 0):** o Asaas precisa estar enviando um token igual a `ASAAS_WEBHOOK_TOKEN`, e essa variável definida na Vercel e no Supabase. Se hoje o Asaas usa o literal `acaifood_webhook_2026`, primeiro: gerar um token novo forte, cadastrar **ao mesmo tempo** na Vercel/Supabase como `ASAAS_WEBHOOK_TOKEN` e manter o antigo em `ASAAS_WEBHOOK_TOKEN_PREVIOUS` (aceitar os dois por 48 h); trocar no painel Asaas; confirmar que os webhooks novos chegam; e só depois remover o `_PREVIOUS`.
- Remover do código o literal `acaifood_webhook_2026` e o suporte a `?wh_token=` (a menos que o diagnóstico mostre que a URL do webhook no Asaas usa `wh_token`; nesse caso, trocar a URL no Asaas antes).
- O token do webhook deixa de valer em `authorizeRequest` (nenhuma rota admin aceita). Rotas admin: só JWT de admin ou `x-internal-secret` servidor→servidor. Cron: `Authorization: Bearer ${CRON_SECRET}`.
- Comparação com `crypto.timingSafeEqual`; variável ausente = recusa (fail-closed) **com log claro**.

**1.2 `/api/user/status`:** exigir `authorizeRequest`. O usuário altera só o próprio `is_online`/pausa da própria loja; bloquear/desbloquear terceiros = só admin. Conferir que as telas de parceiro que chamam essa rota já enviam o token (se alguma não envia, corrigir a tela **no mesmo deploy**, antes de exigir).

**1.3 Pagamento com valor conferido**
- Checkout grava `orders.charged_amount_cents` (coluna nova) com o valor exato enviado ao Asaas.
- Nos dois webhooks: marcar `PAID` só se `payment.externalReference === order.id` **e** o valor pago bater com `charged_amount_cents`. Pedidos antigos sem `charged_amount_cents` continuam sendo aceitos como hoje (compatibilidade). Valor divergente: não marca pago, registra em `incident_logs` (`CRITICA`) e avisa o admin.
- Idempotência por `event.id` (tabela `webhook_events`).
- Edge Function `asaas-checkout`: primeiro fazer a rota Next deixar de chamá-la (criar a cobrança só pela rota Next, que já tem o fallback direto) e publicar; confirmar nos logs que ela não recebe chamadas por 48 h; **depois** apagar.
- Manter os dois webhooks funcionando nesta etapa. Unificar em um só apenas depois de confirmar qual está cadastrado no Asaas, trocando a URL lá primeiro.

**1.4 Status "pago" só pelo servidor**
- Pré-condição: o diagnóstico mostrou que o webhook marca `PAID` de forma confiável. Se não marca, **corrigir o webhook primeiro** (é por isso que o app hoje também marca pelo cliente).
- Migrar: a tela passa a só **observar** o status (Realtime + `/api/asaas/status` GET), sem chamar `acaoPedido('confirmar_pagamento')`. Como rede de segurança, o GET de `/api/asaas/status`, quando o Asaas disser pago e o valor bater, pode marcar `PAID` **no servidor** (service_role). Assim, se o webhook atrasar, o pedido não trava.
- Contrair (deploy seguinte, depois de 48 h): desligar `client_can_mark_paid` e recriar `transition_order_status` (migration nova) para usar `auth.uid()`, exigir que o chamador seja parte do pedido, **aplicar** a matriz de transições (retornar erro se inválida) e proibir `PAID`/`REFUNDED` para não-service_role.

**1.5 Pedidos: fim do UPDATE livre**
- Expandir: criar as RPCs que faltam para tudo o que as telas fazem hoje via `supabase.from('orders').update(...)` (listar todas as chamadas em `useAppStore.ts` e nas páginas: aceitar, chamar moto, retirar, cheguei, cancelar, ocultar, referência de entrega etc.). Cada RPC usa `auth.uid()` e confere papel e posse.
- Migrar: trocar as chamadas diretas pelas RPCs, publicar e esperar 48 h.
- Contrair: `REVOKE UPDATE ON orders FROM authenticated` + `GRANT UPDATE` só nas colunas que a UI ainda edita diretamente (se sobrar alguma); policy de UPDATE com `WITH CHECK` igual ao `USING`, sem o ramo "radar". Remover do cliente `markPayoutDone` e `pagar_motorista` (quem marca repasse é o servidor).

**1.6 PIN e radar**
- Expandir: criar a view `radar_orders` (sem `delivery_pin`, telefone e endereço completo; com bairro, distância e ganho) e a RPC `get_my_pin(order_id)` (só o recebedor). Recriar `check_delivery_pin` e `accept_order_atomic` para usar `auth.uid()` **mantendo a mesma assinatura** (o parâmetro `p_operator_id` continua existindo, mas é ignorado) para as versões antigas do app não quebrarem. `accept_order_atomic` confere se o papel do motorista combina com o tipo do pedido.
- Migrar: radar do motoboy/caminhão lendo a view; tela do cliente/Loja buscando o PIN pela RPC.
- Contrair: remover da policy de SELECT de `orders` o ramo "radar" (o motorista só lê pedido atribuído a ele); `REVOKE EXECUTE` de `generate_delivery_pin` para `authenticated`/`anon`; parar de gravar `delivery_pin` em texto (guardar `pin_hash` + PIN criptografado com `pgp_sym_encrypt` para o `get_my_pin`). Pedidos em andamento no momento do deploy: manter o `delivery_pin` antigo até serem concluídos.

**1.7 Subconta e wallet**
- `link-wallet`: só admin, e validando no Asaas que o walletId é de uma subconta da plataforma. Não liga `split_enabled`.
- `subaccount`: grava `asaas_account_status='PENDING'` (não mexe em `split_enabled`); formulário pede tipo de empresa e faturamento reais. **Parceiros que já estão com `split_enabled = true` continuam como estão** (não desligar nada de quem já opera).
- `REVOKE SELECT (asaas_account_api_key) ON users FROM authenticated`.

**1.8 Funções não usadas:** apagar `debug-orders` já (não é usada pelo app). `payout-sweep`, `remove-account` e `clear-orders`: confirmar nos logs do Supabase que não recebem chamadas por 7 dias e só então apagar.

**Testes da Etapa 1 (automatizados, em homologação):** com um cliente comum, tentar marcar pedido como `PAID`, alterar `products_subtotal`, ler PIN alheio, aceitar corrida, bloquear outro usuário, chamar rota admin com token de webhook e pagar Pix com valor menor: **tudo deve falhar**. Os fluxos B2C, B2B e Coleta completos devem **continuar funcionando**, inclusive com uma versão antiga da PWA aberta durante a fase "migrar".

---

### ETAPA 2 — Uma fonte de verdade para valores

**2.1 Expandir:** tabela `order_financials` (1:1 com o pedido, em centavos, imutável: subtotal, distância, `city_id`, modo de frete, frete total, subsídio, total do comprador, percentuais, taxa Pix e atores, líquido do vendedor, do motorista e da plataforma, `rates_snapshot`); coluna `orders.city_id`; rotas **novas** `POST /api/orders/quote` e `POST /api/orders` (preços lidos do banco, distância e cidade calculadas no servidor, `pricingEngine` em centavos com os fallbacks corrigidos; **Coleta: subtotal 0, cobra só o frete**). O caminho antigo de criação de pedido continua existindo.
**2.2 Migrar:** carrinho e criação de pedido passam a usar as rotas novas; o checkout cobra `order_financials.buyer_total_cents` quando existir (pedidos antigos seguem pela regra atual); impressora, admin e telas de parceiro leem `order_financials` quando existir e caem na lógica atual para pedidos antigos.
**2.3 Contrair (depois de 48 h e com os logs sem uso do caminho antigo):** remover `trg_validate_order_fees`, a gravação de `splits`/`products_subtotal` pelo cliente, `calculateOrderFreight`/`calculateOrderTaxes` como fonte de valores, a reconciliação heurística da impressora e `lib/payoutCalc.ts`.
**Testes:** matriz de preços (B2C/B2B/Coleta × KM/FIXO × subsídio × cidade com e sem tarifa × 1/2/3 atores Pix); a soma dos líquidos + taxa Pix = total cobrado; o mesmo pedido mostra o mesmo valor em carrinho, Pix, comprovante e admin.
**Atenção operacional:** o preço que o cliente vê pode mudar em relação a hoje (cidade passa a valer no servidor e a Coleta deixa de cobrar em dobro). Mostrar ao dono do produto uma tabela "antes × depois" com exemplos reais **antes** de publicar.

---

### ETAPA 3 — Repasse depois do PIN para a subconta aprovada

**Regra final:** o Pix do cliente cai na conta da plataforma. Depois do PIN (`RECEIVED`), o servidor transfere automaticamente o líquido de cada parceiro para o **walletId da subconta Asaas `APPROVED`** (`POST /v3/transfers` com walletId). Nunca para chave Pix, CPF ou e-mail. Parceiro com subconta pendente: o valor fica **retido** até a aprovação.

**3.1 Expandir (tudo desligado, `settlements_enabled = false`):**
- Ledger (`ledger_entries` ou `partner_ledger` ampliado): crédito por pedido e papel (`unique(order_id, role)`), status HELD/READY/SETTLED/REVERSED.
- Tabela `settlements` com idempotency key e trava atômica; job `GET /api/cron/settlements` (Vercel Cron a cada 15 min, `Bearer CRON_SECRET`) que **não faz nada enquanto a chave estiver desligada**.
- Lançar os créditos no ledger ao validar o PIN (e no "Forçar baixa"), lendo `order_financials`. Isso só registra; não paga nada.
- Webhook de subconta: aprovação geral → `APPROVED` e move HELD→READY.
- Tela "Carteira" do parceiro e aba "Liquidações" do admin, **ocultas** enquanto a chave estiver desligada.

**3.2 Reconciliação (antes de ligar):** rota admin idempotente que consulta no Asaas cada pedido pago e marca como já pago (`SETTLED`, sem transferir) o que já saiu por **split** ou por **saque**; cancela com motivo os `withdrawal_requests` ainda abertos **só no momento da virada** (3.3); e gera um **CSV por parceiro: devido × pago**, destacando pagamentos em dobro. Nada é corrigido automaticamente. **Pare e entregue o relatório ao dono do produto.**

**3.3 Virada (uma única mudança de configuração, madrugada, com o admin acompanhando):**
1. Rodar a reconciliação de novo (dados frescos).
2. Na mesma operação: `checkout_split_enabled = false`, `legacy_withdrawals_enabled = false` e `settlements_enabled = true`.
3. Primeira execução do job **acompanhada**: conferir 3 transferências no painel Asaas antes de deixar rodar sozinho.
4. **Rollback:** voltar as três chaves ao estado anterior (sem deploy).
Pedidos cobrados **antes** da virada com split já foram pagos pelo split; a reconciliação garante que não recebam de novo.

**3.4 Contrair (depois de 7 dias estáveis):** remover o split do código do checkout, as rotas de saque (`asaas/withdrawals`, `admin/withdrawals` + approve/reject, `admin/payout-settings`, `asaas/sweep`, `asaas/transfer`), `lib/partnerBalance.ts`, `lib/withdrawalApproval.ts`, `lib/asaasTransferHelpers.ts`, o contador de saques em `localStorage` e o botão "Saque instantâneo". `vercel.json` passa a ter só o cron de settlements. `withdrawal_requests` fica só para leitura histórica.

**3.5 Textos:** Carteira do parceiro com "A liberar / A receber / Recebido" e a frase "Os valores caem automaticamente na sua conta Asaas após a confirmação da entrega com PIN. Para sacar para o seu banco, use o app Asaas." Atualizar os manuais do app e os PDFs de `public/` a partir de `docs/04_MANUAIS_DE_USO.md`. **Avisar os parceiros antes da virada.**

**Testes:** o PIN gera crédito uma vez só (repetir não duplica); duas execuções simultâneas do job não transferem em dobro; parceiro com subconta pendente fica retido e recebe ao aprovar; cancelamento antes do PIN não gera crédito; falha no Asaas volta para a fila sem perder valor; não existe caminho de código que envie Pix para chave digitada.

---

### ETAPA 4 — Organização (sem mudar comportamento)

1. Dashboard do admin calculado no servidor a partir de `order_financials` (parar de gravar `admin_balances` pelo navegador; manter a tabela antiga até o novo painel ser conferido lado a lado por uma semana).
2. Configurações de ativação em colunas próprias de `platform_settings`; anúncios em tabelas `ads`/`ad_events` (migrar o JSON de `asaas_platform_wallet_id`, ler dos dois lugares durante a transição).
3. `is_founder` gravado no cadastro; "ativação paga" = cobrança `ACTIVATE_<userId>` recebida.
4. Status só em inglês no banco, com um único mapa para os rótulos PT-BR (`lib/orderStatus.ts`), migrando os dados antigos.
5. Remover o código morto (`BlockedUserGuard`, `UserManagementTable`, `/api/asaas/documents` se não for usado).
6. Dividir os arquivos gigantes (`admin/page.tsx`, `useAppStore.ts`, `batedeira/page.tsx`) **sem mudar comportamento**, um arquivo por deploy, com o fluxo completo testado a cada um.
7. CI: `lint`, `tsc --noEmit`, testes, e `supabase db push` com aprovação manual.

---

### Critério final de aceite da Rodada 8

- O app ficou **no ar o tempo todo**: nenhum pedido travado, nenhum webhook perdido (painel Asaas sem fila de erro), nenhuma reclamação de parceiro sem pagamento.
- Os testes de fraude da Etapa 1 falham; a matriz de preços passa; o mesmo pedido mostra o mesmo valor em todas as telas.
- Pedidos B2C, B2B e Coleta no sandbox e um pedido real de teste em produção terminam com cobrança = total; depois do PIN, **exatamente um** crédito por parceiro e transferência para o walletId aprovado; repasses + plataforma + taxa Pix = valor cobrado.
- Não resta no código `acaifood_webhook_2026`, `wh_token`, Pix para chave digitada nem split no checkout.
- `supabase db reset` + seed sobe o app do zero em homologação.

### Fora do escopo (ações do Fredson)

- Hoje: apagar `debug-orders` no painel do Supabase; manter o pagamento automático desligado; conferir cada saque contra pedidos entregues com PIN antes de aprovar (até a Etapa 3).
- Trocar o token do webhook junto com o agente (Etapa 1.1), não antes, para não derrubar a confirmação de pagamentos.
- Confirmar com o Asaas (Eliana) que a transferência para subconta atende à homologação BaaS.
- Revisar o relatório de reconciliação (3.2) e decidir sobre os pagamentos em dobro já ocorridos.
- Avisar os parceiros sobre a mudança da carteira antes da virada (3.3).
