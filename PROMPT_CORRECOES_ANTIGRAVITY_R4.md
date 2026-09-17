# Prompt de Correções — Rodada 4 (AçaíFood / AppAçaíBelém)

> Contexto para o agente: você (Antigravity) já executou três rodadas de correções neste projeto, incluindo uma auto-auditoria própria (`PROMPT_CORRECOES_ANTIGRAVITY_R3.md`) cobrindo a adequação ao Asaas como BaaS (Resolução Conjunta nº 16/2025). Foi feita uma quarta auditoria externa do estado atual do código. Quase tudo da rodada 3 foi confirmado como implementado corretamente — **não é necessário revisar de novo o que já foi confirmado**. Este prompt cobre apenas o que essa quarta auditoria encontrou: 1 vulnerabilidade crítica nova (não relacionada às rodadas anteriores), 2 itens de dívida de segurança de rodadas passadas que ficaram abertos, e 2 itens menores. Siga a ordem de prioridade abaixo.

---

## P0 — CRÍTICO: `/api/asaas/transfer` não confere dono do pedido antes de repassar

**Problema:** em `apps/mobile/src/app/api/asaas/transfer/route.ts`, quando a requisição inclui `orderId`, o servidor busca o pedido com Service Role (correto, ignora RLS) e recalcula o **valor** do repasse a partir do pedido no banco (`calculateSellerPayout`/`calculateDriverPayout` — isso está certo, não dá para inflar o valor). Só que o **destino** do Pix vem direto do corpo da requisição, sem nenhuma validação:

```js
const { pixKey, description, orderId, scheduleDate, isWalletId, walletId } = body;
...
const targetKey = String(walletId || pixKey).trim();
```

A única checagem existente antes de transferir é de **papel** (`authorizeRequest(['admin', 'loja', 'fornecedor', 'motorista'])`) e se aquele papel específico do pedido já foi pago (`payout_seller_done` / `payout_driver_done`) — nunca se o pedido pertence ao usuário autenticado. Isso quer dizer que qualquer loja, fornecedor ou motorista autenticado no app pode chamar essa rota informando o `orderId` de um pedido de **outro** parceiro (ainda não repassado) e sua própria chave Pix como destino. O servidor calcula o valor certo daquele pedido alheio e manda o dinheiro para a chave informada pelo requisitante, marcando o pedido como pago para o parceiro correto — que nunca vai receber, porque o dinheiro já foi para outra conta.

É a mesma classe de falha que `/api/asaas/checkout` e `/api/asaas/refund` já tratam corretamente (os dois validam dono do pedido antes de agir) — só que `/api/asaas/transfer` nunca ganhou essa checagem em nenhuma das rodadas anteriores, porque o foco sempre foi validar o VALOR, nunca o DESTINO.

**Ação obrigatória — aplicar antes de qualquer outra coisa desta lista, com o app em produção:**

1. Quando `isAdmin` for falso e houver `orderId`: buscar o dono real do pedido (`storefronts.partner_id` via `orders.seller_storefront_id`, para repasse de venda; `orders.driver_id` para repasse de frete) e comparar com o id do usuário autenticado (`auth.user?.id || auth.profile?.id`). Se não bater, recusar com `403` — replicar exatamente o padrão já usado em `refund/route.ts` (`isBuyer`/`isDriver`/`isStore` comparado antes de agir).
2. **Nunca aceitar `pixKey`/`walletId` vindo do corpo da requisição quando houver `orderId`.** Em vez disso, buscar a chave Pix/walletId cadastrada do próprio parceiro dono do pedido, direto do banco (`users.pix_key` / `users.cpf_cnpj` / `users.asaas_wallet_id`, na mesma ordem de prioridade que `supabase/functions/payout-sweep/index.ts` já usa: `uSeller?.cpf_cnpj || uSeller?.pix_key || uSeller?.email || uSeller?.asaas_wallet_id`). Isso fecha a rota por completo — mesmo que a checagem de dono do item 1 falhe por outro motivo, o dinheiro nunca sairia para uma chave arbitrária vinda do cliente.
3. Manter o uso de `pixKey`/`walletId` vindo do corpo da requisição **apenas** para o caso de admin fazendo saque avulso (sem `orderId`) — esse caminho já é restrito a admin e não muda.
4. Depois de aplicar, testar manualmente: (a) parceiro A tentando repassar um pedido de parceiro B → deve retornar 403; (b) parceiro dono do próprio pedido → deve continuar funcionando normalmente, usando a chave Pix cadastrada dele mesmo, não uma enviada no corpo.

---

## P1 — `split_enabled` não é checado no repasse manual nem na varredura automática

**Problema:** quem hoje confere `split_enabled`/`asaas_account_status` antes de mandar dinheiro a um parceiro é só `/api/asaas/checkout` (no momento em que o pedido é criado e o split nativo do Asaas é montado). Nem `/api/asaas/transfer` (repasse manual) nem `supabase/functions/payout-sweep/index.ts` (varredura automática) fazem essa checagem antes de efetivamente mandar o Pix — os dois resolvem a chave/walletId de destino corretamente (ainda mais depois do P0 acima), mas mandam a transferência mesmo que a subconta do parceiro ainda esteja `PENDING_DOCUMENTS` ou `AWAITING_APPROVAL`.

Na prática: se um pedido foi pago sem split nativo (por exemplo, porque `split_enabled` era falso no momento do pagamento), mas o repasse manual ou a varredura tentam liquidar esse pedido depois, nada impede que o Pix saia mesmo com a subconta do Asaas ainda não aprovada.

**Ação:**

1. Em `apps/mobile/src/app/api/asaas/transfer/route.ts`, antes de montar `transferBody` e chamar `${ASAAS_URL}/transfers`, buscar `split_enabled`/`asaas_account_status` do parceiro dono do pedido (já disponível na mesma consulta usada para resolver a chave Pix do P1 acima) e recusar com uma mensagem clara (ex.: `400` — "Conta do parceiro ainda não aprovada para repasses") se `split_enabled !== true`.
2. Aplicar a mesma checagem em `supabase/functions/payout-sweep/index.ts`, no ponto onde a chave Pix do vendedor/motorista já é resolvida (`sellerPixKey = uSeller?.cpf_cnpj || ...`) — pular o repasse daquele parceiro na varredura (sem quebrar o loop dos demais) se a conta não estiver aprovada.

---

## P2 — `GRANT UPDATE(status)` permite que usuário bloqueado se reative sozinho

**Problema:** a migration `supabase/migrations/20260913000000_grant_users_status_update.sql` concede:

```sql
GRANT UPDATE (status, is_online) ON public.users TO authenticated;
GRANT UPDATE (is_active) ON public.storefronts TO authenticated;
```

Combinado com a política de RLS existente (`"Allow self update on users" ... USING (auth.role() = 'authenticated' AND (id = auth.uid() OR public.is_admin()))`) e o fato de que o trigger `prevent_role_self_escalation()` (migration `20260912000000_fix_users_privilege_escalation.sql`) só protege `role`/`is_admin`, **não** `status` — qualquer usuário autenticado pode chamar a API do Supabase diretamente com a própria sessão e fazer `update({status: 'active'})` na própria linha, mesmo que um admin tenha acabado de colocá-lo como `'blocked'` ou `'paused'` (estados usados em `components/admin/UserManagementTable.tsx`). Isso não é uma falha de pagamento (`status` não controla nenhum repasse financeiro, confirmado ao rastrear seu uso no código), mas anula a única ferramenta de moderação/suspensão de contas que o admin tem hoje.

**Ação — escolher uma das duas abordagens:**

1. **Preferencial:** reverter o `GRANT UPDATE (status)` amplo. Criar uma rota de servidor (Service Role) específica para os poucos casos legítimos de auto-atualização de `status` pelo próprio usuário (se houver algum fluxo real do app que precise disso — confirmar antes de remover, para não quebrar nada em produção). Manter `GRANT UPDATE (is_online)` como está, já que isso não é usado para moderação.
2. **Alternativa, se reverter o GRANT quebrar algum fluxo do app:** adicionar um trigger `BEFORE UPDATE` em `public.users`, no mesmo padrão de `prevent_role_self_escalation()`, que bloqueia qualquer usuário não-admin de sair de `status = 'blocked'` ou `status = 'paused'` para outro valor (permitindo outras transições de `status` que não envolvam esses dois estados, se existirem).

Testar depois: um admin bloqueia um usuário de teste; logado como esse usuário, tentar reativar a própria conta direto pela API do Supabase (sem passar pelo app) e confirmar que falha.

---

## P3 — Webhook trata "aprovação de informação comercial" como aprovação geral da conta

**Problema:** em `supabase/functions/asaas-webhook/index.ts`, o tratamento dos eventos `ACCOUNT_STATUS_*` libera `split_enabled = true` tanto para `event.includes('GENERAL_APPROVAL')` quanto para `event === 'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED'`. Pela própria lista de eventos do Asaas usada como referência na rodada 3, "informação comercial" é uma categoria de aprovação separada de documento de identidade, aprovação geral e dados bancários — tratar só ela como suficiente para liberar o split pode habilitar repasses antes da aprovação bancária/documental estar de fato completa.

**Ação:** restringir a liberação de `split_enabled = true` apenas ao evento `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` (como o prompt original da rodada 3 especificava). `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED` deve continuar atualizando `asaas_account_status`/`account_status_history` para fins de exibição de progresso ao usuário, mas sem liberar pagamento.

Também vale registrar, mas não é bloqueante: nenhum log do corpo bruto do evento foi feito ainda para confirmar contra um payload real do Asaas em homologação que os nomes de campo usados no código (`accountObj.id`, `accountObj.walletId`) realmente vêm assim. Se possível nesta rodada, logar uma vez o `event` e as chaves de topo do payload (sem dado sensível) em ambiente de homologação para confirmar, e remover o log depois.

---

## P4 — Dois itens menores de qualidade/consistência

### P4.1 — `split_enabled` inicial inconsistente em `registerUser`

Em `apps/mobile/src/store/useAppStore.ts`, a função `registerUser()` grava o cadastro do parceiro já com `split_enabled: true` no `insertPayload`, antes de qualquer subconta Asaas existir. O valor é corrigido para `false` alguns passos depois, quando `cadastro/page.tsx` chama `/api/asaas/subaccount` para vincular a subconta (linha ~262) — mas essa chamada tem o erro tratado apenas com `.catch(_err => console.warn(...))`, sem aviso ao usuário nem nova tentativa. Se essa chamada falhar (instabilidade de rede ou do Asaas), o parceiro fica com `split_enabled: true` e nenhuma subconta vinculada.

**Ação:** (a) trocar o valor inicial de `split_enabled` em `registerUser` para `false` sempre; (b) em `cadastro/page.tsx`, adicionar pelo menos uma nova tentativa (retry) automática e um aviso visível ao usuário caso a vinculação de subconta falhe após o pagamento confirmado, em vez de só logar no console.

### P4.2 — `isStore` em `refund/route.ts` compara IDs de tipos diferentes

Em `apps/mobile/src/app/api/asaas/refund/route.ts`, a checagem `isStore = orderData.seller_storefront_id === userId` compara o id da vitrine (`storefronts.id`) com o id do usuário autenticado — provavelmente nunca é verdadeiro, porque são ids de tabelas diferentes. Não é uma brecha de segurança (é um falso negativo, então falha fechado), mas pode estar bloqueando indevidamente uma loja legítima de cancelar/estornar o próprio pedido.

**Ação:** corrigir para buscar `storefronts.partner_id` a partir de `orderData.seller_storefront_id` e comparar esse `partner_id` com `userId`, no mesmo padrão já usado em `transfer/route.ts` para resolver o dono da loja.

---

## Ordem recomendada de execução

1. **P0** (crítico) — aplicar e testar isoladamente, antes de qualquer outro item desta lista.
2. **P1** (`split_enabled` no repasse manual e na varredura) — depende da mesma consulta de dados do parceiro já usada no P0, faz sentido implementar em seguida.
3. **P2** (GRANT UPDATE/status) — independente dos anteriores, pode ser feito em paralelo.
4. **P3** (webhook) — independente, testar com evento real do Asaas em homologação se possível.
5. **P4.1 e P4.2** — baixa prioridade, quando sobrar tempo nesta rodada.

## Fora do escopo deste prompt (ações que não são de código)

Continuam pendentes desde rodadas anteriores, e novas desta rodada:

- Rotacionar chaves de produção (Asaas, Supabase Service Role, `INTERNAL_API_SECRET`, `ASAAS_WEBHOOK_TOKEN`).
- Checar o histórico do Git em busca de arquivos `.env` commitados por engano.
- Confirmar que o agendamento (cron) do `payout-sweep` está ativo e rodando no intervalo esperado.
- Considerar um pentest antes de qualquer divulgação pública mais ampla do app.
- Assinar formalmente o contrato de BaaS com o Asaas e confirmar com o suporte deles se a subconta pode receber cobrança antes da aprovação geral da conta (dúvida levantada na rodada 3, ainda em aberto).
