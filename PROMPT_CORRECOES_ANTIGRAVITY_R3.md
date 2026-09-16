# Prompt de Correções — Rodada 3 (AçaíFood / AppAçaíBelém)

> Contexto para o agente: as rodadas 1 e 2 (`PROMPT_CORRECOES_ANTIGRAVITY.md` e `PROMPT_CORRECOES_ANTIGRAVITY_R2.md`) já foram aplicadas e confirmadas — segurança de RLS, `partner_ledger`, cota de fundador centralizada e logs sensíveis do `payout-sweep` estão corrigidos. Esta rodada 3 é resultado de uma auditoria completa do backend do projeto (todas as rotas de API, libs de pagamento/cota, Edge Functions e textos legais) e junta três frentes num único prompt: (1) um bug de coerência já observado em produção — o painel admin mostra "7 de 30 vagas fundador" enquanto a tela pública de cadastro mostra "50 de 50 vagas" — e sua causa estrutural (lógica de cota triplicada e duas rotas `/admin/*` sem autenticação, achadas durante a auditoria); (2) a adequação completa do fluxo de subcontas à Resolução Conjunta nº 16/2025 (BaaS) e ao fluxo real de aprovação do Asaas — hoje uma subconta é marcada como `APPROVED` e liberada para split no instante em que é criada, sem nunca confirmar se a documentação (identificação + selfie) foi de fato enviada e aprovada.

**Decisão de produto confirmada:** o envio de documento e selfie deve acontecer **dentro do AçaíFood** (não redirecionar o parceiro para fora do app). Isso é o modelo BaaS do Asaas. Importante: a **selfie e o documento de identificação não podem ser enviados via `POST` direto pela API** — o Asaas exige que esse grupo específico seja enviado pelo `onboardingUrl` que a própria API retorna, porque é lá que roda o reconhecimento facial deles ("Não substitua esse fluxo por `POST /v3/myAccount/documents/{id}`"). "Dentro do AçaíFood" aqui significa abrir esse `onboardingUrl` embutido no app (modal/WebView), não construir uma câmera própria. Documentos avulsos sem `onboardingUrl` (ex: `type: CUSTOM`, como Ata de Eleição) podem ir via `POST` direto.

> ⚠️ **O app está em produção agora, com usuários e dinheiro real passando por ele (`acaifood.app.br`). Nenhuma correção desta rodada pode tirar o app do ar nem quebrar um fluxo que hoje funciona — cadastro, checkout, split, repasse, login.** Regras obrigatórias para toda a execução:
> 1. Aplicar e testar cada `P` isoladamente, na ordem indicada em "Ordem recomendada de execução", e confirmar que o app continua funcionando de ponta a ponta antes de passar para o próximo — não empacotar tudo num commit único e enorme.
> 2. Toda migration nova (P0-B pode não precisar, P1 precisa) primeiro roda em homologação/local, nunca direto em produção — mesma regra que já valeu para a migration do P0 da rodada 2.
> 3. Mudanças de contrato de API (campos que somem, mudam de nome ou de formato numa resposta) precisam continuar compatíveis com o que o frontend já espera — se for preciso mudar o formato, atualizar os dois lados (rota e tela) no mesmo commit, não em commits separados que deixem a produção inconsistente por um tempo.
> 4. P2 (parar de liberar `split_enabled = true` automaticamente) é o item com maior chance de mudar comportamento visível para parceiros reais que já usam o app — testar em homologação com um pedido de ponta a ponta (pedido → pagamento → split → repasse) antes de subir, e ter um plano de rollback claro (reverter o commit) se algo no split quebrar em produção.
> 5. Na dúvida entre uma correção mais completa e uma mais conservadora que garanta que nada quebra, preferir a conservadora e registrar o resto como pendência — não é uma corrida para fechar tudo de uma vez.

---

## P0 — CRÍTICO: painel admin e tela de cadastro mostram números de vagas diferentes

**Causa raiz confirmada (não é só visual, é um bug funcional):** `GET /api/asaas/activation` — o endpoint que devolve `freeQuota`/`freeSlotsRemaining` — exige autenticação via `authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente'])` (`apps/mobile/src/app/api/asaas/activation/route.ts`, linha 11). `authorizeRequest` (`lib/apiAuth.ts`) só aceita segredo interno, segredo de webhook, ou um JWT válido do Supabase — **não existe caminho anônimo**.

O problema: `apps/mobile/src/app/cadastro/page.tsx`, linha 74, chama `fetch('/api/asaas/activation')` **sem nenhum header de autenticação**, e nesse ponto do fluxo a pessoa ainda **não tem conta nem sessão** — está literalmente na tela de "Crie sua Conta". Essa chamada sempre recebe `401` do backend. O front trata isso assim (linhas 76-88):
```
.then(data => {
  if (data && data.success) { setActivationInfo(...) }
})
.catch(_e => console.warn(...))
```
Como a resposta 401 ainda é um JSON válido (só que sem `success: true`), o `.then` roda mas o `if` falha silenciosamente — nunca cai no `.catch`, nunca loga erro, nunca atualiza o estado. O componente fica travado para sempre no valor inicial hardcoded (linhas 52-59): `freeQuota: 50, freeSlotsRemaining: 50, isFree: true`.

Ou seja: **todo visitante que abre a tela de cadastro vê "100% GRÁTIS, restam 50 de 50 vagas" — um valor fixo no código, nunca o valor real —, independente de quantas vagas já foram usadas de verdade.** O painel admin, que já está autenticado como admin, é o único lugar que recebe o dado correto (`7 de 30` no exemplo da captura de tela — o que já é internamente consistente: `7 usadas + 23 restantes = 30 total`, confirmado pelos cards "VAGAS FUNDADOR USADAS" e "ATIVAÇÕES GRATUITAS RESTANTES" do mesmo painel). Isso é potencialmente um problema de propaganda enganosa (CDC), não só um bug de exibição — o app está prometendo uma vaga gratuita para todo mundo mesmo quando as vagas reais já acabaram.

**Ação:**
1. Separar o `GET` de `activation/route.ts` em duas partes:
   - **Consulta pública de cota** (sem `userId`, ou um modo explícito tipo `?public=1`): não exigir autenticação — retornar só `activationEnabled`, `activationFee`, `freeQuota`, `subsidizedCount`, `freeSlotsRemaining`, `isFree`. Esses dados não são sensíveis, são a mesma vitrine que qualquer visitante veria.
   - **Consulta de status de um usuário específico** (`userId` presente, bloco de `userActivationStatus`, linhas 29-74 do arquivo): continuar exigindo autenticação e a checagem de dono já existente (linha 21-23: `callerId !== userId`) — isso não muda, é dado sensível de pagamento.
2. No front (`cadastro/page.tsx`), remover a dependência silenciosa do `success` sem tratamento de erro visível: se a consulta pública falhar de verdade (erro de rede, servidor fora), mostrar um estado de carregamento/indisponível em vez de continuar exibindo o valor hardcoded como se fosse real.
3. Depois de corrigido, testar a tela de cadastro deslogado (aba anônima) e confirmar que o número batе com o painel admin em tempo real.

---

## P0-B — CRÍTICO: a mesma cota tem TRÊS implementações independentes, e duas rotas `/admin/*` não exigem admin

Fazendo uma auditoria em todas as rotas de API do projeto (`apps/mobile/src/app/api/**/route.ts`), cruzando cada uma com `authorizeRequest`/`isAuthorizedRequest` de `lib/apiAuth.ts`, achei a causa estrutural por trás do P0 e mais dois problemas do mesmo tipo:

**1. A configuração de cota/taxa de ativação (`activationFee`, `freeQuota`, `activationEnabled`) é lida e calculada de forma independente em TRÊS lugares diferentes**, todos fazendo `JSON.parse` da mesma coluna `platform_settings.asaas_platform_wallet_id` com sua própria cópia dos valores-padrão:
   - `lib/founderQuota.ts` → `getFounderQuotaStatus()` (usado por `asaas/activation/route.ts` e `asaas/subaccount/route.ts`)
   - `admin/activation-config/route.ts`, `GET` (linhas 7-71) — tem sua própria cópia da lógica de contagem de parceiros e cálculo de vagas, **sem chamar** `getFounderQuotaStatus()`
   - `admin/activation-config/route.ts`, `POST` (linhas 73-129) — mais uma cópia dos valores-padrão (`activationFee ?? 12.90`, `freeQuota ?? 50`) para o merge ao salvar

   Hoje os três calculam o mesmo resultado porque a fórmula é simples e foi copiada de forma consistente, mas é exatamente esse tipo de duplicação que gerou o bug do P0 e vai gerar outros: qualquer ajuste futuro na regra (por exemplo, excluir parceiros com `status = 'blocked'` da contagem) só seria feito automaticamente em UM dos três lugares, criando um novo caso do mesmo tipo de divergência. **Ação: eliminar as cópias em `admin/activation-config/route.ts` e fazer os dois handlers chamarem `getFounderQuotaStatus()` de `lib/founderQuota.ts` como única fonte da verdade — igual já foi feito no P1.2 da rodada 2 para outros pontos que usavam essa função.**

**2. `GET /api/admin/activation-config` e `GET /api/admin/ads` não chamam `authorizeRequest` em nenhum momento** — apesar do prefixo `/admin/`, que em todas as outras rotas (`admin/delete-user`, `admin/clear-data`, `admin/reset-balances`, `admin/media-upload`, e o `POST` desses dois mesmos arquivos) sempre exige `['admin']`. Ou seja, qualquer pessoa não autenticada pode chamar `GET /api/admin/activation-config` e `GET /api/admin/ads` diretamente e ver os dados de configuração administrativa. O de `activation-config` não é gravemente sensível (é basicamente o mesmo dado que o P0 já propõe tornar público de forma explícita e intencional), mas **do jeito que está hoje é público por esquecimento, não por decisão** — e o de `ads` reforça o padrão. **Ação: decidir explicitamente, para cada um, se o `GET` deve ser público (e nesse caso remover do namespace `/admin/` e mover para uma rota sem esse prefixo, para não confundir) ou exigir `authorizeRequest(request, ['admin'])` como os demais — não deixar implícito.**

**3. A coluna `platform_settings.asaas_platform_wallet_id` está sendo usada como um "balde" de configuração JSON para duas features sem relação nenhuma** — cota/taxa de ativação de fundador E lista de anúncios comerciais (`admin/ads/route.ts`) — apesar do nome da coluna sugerir que ela deveria guardar o walletId da conta pai no Asaas (usado pelo split). Isso já é confuso por si só, e os dois handlers de `POST` (`admin/activation-config` e `admin/ads`) fazem leitura-mescla-escrita (`SELECT` → merge no JS → `UPDATE`) na mesma linha **sem nenhum controle de concorrência** — se dois admins salvarem parâmetros ao mesmo tempo (ou o mesmo admin em duas abas), a segunda escrita pode sobrescrever silenciosamente a primeira. Hoje o risco prático é baixo (painel de admin único, uso esporádico), mas vale registrar como dívida técnica. **Ação, se houver tempo nesta rodada:** separar em colunas/tabelas próprias (`platform_activation_settings`, `platform_ads`) em vez de JSON dentro de uma coluna nomeada para outra coisa; se não houver tempo, ao menos renomear a chave de configuração para algo que não colida com um nome de campo de conta Asaas, e documentar no código o motivo do reuso.

---

## P1 — PRÉ-REQUISITO: capturar e armazenar a apiKey de cada subconta

**Problema:** `apps/mobile/src/app/api/asaas/subaccount/route.ts` (bloco de criação, por volta da linha 136-155) só extrai `walletId` e `accountId` da resposta de `POST /v3/accounts`. A resposta também traz um campo `apiKey`, específico daquela subconta, que **não está sendo salvo em lugar nenhum**.

**Por que isso bloqueia o restante do prompt:** os endpoints `GET /v3/myAccount/documents`, `GET /v3/myAccount/status` e `POST /v3/myAccount/documents/{id}` operam sobre "minha conta" — ou seja, autenticam com a apiKey da própria subconta, não com a apiKey da conta pai (`ASAAS_API_KEY` / `getAsaasApiKey()`). Sem guardar essa apiKey por parceiro, é impossível consultar ou enviar documentos em nome dele.

**Ação:**
1. Nova coluna em `users`: `asaas_account_api_key` (ou equivalente) — migration nova em `supabase/migrations/` seguindo o padrão de nome com timestamp (ex: `20260917000000_add_asaas_account_tracking.sql`).
2. Essa coluna guarda um dado sensível (equivalente a uma senha de acesso à conta bancária do parceiro no Asaas) — **não pode ficar em texto puro acessível por RLS padrão**. Seguir o mesmo padrão já usado para a apiKey da conta pai (ver `20260901040000_asaas_key_vault_fallback.sql` e `lib/asaasConfig.ts` — `getAsaasApiKey()`) para armazenar/recuperar com o mesmo nível de proteção (vault/Service Role, nunca exposta a `anon`/`authenticated`).
3. Em `subaccount/route.ts`, ao criar a subconta com sucesso, capturar `accountData.apiKey` e gravar nessa coluna junto com `walletId`/`accountId`.
4. Para subcontas que já foram criadas antes desta correção (sem apiKey salva): não dá para recuperar a apiKey retroativamente pela API — ela só é retornada uma vez, na criação. Registrar isso como pendência manual (provavelmente precisa recriar/vincular a subconta ou pedir a apiKey via suporte Asaas para quem já foi criado).

---

## P2 — Corrigir o status otimista da subconta

**Problema:** ainda em `subaccount/route.ts` (por volta da linha 164-174), a subconta é gravada como:
```
asaas_account_status: 'APPROVED',
split_enabled: true
```
imediatamente após `POST /v3/accounts` retornar um `walletId` — antes de qualquer documento ser enviado ou aprovado.

**Ação:**
1. Trocar o valor inicial de `asaas_account_status` para `'PENDING_DOCUMENTS'`.
2. **Não** setar `split_enabled: true` neste momento. Esse campo só deve virar `true` quando a aprovação geral for confirmada (ver P4, via webhook). Até lá, o parceiro fica com a subconta criada mas o split para ele desabilitado — ajustar a lógica de checkout/split para tratar esse caso (não incluir esse parceiro no split automático, ou reter o valor dele) até `split_enabled = true`.
3. Nota de escopo: ainda não temos confirmação do Asaas se uma subconta consegue **receber** cobrança antes da aprovação geral, ficando só a **transferência/saque** bloqueada, ou se fica tudo bloqueado. Essa pergunta já foi enviada ao suporte (Eliana). Até a resposta, tratar de forma conservadora: sem aprovação geral confirmada, sem split liberado para esse parceiro.

---

## P3 — Fluxo de consulta e envio de documentos dentro do app

**Ação — novo endpoint backend**, ex: `apps/mobile/src/app/api/asaas/documents/route.ts`:
1. `GET`: recebe `userId`, busca a apiKey da subconta dele (coluna do P1), aguarda pelo menos 15 segundos após a criação da subconta (se for logo em seguida) e chama `GET /v3/myAccount/documents` autenticado com a apiKey daquela subconta. Retorna ao front quais documentos faltam e, para cada um, se tem `onboardingUrl`.
2. Para grupos **sem** `onboardingUrl` (documentos avulsos tipo `CUSTOM`): endpoint adicional para `POST /v3/myAccount/documents/{id}` com o arquivo enviado pelo parceiro direto no app.
3. Para o grupo identidade + selfie (**sempre** tem `onboardingUrl`): o front não tenta montar upload próprio — só abre o `onboardingUrl` retornado, embutido no app (modal ou WebView), e mostra uma mensagem deixando claro que aquela etapa acontece no ambiente do Asaas por exigência de verificação facial (isso também ajuda a cumprir a exigência de identificação visível do prestador da Resolução 16/2025).

**Ação — UI do parceiro** (tela de perfil/painel de cada parceiro, ex: `/parceiros/*`):
1. Mostrar o status atual: "Documentação pendente", "Em análise" (`AWAITING_APPROVAL`), "Aprovado", ou "Rejeitado — reenviar" (se rejeitado, chamar o `GET` de novo para pegar um `onboardingUrl` novo, conforme a documentação do Asaas: "se um documento for rejeitado, um novo link será gerado").
2. Enquanto não aprovado, deixar claro para o parceiro que ele ainda não vai receber repasses automáticos.

---

## P4 — Escutar os eventos de status de conta no webhook

**Problema:** `supabase/functions/asaas-webhook/index.ts` hoje só trata `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`. Não existe nenhum tratamento para os eventos de aprovação de conta, então o app nunca fica sabendo automaticamente quando uma subconta é aprovada, rejeitada, ou quando a documentação expira.

**Eventos a adicionar** (mesma validação de token que já existe no arquivo, linhas 6-15 — `asaas-access-token` / `ASAAS_WEBHOOK_TOKEN` — não duplicar essa lógica, só estender o `if` de eventos tratados):

- `ACCOUNT_STATUS_DOCUMENT_APPROVED`, `ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL`, `ACCOUNT_STATUS_DOCUMENT_PENDING`, `ACCOUNT_STATUS_DOCUMENT_REJECTED`
- `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`, `ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL`, `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING`, `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED`
- `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED/_AWAITING_APPROVAL/_PENDING/_REJECTED/_EXPIRING_SOON/_EXPIRED`
- `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED/_AWAITING_APPROVAL/_PENDING/_REJECTED`

**Ação:**
1. **Antes de mapear os campos**, logar o corpo bruto (`console.log(JSON.stringify(body))`, só nesses eventos de conta, temporariamente) de um evento real em homologação para confirmar como o Asaas identifica a conta no payload (provavelmente `account.id` e/ou `account.walletId` — a documentação pública não deixa o schema exato explícito). Usar esse campo para casar com `asaas_account_id`/`asaas_wallet_id` em `users`.
2. Ao receber `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`: atualizar `asaas_account_status = 'APPROVED'` e **só aqui** `split_enabled = true` para aquele parceiro.
3. Ao receber `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED` ou `ACCOUNT_STATUS_DOCUMENT_REJECTED`: atualizar `asaas_account_status = 'REJECTED'`, manter `split_enabled = false`.
4. Ao receber `ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL`: atualizar para `'AWAITING_APPROVAL'` (estado intermediário, para a UI do P3 mostrar "em análise").
5. Registrar cada mudança em `order_status_history` ou tabela equivalente de auditoria, no mesmo padrão já usado para pedidos (ver o restante do `asaas-webhook/index.ts`), mas para conta — se não existir uma tabela de histórico de conta, avaliar criar uma simples (`account_status_history`) em vez de reaproveitar `order_status_history`, que é por pedido.
6. Remover o `console.log` de debug do item 1 antes de considerar a rodada concluída, ou reduzi-lo a campos não sensíveis.

---

## P5 — Termos de Uso: identificar o Asaas como prestador do BaaS

**Problema:** `getTermosText()` em `apps/mobile/src/app/cadastro/page.tsx` (por volta da linha 318) não menciona o Asaas em nenhum dos três blocos de perfil (cliente, loja/fornecedor, motorista) — mas a Resolução Conjunta nº 16/2025 exige que a identificação do prestador apareça em contratos e documentos.

**Ação:** adicionar um item (comum aos três perfis, ou pelo menos aos de parceiro que têm subconta) explicando que os pagamentos, custódia e repasses são processados pela instituição parceira **Asaas IP S.A.**, nos mesmos termos já usados na Política de Privacidade (`politica-de-privacidade/page.tsx`, linha 58/91) — manter a redação consistente entre os dois documentos.

---

## Ordem recomendada de execução

1. **P0 + P0-B juntos** — são o mesmo bug raiz visto de dois ângulos (o endpoint errado sendo chamado sem auth, e a causa estrutural de por que existem números divergentes). Faz sentido corrigir os dois no mesmo commit: consolidar a lógica de cota em `founderQuota.ts`, expor um modo público explícito nela, e resolver a questão de autenticação dos dois `GET` de `/admin/*` ao mesmo tempo. É o que já está afetando usuários reais em produção agora — priorizar e fazer deploy isolado, não precisa esperar o resto.
2. **P1** — sem a apiKey da subconta salva, nada do P3/P4 funciona.
3. **P2** — corrigir o status otimista logo em seguida, é o item que mais expõe a risco financeiro real (repasse liberado sem aprovação).
4. **P4** — webhook de status de conta (pode ser feito em paralelo ao P3, já que P3 é mais front-end e P4 é mais backend).
5. **P3** — fluxo de documentos na UI.
6. **P5** — rápido, pode ser feito a qualquer momento, sem dependência dos outros.

## Fora do escopo deste prompt (não são de código)

- Assinar o contrato de prestação de serviços de BaaS que o Asaas (Eliana Carvalho, suporte de integrações) vai enviar após aprovar a homologação.
- Confirmar com o Asaas se a subconta pode receber cobrança antes da aprovação geral (pergunta já enviada, aguardando resposta) — isso pode simplificar o P2 se a resposta for "sim, só o repasse é bloqueado".
- Prazo regulatório final: 31/12/2026 para toda a adequação (identificação visível + contrato).

## Escopo desta auditoria (o que foi e o que não foi revisado)

Esta rodada revisou com profundidade: todas as rotas de API em `apps/mobile/src/app/api/**` (autenticação e lógica de negócio), os módulos de `lib/` ligados a pagamento e cota (`apiAuth.ts`, `asaasConfig.ts`, `founderQuota.ts`, `payoutCalc.ts`, `pix.ts`), as Edge Functions do Asaas em `supabase/functions/`, as migrations mais recentes, e os textos legais (Termos de Uso, Política de Privacidade). **Não foi feita uma revisão linha a linha das telas grandes de UI** (`cadastro/page.tsx` e a home do cliente em `page.tsx` foram lidas em detalhe por causa do P0; `admin/page.tsx`, `parceiros/batedeira/page.tsx`, `parceiros/fornecedor/page.tsx` e `store/useAppStore.ts` — todas entre 50 mil e 240 mil caracteres — foram usadas para confirmar os números do P0/P0-B, mas não teve uma auditoria completa de toda a lógica de UI/estado nelas). Se quiser, uma próxima rodada pode focar especificamente nesses arquivos grandes de front-end, provavelmente divididos por tela.
