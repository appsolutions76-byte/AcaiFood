# Prompt — Rodada 7 (AçaíFood / AppAçaíBelém): sistema financeiro único, uma fórmula só, do carrinho ao saque

> Contexto para o agente: o pedido para esta rodada veio direto do dono do produto: o sistema financeiro precisa ser **único** — carrinho, Pix, impressão de comprovante, estorno, painel admin e carteira/saque do Asaas devem sempre refletir **exatamente o mesmo valor**, calculado pela **mesma fórmula**, em todo lugar. Fui auditar o código atual para encontrar onde isso está sendo violado hoje, e encontrei a causa raiz: existem **duas famílias independentes de fórmula** para a mesma regra de negócio (quanto custa o frete, quanto fica de taxa, quanto o parceiro recebe), uma no cliente (app) e outra no servidor, e elas só coincidem por sorte/sincronização manual, não por design. Este prompt corrige isso na raiz e também consolida os itens críticos já encontrados na Quinta Auditoria (arquivo `Quinta_Auditoria_AcaiFood.docx`, entregue antes deste prompt) que são parte do mesmo problema.

> ⚠️ **Mesma regra de sempre: app em produção agora, com usuários e dinheiro real. Esta rodada mexe no núcleo do cálculo financeiro — mais do que qualquer rodada anterior. Aplicar em homologação primeiro, testar cada tipo de pedido (B2C, B2B, Coleta) com e sem subsídio de frete, com e sem tarifa fixa configurada, antes de qualquer deploy em produção. Não juntar esta rodada com nenhuma outra mudança no mesmo deploy.**

---

## O diagnóstico: por que hoje pode haver dois números diferentes para o mesmo pedido

Hoje existem, ao todo, **quatro lugares** que calculam frete/taxa/repasse de forma independente:

1. **`apps/mobile/src/store/useAppStore.ts`** — `calculateOrderFreight()` + `calculateOrderTaxes()` + `getRatesForCity()`. Roda no **cliente** (app), usa `state.rates` (carregado de `platform_settings` via `fetchRates()`, renomeando colunas — ex.: a coluna real `motoboy_fee_per_km` vira `rates.b2c_km` no app) e pode ser **sobrescrito por cidade** através da tabela `cities` (coluna `rates`, JSON, mesclado por `getRatesForCity`). É usado para: mostrar o total no carrinho, montar o objeto `taxas` gravado no pedido na criação, e — reaproveitado por `apps/mobile/src/app/admin/page.tsx` (`getDynamicTaxes`) — para os totais e relatórios do painel admin.
2. **`apps/mobile/src/lib/payoutCalc.ts`** — `calculateOrderDeliveryTotal()` + `calculateSellerPayout()` + `calculateDriverPayout()`. Roda no **servidor**, usado por `transfer/route.ts` (repasse legado, hoje só admin). Lê `courier_payment_mode`/`courier_fixed_fee` (e equivalentes B2B/Coleta) **direto e fresco de `platform_settings`, sem nenhuma noção de cidade** — e para tudo o mais (taxa por km, percentuais de plataforma), confia nos campos já gravados no próprio pedido (`applied_delivery_fee_per_km`, `applied_platform_fee_percent`, `applied_delivery_platform_fee_percent`) — campos que foram escritos pelo **cliente**, no momento da criação do pedido, a partir do `state.rates` do item 1.
3. **`apps/mobile/src/app/api/asaas/checkout/route.ts`** — reimplementa, copiando manualmente, a mesma fórmula do item 2 (não importa `payoutCalc.ts`, tem o código colado dentro do arquivo). Hoje os números batem por coincidência de manutenção manual, não por reaproveitamento de código.
4. **`apps/mobile/src/lib/partnerBalance.ts`** — usada pela rodada 5 (saque sob aprovação) para calcular o saldo disponível do parceiro. **Diverge de propósito** da fórmula oficial do item 2 em três pontos (detalhado no P1 abaixo) — já é dinheiro real pago errado, não só uma inconsistência de exibição.

**A consequência concreta mais grave:** o único ponto em que o servidor re-lê uma configuração "fresca" (não confia em nada vindo do pedido ou do cliente) é `courier_payment_mode`/`courier_fixed_fee` (e os equivalentes de B2B/Coleta) — e essa releitura é **sempre do valor global de `platform_settings`, nunca do valor específico da cidade daquele pedido**. Ou seja: se uma cidade tiver uma tarifa de entrega configurada como "Fixa" (`courier_payment_mode = 'FIXED'`) com um valor diferente do padrão global, o **cliente mostra e imprime um valor** (o da cidade, porque `getRatesForCity` mescla isso corretamente na tela) e o **servidor cobra/paga outro valor** (o padrão global, porque `checkout/route.ts`, `transfer/route.ts` e `payoutCalc.ts` nunca olham para a tabela `cities` na hora de decidir modo/valor fixo). Isso é uma divergência real de dinheiro, não só de exibição, e existe independente de haver ou não uma cidade configurada assim hoje — o risco está na arquitetura, pronto para acontecer no dia em que alguém configurar uma tarifa fixa por cidade.

Um segundo problema, mais estrutural ainda: `products_subtotal` (quanto custam os produtos do pedido) e os campos `applied_platform_fee_percent`/`applied_delivery_fee_per_km` são **escritos pelo cliente** no momento da criação do pedido (`useAppStore.ts`, função de criar pedido) — o servidor nunca recalcula o subtotal a partir do preço real dos produtos no catálogo, só confia no que o pedido já trouxe. Isso já era uma pendência registrada desde a primeira rodada de correções ("um comprador pode gravar um pedido com products_subtotal artificialmente baixo") e nunca foi resolvida — ela é parte do mesmo problema de "não existe uma única fonte de verdade calculada no servidor".

---

## P0 — CRÍTICO / ARQUITETURA: criar a fórmula única, no servidor, com consciência de cidade

**Objetivo:** existir **um único módulo**, chamado por **todo mundo**, que decide quanto custa a entrega, quanto é a taxa de plataforma, quanto o vendedor/fornecedor/motorista recebe líquido, e qual o total cobrado do comprador — para qualquer pedido, de qualquer cidade, a qualquer momento. Nenhum outro lugar do sistema deve ter sua própria cópia dessa conta.

**Ação:**

1. Criar (ou expandir) `apps/mobile/src/lib/pricingEngine.ts` como o módulo único. Ele deve:
   - Receber: tipo do pedido (B2C/B2B/Coleta), distância em km, id ou nome da cidade, subtotal dos produtos (ou, melhor ainda, a lista de itens do pedido para recalcular o subtotal a partir do catálogo — ver nota abaixo), id da loja/fornecedor (para achar `frete_subsidy_pct`), id do motorista.
   - Buscar as taxas **sempre frescas do banco**, nunca de um valor já gravado no pedido: ler `platform_settings` (`courier_payment_mode`, `courier_fixed_fee`, `transporter_payment_mode`, `transporter_fixed_fee`, `ecopoint_payment_mode`, `ecopoint_fixed_fee`, `b2c_fee_percentage`, `motoboy_fee_per_km`, `motoboy_platform_fee_percentage`, `b2b_fee_percentage`, `truck_fee_per_km`, `truck_platform_fee_percentage`, `col_fee_percentage`, `col_fee_per_km`, `col_platform_fee_percentage`, `col_fixed_price`) e, se a cidade do pedido tiver um registro em `cities` com a coluna `rates` preenchida, mesclar por cima do valor global — **usando a mesma lógica de mescla que hoje só existe em `getRatesForCity` (useAppStore.ts)**, mas agora dentro deste módulo do servidor, chamada tanto para decidir o MODO/valor fixo quanto a taxa por km e os percentuais (hoje só o modo/fixo é resolvido fresco; o resto vem do pedido — isso muda: tudo passa a ser resolvido fresco, com cidade, no momento do cálculo).
   - Calcular, nessa ordem: subtotal dos produtos → total de entrega (respeitando modo KM vs. Fixo da cidade) → taxa de plataforma sobre a venda → taxa de plataforma sobre a entrega → subsídio de frete (se a loja/fornecedor tiver `frete_subsidy_pct`) → valor líquido do vendedor/fornecedor → valor líquido do motorista → total cobrado do comprador (produtos + frete do cliente, já descontado o subsídio que a loja paga).
   - Exportar funções puras e testáveis, no mesmo espírito de `calculateSellerPayout`/`calculateDriverPayout` que já existem em `payoutCalc.ts` — pode aproveitar o código desses arquivos como ponto de partida, mas o cálculo de frete (`calculateOrderDeliveryTotal`) precisa ganhar o parâmetro de cidade.
2. Migrar todo mundo para usar **só** esse módulo, removendo a lógica duplicada de cada lugar:
   - `apps/mobile/src/app/api/asaas/checkout/route.ts` — remover o cálculo colado manualmente, chamar o módulo único.
   - `apps/mobile/src/app/api/asaas/transfer/route.ts` — trocar a chamada a `payoutCalc.ts` pela chamada ao módulo único (mesma assinatura, agora com cidade).
   - `apps/mobile/src/lib/partnerBalance.ts` — remover a fórmula própria (ver P1) e chamar o módulo único.
   - `apps/mobile/src/store/useAppStore.ts` (`calculateOrderFreight`/`calculateOrderTaxes`, usados pelo carrinho e pela criação do pedido) e `apps/mobile/src/app/admin/page.tsx` (`getDynamicTaxes`) — o ideal é que o **carrinho no app** passe a chamar uma rota do servidor (ex.: `POST /api/orders/estimate`) que usa o mesmo módulo único para calcular o total ANTES de criar o pedido, em vez de calcular localmente com `state.rates`. Se isso for grande demais para esta rodada, no mínimo garantir que `calculateOrderFreight`/`calculateOrderTaxes` (cliente) e o módulo novo (servidor) leem exatamente as mesmas colunas, com a mesma mescla de cidade, para nunca divergir — mas a solução definitiva é o carrinho perguntar ao servidor, não calcular sozinho.
3. **O pedido deixa de ser a fonte dos valores usados no cálculo.** Hoje o cliente grava `applied_platform_fee_percent`/`applied_delivery_fee_per_km`/`products_subtotal` no pedido, e o servidor confia nesses campos depois. A partir desta rodada, o servidor deve recalcular esses valores **do zero, com o módulo único**, no momento do checkout (cobrança) e do repasse/saque (pagamento) — os campos gravados no pedido passam a ser só um **registro histórico do que foi calculado e cobrado**, nunca uma entrada confiável para recálculo futuro. Isso fecha de vez a pendência antiga de "comprador pode gravar products_subtotal artificialmente baixo": se o servidor recalcula o subtotal a partir do preço real dos produtos no catálogo (tabela de produtos/itens do pedido) em vez de confiar no valor gravado, esse problema desaparece.
4. Testar manualmente, em homologação, os três tipos de pedido (B2C, B2B, Coleta), com e sem subsídio de frete, com e sem tarifa fixa configurada, e — o teste mais importante — configurando uma cidade de teste com uma tarifa diferente da global, confirmando que carrinho, cobrança Pix, comprovante impresso, painel admin e saque do parceiro mostram **o mesmo número**, o número da cidade, em todos os lugares.

---

## P1 — CRÍTICO (já identificado na Quinta Auditoria): `partnerBalance.ts` calcula o saldo de saque errado

`lib/partnerBalance.ts` (usado para decidir quanto o parceiro pode sacar, e é exatamente esse valor que sai como Pix real na aprovação) tem sua própria fórmula, diferente da oficial, em três pontos: (1) não desconta o subsídio de frete do vendedor quando a loja tem `frete_subsidy_pct` configurado — paga a mais; (2) usa `applied_delivery_platform_fee_percent || 15` em vez de `?? 10`, com um padrão diferente E tratando 0% explícito como se fosse vazio; (3) nunca respeita tarifa fixa (`courier_fixed_fee`/`transporter_fixed_fee`/`ecopoint_fixed_fee`), sempre calcula distância × tarifa por km.

**Ação:** ao implementar o P0 acima, `getPartnerAvailableBalance` deve parar de ter fórmula própria e chamar o módulo único (`pricingEngine.ts`) para cada pedido elegível, exatamente como os outros pontos de pagamento. Este item se resolve como consequência direta do P0, mas está listado separado porque é dinheiro real sendo calculado errado hoje — não é só uma questão arquitetural, é um bug ativo em produção.

---

## P2 — CRÍTICO (já identificado na Quinta Auditoria): aprovação de saque não confere se a subconta foi aprovada

Em `lib/withdrawalApproval.ts`, `processWithdrawalApproval` só bloqueia quando `asaas_account_status === 'REJECTED'` — nunca exige `split_enabled === true` nem `asaas_account_status === 'APPROVED'`. Como `lib/asaasTransferHelpers.ts` prioriza CPF/CNPJ pessoal do parceiro antes do walletId da subconta, um parceiro pode sacar via seu CPF mesmo com a subconta ainda em análise ou inexistente.

**Ação:** adicionar a checagem que faltou — bloquear (status `FALHOU`, com motivo claro) quando `split_enabled !== true` ou `asaas_account_status !== 'APPROVED'`, salvo se o responsável pelo produto decidir conscientemente que saque via CPF pessoal sem subconta aprovada é uma exceção válida do modelo de negócio (nesse caso, documentar essa decisão no código com um comentário claro, em vez de deixar como um efeito colateral não intencional).

---

## P3 — ALTO (já identificado na Quinta Auditoria): horário de pagamento automático sem efeito

Em `/api/asaas/sweep/route.ts`, `currentHHMM` e `targetTime` são calculados mas nunca comparados — o pagamento automático roda sempre no horário fixo do cron (`vercel.json`, `"0 1 * * *"`, ~22h em Belém), não importa o horário que o admin escolher na tela.

**Ação:** comparar `currentHHMM` com `targetTime` antes de processar (com uma margem de tolerância compatível com a frequência do cron), só disparando o pagamento quando o horário atual já alcançou o horário configurado e ainda não rodou hoje.

---

## P4 — ALTO (já identificado na Quinta Auditoria): gravação de saque em `partner_ledger` sempre falha, em silêncio

Em `lib/withdrawalApproval.ts`, o `INSERT` em `partner_ledger` usa `amount: -finalAmount` (negativo) e `type: 'WITHDRAWAL'` — violando as duas restrições `CHECK` da própria tabela (`amount > 0`, `type IN ('credit','debit')`). O erro é engolido por um `catch (_) {}` vazio, então nenhum saque pago pela nova arquitetura gera registro de auditoria.

**Ação:** corrigir o `INSERT` para `type: 'debit'` e `amount: finalAmount` (positivo), preenchendo `reason`/`balance_after` no mesmo padrão usado pelo restante do sistema, e parar de engolir o erro em silêncio (logar, no mínimo).

---

## P5 — MÉDIO (já identificado na Quinta Auditoria): aprovação de saque sem trava atômica

`processWithdrawalApproval` lê o status, decide processar, e só grava o resultado depois de já ter chamado o Asaas — sem um `UPDATE` condicional atômico no meio. Duas chamadas quase simultâneas para a mesma solicitação (aprovação manual coincidindo com a varredura automática, ou duas sessões de admin) podem gerar duas transferências reais para o mesmo saque.

**Ação:** no início da função, trocar a leitura simples por um `UPDATE` atômico que já marca a solicitação como "em processamento" e só prossegue se esse `UPDATE` realmente afetou uma linha.

---

## P6 — MÉDIO (já identificado na Quinta Auditoria): `split_enabled` ainda nasce `true` no cadastro

Em `apps/mobile/src/store/useAppStore.ts` (`registerUser`), `insertPayload.split_enabled` continua `dbRole !== 'CLIENT'` — `true` para todo parceiro desde o cadastro, antes de qualquer subconta existir. Pendência da rodada 4 (P4.1) nunca aplicada.

**Ação:** trocar para `false` sempre no cadastro.

---

## P7 — MÉDIO: comprovante impresso reconstrói o frete sozinho, com regras próprias

Em `apps/mobile/src/lib/thermalPrinter.ts`, a impressão do comprovante recalcula `totalDeliveryFee`/`storeDeliveryFee`/`clientDeliveryFee` a partir de `order.taxas.*`, com uma cascata de `if/else` para "reconciliar" quando a soma não bate com `order.totalValue`. Isso é um sintoma direto da falta de fonte única: o comprovante está adivinhando o que deveria simplesmente ler.

**Ação:** depois do P0, quando o servidor passar a gravar no pedido os valores definitivos já calculados pelo módulo único no momento da cobrança, a impressão deve **ler diretamente esses campos gravados pelo servidor**, sem nenhuma reconstrução ou reconciliação heurística. Remover a cascata de `if/else` de reconciliação assim que os campos autoritativos estiverem disponíveis de forma confiável.

---

## P8 — Padrão positivo a replicar: o estorno já faz a coisa certa

`apps/mobile/src/app/api/asaas/refund/route.ts` não recalcula nada — ele busca o valor real já cobrado direto na API do Asaas (`GET /payments/{id}`) e estorna com base nesse valor. É o único ponto do sistema hoje que segue o princípio certo: **ler o valor autoritativo já existente, nunca recalcular uma segunda vez**. Ao implementar o P0, use este arquivo como referência de filosofia — o objetivo final é que todo lugar do sistema (impressão, painel, carteira) leia um valor que foi calculado e gravado **uma vez, no servidor, no momento da cobrança**, em vez de recalcular a mesma conta de formas ligeiramente diferentes em cada tela.

---

## P9 — BAIXO (já identificado na Quinta Auditoria): rótulos que não refletem a realidade

`lib/founderQuota.ts` (`paidCount`) e `apps/mobile/src/app/api/asaas/activation/route.ts` (`isPaid`) inferem "pagou a ativação" pela simples presença de `asaas_wallet_id`/`asaas_account_id`, o que nem sempre é verdade (um fundador subsidiado também pode ter wallet). Baixa prioridade — ajustar quando sobrar tempo, checando diretamente se existe uma cobrança `RECEIVED`/`CONFIRMED` com `externalReference = ACTIVATE_<userId>`.

---

## Ordem recomendada de execução

1. **P0** — o módulo único de cálculo, com consciência de cidade. É o item mais trabalhoso e mais importante desta rodada; tudo abaixo depende dele ou é resolvido por ele.
2. **P1 e P2** — enquanto o P0 não sai, pelo menos aplicar essas duas correções pontuais em `partnerBalance.ts`/`withdrawalApproval.ts`, porque são dinheiro real sendo pago errado hoje, com ou sem a unificação maior.
3. **P4** — rápido, uma linha, resolve a auditoria silenciosamente quebrada.
4. **P3** — rápido, resolve o horário automático.
5. **P5 e P6** — independentes, podem ser feitos em paralelo com o resto.
6. **P7** — só depois que o P0 estiver gravando os valores autoritativos no pedido de forma confiável.
7. **P9** — sem pressa, quando sobrar tempo.

## Fora do escopo deste prompt

- Continuam de pé as pendências de negócio já registradas nas rodadas anteriores (rotação de chaves, homologação BaaS, prazo regulatório de 31/12/2026, selo Asaas — rodada 6).
- Esta rodada não cobre preços de produtos/catálogo em si (só o subtotal do pedido como um todo) — se houver lógica de preço por produto/variação que também precise de fonte única, tratar em uma rodada separada depois que esta estiver estável.
