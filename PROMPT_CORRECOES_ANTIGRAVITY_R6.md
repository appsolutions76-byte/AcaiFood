# Prompt de Correções — Rodada 6 (AçaíFood / AppAçaíBelém): sincronização + playbook oficial do Asaas

> Contexto para o agente: isto não é uma auditoria do zero — é uma **sincronização**. Peguei o código real do projeto agora (não os prompts anteriores) e confirmei, arquivo por arquivo, o que das rodadas 3, 4 e 5 já está implementado corretamente. A maior parte está — ver a seção "O que já está confirmado como corrigido" no final, para não perder tempo revisando de novo. Este prompt cobre só: (1) dois itens críticos da rodada 4 que **ainda continuam abertos** no código atual; (2) uma peça de código órfã e perigosa encontrada nesta sincronização, que não estava em nenhum prompt anterior; (3) itens novos, gerados a partir do "Playbook de BaaS para clientes Asaas" (documento oficial recebido diretamente do Asaas) e da documentação pública deles sobre "período de avaliação".

> ⚠️ **Mesma regra de todas as rodadas anteriores: o app está em produção agora, com usuários e dinheiro real (`acaifood.app.br`). Aplicar e testar cada item isoladamente, migration nova sempre primeiro em homologação, nunca dar deploy de tudo junto.**

> **Separação código vs. fora do código nesta rodada:** o dono do produto (Fredson) vai cuidar pessoalmente de tudo que não é código (e-mail com o suporte Asaas, formulário de homologação, checagem de painel do Supabase). Para o Antigravity, **os itens prontos para executar agora, sem depender de mais nenhuma resposta de fora, são P0, P1, P2-B, P4 e P5** (P5 usa a razão social exata já fornecida no playbook oficial do Asaas, não precisa de mais nenhuma confirmação). **P2-A é uma checagem rápida no painel do Supabase que o Fredson faz, em paralelo, antes/durante o P2-B** — não bloqueia o código, mas é importante que aconteça. **P3 é o único item de "quando sobrar tempo", sem urgência.**

---

## P0 — CRÍTICO, ainda aberto desde a rodada 4: usuário bloqueado consegue se reativar sozinho

Confirmei no código atual (`supabase/migrations/20260913000000_grant_users_status_update.sql`) que o `GRANT UPDATE (status, is_online) ON public.users TO authenticated` continua exatamente como estava quando a rodada 4 apontou o problema — **nenhuma das duas correções sugeridas foi aplicada**. Continua valendo o mesmo diagnóstico: como o trigger `prevent_role_self_escalation()` só protege `role`/`is_admin`, e a política de RLS de auto-update permite `id = auth.uid()`, qualquer usuário autenticado pode chamar a API do Supabase direto (fora do app) e fazer `update({status: 'active'})` na própria linha, mesmo depois de um admin colocá-lo como `'blocked'`/`'paused'`.

**Ação (nova migration, ex.: `20260918000000_fix_status_self_reactivation.sql`):** escolher uma das duas abordagens já descritas na rodada 4 — reverter o `GRANT UPDATE(status)` amplo e criar uma rota de servidor específica para os poucos casos legítimos de auto-atualização (se houver algum fluxo real que precise disso — confirmar antes), ou adicionar um trigger `BEFORE UPDATE` em `public.users` (mesmo padrão de `prevent_role_self_escalation()`) que bloqueia a transição de `status = 'blocked'`/`'paused'` para outro valor quando quem está atualizando não é admin. Manter `GRANT UPDATE(is_online)` como está.

---

## P1 — CRÍTICO, ainda aberto desde a rodada 4: webhook libera split com aprovação incompleta

Confirmei em `supabase/functions/asaas-webhook/index.ts` (linha 128) que a condição continua:
```js
if (event.includes('GENERAL_APPROVAL') || event === 'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED') {
  newStatus = 'APPROVED';
  newSplitEnabled = true;
}
```
Exatamente o problema que a rodada 4 apontou: "informação comercial aprovada" é uma categoria de aprovação diferente de identidade/documento, aprovação geral e dados bancários — tratá-la como suficiente para `APPROVED` + `split_enabled = true` pode liberar repasse automático antes da aprovação bancária/documental de fato estar completa.

**Ação:** remover `|| event === 'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED'` dessa condição, deixando só `event.includes('GENERAL_APPROVAL')` para liberar `split_enabled = true`. `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED` deve cair no outro `else if` (linha 131, `newStatus === 'PENDING_DOCUMENTS' → 'AWAITING_APPROVAL'`) só para fins de exibição de progresso, sem tocar em `split_enabled`.

---

## P2 — CRÍTICO NOVO (achado nesta sincronização): a Edge Function antiga de repasse automático ficou órfã, mas ainda existe e ainda é perigosa

A rodada 5 mudou a arquitetura de repasse (parceiro só *solicita* saque; admin aprova manual ou via horário automático configurável) e, pelo que confirmei, a peça certa foi corrigida: `apps/mobile/src/app/api/asaas/sweep/route.ts` (chamada pelo cron do `vercel.json`) hoje lê `platform_settings.auto_payout_enabled`, respeita o horário/fuso configurado, e só paga solicitações da tabela `withdrawal_requests` via `processWithdrawalApproval()` — isso está certo e implementado como a rodada 5 pedia.

**O problema:** `supabase/functions/asaas-webhook/index.ts` foi atualizado (tem o tratamento de `ACCOUNT_STATUS_*`), mas `supabase/functions/payout-sweep/index.ts` — a **Edge Function separada, hospedada direto no Supabase**, que existia antes da rodada 5 — **não foi tocada**. Ela ainda contém o comportamento antigo por completo: varre `orders` direto, calcula o valor do repasse e chama `POST /transfers` no Asaas **imediatamente**, sem passar pela tabela `withdrawal_requests`, sem aprovação de admin, e **sem checar `split_enabled`/`asaas_account_status` do parceiro** (o mesmo problema que a rodada 4 já tinha apontado para o caminho antigo, nunca corrigido nessa função). Ou seja: essa função ainda tem, sozinha, o poder de mandar Pix automaticamente para qualquer parceiro com pedido pendente, ignorando toda a arquitetura de aprovação que a rodada 5 construiu — ela só não está causando dano agora porque (aparentemente) nada mais a está chamando desde que o cron do Vercel passou a apontar para a rota Next.js nova.

**Ação — dividida em duas partes, P2-A (Fredson, fora do código) e P2-B (Antigravity, código):**

**P2-A — Fredson, direto no painel do Supabase, 2 minutos, em paralelo ao P2-B:** entrar em Edge Functions → `payout-sweep` → Cron/Schedules, e também em Database → Cron Jobs/`pg_cron`, se houver, e confirmar que **não existe nenhum agendamento apontando para essa função** hoje. Se existir algum, desativar imediatamente e me avisar — significaria que o app já está mandando dinheiro automaticamente por um caminho que ninguém está olhando, e nesse caso vale conferir se algum repasse saiu por esse caminho sem aprovação e sem checar `split_enabled` desde a rodada 5.

**P2-B — Antigravity, código, pode ser feito independente do resultado do P2-A** (neutralizar o arquivo é seguro de qualquer forma, já que ele só deve retornar sem fazer nada): substituir o conteúdo de `supabase/functions/payout-sweep/index.ts` por um handler que só loga um aviso de depreciação e retorna sem fazer nada (mais simples e mais seguro do que apagar o arquivo, porque não depende de lembrar de remover o deploy da função também) — ex.: `return new Response(JSON.stringify({ deprecated: true, message: 'payout-sweep foi substituída pela rota /api/asaas/sweep (rodada 5) — esta função não deve mais transferir dinheiro.' }))`, sem nenhuma chamada ao Asaas.

---

## P3 — Consolidar a autenticação duplicada das rotas novas da rodada 5

As rotas novas criadas na rodada 5 (`api/asaas/withdrawals`, `api/admin/withdrawals`, `api/admin/withdrawals/[id]/approve`, `api/admin/withdrawals/[id]/reject`, `api/admin/payout-settings`) não usam `authorizeRequest()` de `lib/apiAuth.ts` como o resto do projeto — cada uma reimplementa sua própria função local (`authorizePartner`/`authorizeAdmin`) que decodifica o Bearer token e confere o `role` na tabela `users` por conta própria. Funcionalmente parece equivalente ao que `authorizeRequest` já faz, mas é exatamente o tipo de duplicação que a rodada 3 (P0-B) já tinha identificado como fonte de bugs futuros — se `authorizeRequest` ganhar uma correção (ex.: um novo tipo de token, um caso de borda de role), essas cinco rotas não recebem automaticamente.

**Ação, sem pressa (não é crítico, é consistência):** trocar as funções locais `authorizePartner`/`authorizeAdmin` por chamadas a `authorizeRequest(request, ['loja','fornecedor','motorista'])` / `authorizeRequest(request, ['admin'])`, no mesmo padrão do restante do projeto. Testar as cinco rotas depois (saldo, solicitar saque, listar admin, aprovar, rejeitar) para garantir que o formato de retorno de `authorizeRequest` (`auth.profile`/`auth.user`) fornece os mesmos campos que essas rotas hoje leem direto de `dbUser`.

---

## P4 — Selo "Serviços financeiros ASAAS" nas telas de movimentação de valores

Confirmei em `apps/mobile/src/app/cadastro/page.tsx` que os Termos de Uso já citam o Asaas por extenso (ótimo, ver confirmações no final) — mas em nenhuma tela do app existe o selo visual do Asaas. O "Playbook de BaaS para clientes Asaas" (documento oficial, recebido do suporte) exige isso, além do texto, nas telas onde há movimentação/gestão de valores.

**URLs do selo, recebidas diretamente do suporte Asaas e confirmadas por e-mail pela Eliana como "o link do seu selo individual"** (diferente das de exemplo do próprio playbook, que trazem `id=XXXX` e o aviso explícito de não usar em produção — estas já são as definitivas de produção, não precisa confirmar de novo):
- Colorido/positivo (fundo claro): `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=55be4694-40a6-46bd-8342-0a8f310e627b`
- Negativo preto (fundo claro, monocromático): `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=55be4694-40a6-46bd-8342-0a8f310e627b`
- Negativo branco (fundo escuro): `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=55be4694-40a6-46bd-8342-0a8f310e627b`

**Ação:**
1. Criar `components/SeloAsaas.tsx`, um componente único que recebe uma prop de variante (`positivo` | `negativo-preto` | `negativo-branco`) e renderiza:
   ```html
   <img src="<url da variante>" alt="Selo Banco Asaas" width="160" height="48" style="display: inline-block;" />
   ```
   **Não** aplicar `referrer-policy="no-referrer"` nessa tag — o Asaas usa o referrer para confirmar que o selo está carregando na aplicação certa. Se for usado como link (`<a href="https://asaas.com" target="_blank" rel="noopener noreferrer">`), seguir esse padrão exato.
2. Exibir nas telas com movimentação/gestão de valores: tela de ativação/vinculação de subconta do parceiro (`cadastro/page.tsx`, próximo ao bloco "Homologação Asaas & Split Automático"), checkout/pagamento do cliente, e a nova tela de saldo/saque do parceiro (`Meus Ganhos`, da rodada 5).
3. Centralizar o `id` da URL só no componente — se o Asaas trocar o id no futuro, muda em um lugar só.

---

## P5 — Alinhar a cláusula de Termos de Uso ao texto oficial do playbook enviado pela Eliana

Os Termos de Uso hoje (`cadastro/page.tsx`, linhas 329/339/348) já citam "Asaas IP S.A. (CNPJ 19.540.550/0001-21)" e a Resolução Conjunta nº 16/2025 — substancialmente correto. Mas o "Playbook de BaaS para clientes Asaas" — documento oficial, enviado diretamente pela Eliana junto com os links do selo — já traz o modelo de cláusula pronto, com a razão social exata a usar:

**Texto oficial do playbook (usar esta redação, adaptando só o nome da tomadora para "AçaíFood"):**

> "Os serviços financeiros e de pagamentos disponibilizados por meio da presente plataforma, incluindo abertura e manutenção de conta de pagamento, processamento de transações, emissão de boletos, transferências, pagamentos e demais movimentações de valores, são prestados pelo **ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A.**, instituição de pagamento autorizada a funcionar pelo Banco Central do Brasil.
>
> A AçaíFood atua exclusivamente como integradora tecnológica e distribuidora da experiência do produto, não sendo instituição financeira ou de pagamento, nem realizando intermediação financeira em nome próprio.
>
> O cliente declara ciência de que o relacionamento financeiro/de pagamentos e a responsabilidade regulatória pelos serviços acima descritos são do ASAAS GESTÃO FINANCEIRA S.A., nos termos da regulamentação vigente."

**Ação:** nas três ocorrências (linhas 329/339/348 de `cadastro/page.tsx`, e no mesmo trecho de `politica-de-privacidade/page.tsx` se houver equivalente), manter a menção ao CNPJ 19.540.550/0001-21 que já está lá, mas trocar/complementar "Asaas IP S.A." pela razão social completa do playbook: **"Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A.), CNPJ 19.540.550/0001-21"** — assim o texto casa exatamente com o que o documento oficial do Asaas pede, sem depender de confirmação adicional, já que o próprio playbook é a fonte oficial.

---

## Fora do escopo deste prompt (ação de negócio, não é código, é a mais urgente de todas)

Isto não muda de uma rodada para outra e continua sendo a prioridade nº 1, fora do código: segundo a documentação pública do Asaas, toda conta-pai nova opera sob **período de avaliação de até 60 dias desde a criação da primeira subconta em produção**, com limite de **10 subcontas** e **R$ 2.000,00 por subconta** em cobranças — ao estourar qualquer um, o Asaas bloqueia novas cobranças/subcontas e cancela assinaturas automaticamente, e **só a conclusão da homologação regulatória remove essas restrições**. Se ainda não foi feito: levantar a data da primeira subconta em produção e a contagem atual de subcontas, e tratar a homologação (contrato de BaaS + checklist de Segurança da Informação) como prazo mais urgente que qualquer item de código deste prompt.

Também continuam de pé, das rodadas anteriores:
- Rotacionar chaves de produção e checar o histórico do Git por `.env` commitados por engano (rodada 4).
- Assinar formalmente o contrato de BaaS e confirmar com o suporte se a subconta pode receber cobrança antes da aprovação geral (rodada 3, ainda em aberto).
- Prazo regulatório final: 31/12/2026.

**Novo, confirmado por e-mail da Eliana (Asaas, Experiência do Cliente):** a homologação BaaS está formalmente em andamento. Passos pendentes do lado de negócio (não de código): (1) aplicar o selo no front-end (código — ver P4 acima); (2) depois de aplicado, preencher o formulário oficial (`https://docs.google.com/forms/...`) e informar à Eliana o e-mail usado nele; (3) responder ao e-mail dela com a descrição do modelo de negócio, jornada do cliente final, canais de oferta, links públicos da empresa, e as estimativas de volume de clientes/subcontas e volume financeiro mensal — esse rascunho de resposta já foi preparado em conversa separada com o Fredson.

---

## Ordem recomendada de execução (só os itens de código desta rodada)

1. **P2-B** (neutralizar a Edge Function órfã) — primeiro de todos, é o item com maior risco financeiro silencioso da lista. Fredson faz o P2-A (checagem no painel Supabase) em paralelo, não precisa esperar um pelo outro.
2. **P1** (webhook commercial_info) — rápido, uma linha, resolve um risco real de liberar split antes da hora.
3. **P0** (GRANT status) — independente, pode ser feito em paralelo, migration nova testada em homologação primeiro.
4. **P4** (selo) — já pronto para aplicar, links confirmados pela Eliana, sem nenhuma dependência pendente.
5. **P5** (razão social nos Termos) — rápido, texto já definido pelo playbook oficial, pode ser feito a qualquer momento.
6. **P3** (consolidar autenticação duplicada) — menor prioridade, quando sobrar tempo.

---

## O que já está confirmado como corrigido (não precisa revisar de novo)

Conferido direto no código atual, não nos prompts anteriores:

- **Rodada 3 — P0/P0-B** (cota de fundador divergente): `admin/activation-config/route.ts` hoje exige `authorizeRequest(['admin'])` no `GET` e usa `getFounderQuotaStatus()` como fonte única (não duplica mais a lógica). `admin/ads/route.ts` também exige `authorizeRequest(['admin'])` no `GET`. Confirmado corrigido.
- **Rodada 3 — P1** (capturar `apiKey` da subconta): `subaccount/route.ts` extrai `accountData.apiKey` e grava em `asaas_account_api_key` (migration `20260917000000_add_asaas_account_tracking.sql` existe). Confirmado corrigido.
- **Rodada 3 — P2** (status otimista): `subaccount/route.ts` grava `asaas_account_status: 'PENDING_DOCUMENTS'` e `split_enabled: false` na criação, não mais `APPROVED`/`true`. Confirmado corrigido.
- **Rodada 3 — P3** (fluxo de documentos): existe `apps/mobile/src/app/api/asaas/documents/`. Não foi revisado linha a linha nesta sincronização, mas a estrutura existe.
- **Rodada 3 — P4** (webhook de eventos de conta): `asaas-webhook/index.ts` trata os eventos `ACCOUNT_STATUS_*` e grava `account_status_history`. Implementado — só o P1 deste prompt (COMMERCIAL_INFO) precisa de ajuste fino.
- **Rodada 3 — P5** (Termos de Uso citando o Asaas): feito, e mais completo do que o pedido original — cita CNPJ e a Resolução 16/2025 explicitamente. Só o P5 deste prompt (nome da instituição) é um ajuste fino, não uma correção.
- **Rodada 4 — P4.2** (não verificado nesta sincronização — confirmar depois).
- **Rodada 5 — completa**: migration `withdrawal_requests` + colunas de `platform_settings` existe; `lib/partnerBalance.ts`, `lib/withdrawalApproval.ts`, `lib/asaasTransferHelpers.ts` existem; `api/asaas/withdrawals`, `api/admin/withdrawals` (+ `[id]/approve`, `[id]/reject`), `api/admin/payout-settings` existem; `api/asaas/transfer` foi travado para `authorizeRequest(['admin'])` só (rodada 5, P4); `api/asaas/sweep/route.ts` foi corretamente repropositado para processar `withdrawal_requests` via `processWithdrawalApproval()`, respeitando `auto_payout_enabled`/horário/fuso. Tudo isso implementado como a rodada 5 pediu — a única peça que ficou de fora foi a Edge Function antiga no Supabase (`payout-sweep/index.ts`), que é o P2 deste prompt.
