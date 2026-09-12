# Prompt de Execução — Correções de Segurança e Financeiro do AçaíFood

Cole este documento inteiro como instrução para o Antigravity 2.0 (ou qualquer agente de
código) trabalhar no repositório `açaifoodV1`. Ele foi escrito a partir de uma auditoria
técnica completa feita em 11/09/2026, com caminho de arquivo exato e trecho de código
apontado para cada problema, para que o agente não precise adivinhar onde mexer.

---

## Como trabalhar (leia antes de começar)

1. Execute os itens **na ordem** P0 → P1 → P2 → P3. Não pule para um item de prioridade
   menor antes de terminar os de prioridade maior.
2. Trabalhe **um item por vez**. Ao terminar cada item, rode `npm run build` (dentro de
   `apps/mobile`) e confirme que compila antes de ir para o próximo. Se algo quebrar,
   corrija antes de continuar.
3. Não altere nada fora do escopo descrito em cada item (não "aproveite" para mexer em
   estilo, formatação ou lógica não relacionada).
4. Para mudanças de banco de dados, **crie uma migration nova** em `supabase/migrations/`
   com timestamp atual — nunca edite uma migration antiga que já foi aplicada em produção.
5. **Não invente nem grave valores reais de chaves/segredos.** Vários itens abaixo pedem
   para trocar o *nome* de uma variável de ambiente ou remover uma variável do código —
   isso é diferente de gerar o valor novo do segredo. A troca do **valor** de qualquer
   chave (Asaas, Supabase, tokens internos) é uma ação manual que o Fredson vai fazer nos
   painéis da Vercel/Supabase/Asaas, listada na seção "Ações fora do código" no final
   deste documento. Sua parte é garantir que o código passe a ler a variável certa.
6. Ao final de cada item, escreva um resumo curto do que foi alterado (arquivos tocados +
   o que mudou), para eu revisar antes do deploy.
7. Nenhum destes itens deve remover funcionalidade existente para o usuário final — são
   correções de validação/segurança, não mudanças de produto.

---

## P0 — Fazer hoje (falhas críticas exploráveis agora)

### P0.1 — Impedir que o usuário se autopromova a administrador (RLS + trigger)

**Problema:** a política de UPDATE de `public.users` permite que o próprio usuário altere
qualquer coluna da própria linha, incluindo `role` e `is_admin`, e a política de INSERT
(`WITH CHECK (true)`) permite gravar `role: 'admin'` já no cadastro. Isso dá acesso total
ao painel `/admin` para qualquer pessoa que queira.

**Arquivo a criar:** `supabase/migrations/<timestamp>_fix_users_privilege_escalation.sql`

**O que implementar:**

1. Revogar a permissão de UPDATE geral sobre `public.users` do papel `authenticated` e
   conceder de volta apenas para as colunas de perfil que o próprio usuário deve poder
   editar (nome, telefone, foto, endereço, chave pix, cpf/cnpj etc. — **investigue no
   schema atual (`master_clean_schema.sql` + migrations) a lista completa de colunas da
   tabela `users`** e monte a lista de colunas "seguras". Nunca inclua `role`, `is_admin`,
   `status`, `asaas_wallet_id`, `asaas_account_id`, `split_enabled` nessa lista — essas só
   podem ser alteradas por `service_role` ou por RPC controlada.

   ```sql
   REVOKE UPDATE ON public.users FROM authenticated;
   GRANT UPDATE (name, phone, avatar_url, cpf_cnpj, pix_key, address /* + demais colunas de perfil legítimas */)
     ON public.users TO authenticated;
   ```

2. Criar um trigger `BEFORE INSERT OR UPDATE` que nunca deixa `role` virar
   `admin`/`administrador`/`partner_admin` nem `is_admin` virar `true`, a menos que a
   operação seja feita por `service_role` (painel admin/backend) ou por alguém que **já**
   seja admin antes da alteração:

   ```sql
   CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
   RETURNS TRIGGER AS $$
   DECLARE
     v_caller_is_admin boolean := false;
   BEGIN
     IF auth.role() = 'service_role' THEN
       RETURN NEW;
     END IF;

     BEGIN
       SELECT public.is_admin() INTO v_caller_is_admin;
     EXCEPTION WHEN OTHERS THEN
       v_caller_is_admin := false;
     END;

     IF NOT v_caller_is_admin THEN
       IF lower(COALESCE(NEW.role, '')) IN ('admin', 'administrador', 'partner_admin') THEN
         NEW.role := COALESCE(NULLIF(OLD.role, ''), 'cliente');
       END IF;
       NEW.is_admin := COALESCE(OLD.is_admin, false);
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

   DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
   CREATE TRIGGER trg_prevent_role_escalation
   BEFORE INSERT OR UPDATE ON public.users
   FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();
   ```

   > Ajuste a lista de valores de papel de administrador (`admin`, `administrador`,
   > `partner_admin`) se o schema usar outros nomes — confira em `is_admin()` (arquivo
   > `supabase_performance_patch.sql` / migration `20260902000000_...`) e em
   > `apps/mobile/src/lib/apiAuth.ts` quais valores de `role` existem hoje para não
   > quebrar o cadastro de lojas, fornecedores e motoristas.

**Critério de aceite:** um usuário autenticado comum que chame
`supabase.from('users').update({ role: 'admin' })` ou se cadastre com `role: 'admin'`
continua com o papel original (`cliente` ou o papel de parceiro correto), sem erro para o
usuário. Um admin de verdade (via painel/service role) continua conseguindo promover
alguém.

---

### P0.2 — Remover o bypass de administrador por e-mail

**Arquivo:** `apps/mobile/src/lib/apiAuth.ts`

**Trecho atual a remover** (dentro de `authorizeRequest`):

```ts
const isAdminAuth = allowedRoles.includes('admin') && (
  userRole === 'admin' || 
  profile.is_admin === true || 
  user.user_metadata?.role === 'admin' ||
  user.email?.toLowerCase().includes('admin')
);
```

**Corrigir para:**

```ts
const isAdminAuth = allowedRoles.includes('admin') && (
  userRole === 'admin' ||
  profile.is_admin === true ||
  user.user_metadata?.role === 'admin'
);
```

Ou seja: apagar a linha `user.email?.toLowerCase().includes('admin')`. Nenhuma outra
lógica da função deve mudar.

**Critério de aceite:** um usuário com e-mail como `meuadmin2026@gmail.com` e `role`
diferente de admin no banco não consegue mais acessar rotas restritas a `['admin']`.

---

### P0.3 — Checkout: nunca confiar no valor/split enviado pelo cliente

**Arquivo:** `apps/mobile/src/app/api/asaas/checkout/route.ts`

**Problema:** a rota usa `value` e `split` exatamente como vêm do corpo da requisição do
navegador para montar a cobrança no Asaas, sem recalcular a partir do pedido salvo no
banco. Isso permite pagar menos que o devido ou redirecionar o split para uma carteira
Asaas arbitrária do próprio cliente.

**O que implementar:**

1. A rota deve receber **apenas `orderId`** do cliente (mais os dados do comprador
   necessários para criar/buscar o cliente no Asaas — nome, e-mail, CPF/CNPJ). Remova a
   confiança em `value` e `split` do corpo da requisição.
2. Buscar o pedido em `orders` (e `order_items`/`storefronts`/`platform_settings` conforme
   necessário) usando o **Service Role** (`getSupabaseAdmin`), e recalcular:
   - o valor total da cobrança (`value`) a partir dos itens/preço gravados no pedido —
     nunca do que o cliente mandar agora;
   - o split, buscando o `asaas_wallet_id` real de cada parte (loja/vendedor, motorista se
     aplicável, plataforma) diretamente das tabelas `users`/`storefronts`/
     `platform_settings` — nunca aceitar um `walletId` vindo do corpo da requisição.
3. Se o pedido não existir, não pertencer ao usuário autenticado (`buyer_id`), ou já tiver
   uma cobrança paga, recusar com erro apropriado (400/403/409).
4. Mantenha a lógica de idempotência já existente (checar cobrança existente por
   `externalReference`).

**Critério de aceite:** alterar `value` ou `split` no corpo da requisição enviada ao
endpoint não tem nenhum efeito no valor cobrado nem em quem recebe o dinheiro — ambos
sempre vêm do que está gravado no pedido no servidor.

> Dependência: para isso funcionar com segurança de ponta a ponta, o **item P1.4** (não
> confiar em `products_subtotal`/taxas enviadas pelo comprador na criação do pedido)
> precisa ser resolvido também — do contrário o "pedido salvo no banco" ainda pode ter
> sido manipulado na criação. Sinalize isso no resumo do item.

---

### P0.4 — Webhook do Asaas: segredo dedicado e falha fechada (fail-closed)

**Arquivos:**
- `supabase/functions/asaas-webhook/index.ts`
- `apps/mobile/src/lib/apiAuth.ts` (função `isValidAsaasWebhook` e `isAuthorizedRequest`)

**Problema 1 — Edge Function falha aberta:**

Trecho atual:

```ts
const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
if (expectedToken && webhookTokenHeader !== expectedToken) {
  // rejeita
}
```

Se `ASAAS_WEBHOOK_TOKEN` não estiver configurado nos Secrets do Supabase, a validação é
pulada por inteiro. Corrigir para falhar fechado:

```ts
const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
if (!expectedToken || webhookTokenHeader !== expectedToken) {
  console.error("Token do webhook Asaas ausente/inválido — requisição recusada.");
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Problema 2 — segredo de webhook reaproveitado como segredo interno:**

Em `apiAuth.ts`, tanto `isAuthorizedRequest` quanto `isValidAsaasWebhook` usam
`process.env.WEBHOOK_SECRET` (com fallback embutido `'acaifood_webhook_2026'`) e, em
`isValidAsaasWebhook`, também aceitam `INTERNAL_API_SECRET`/`NEXT_PUBLIC_INTERNAL_API_SECRET`
como prova válida de webhook. Isso significa que vazar o segredo interno também permite
forjar pagamentos.

**Corrigir `isValidAsaasWebhook` para:**

```ts
export function isValidAsaasWebhook(request: Request): boolean {
  const webhookSecret = process.env.ASAAS_WEBHOOK_TOKEN || '';
  if (!webhookSecret) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado — recusando webhook por segurança.");
    return false;
  }

  const asaasToken = request.headers.get('asaas-access-token');
  if (asaasToken && asaasToken === webhookSecret) return true;

  try {
    const url = new URL(request.url);
    const whToken = url.searchParams.get('wh_token');
    if (whToken && whToken === webhookSecret) return true;
  } catch (_e) {}

  return false;
}
```

Remova completamente o trecho que aceitava `x-internal-secret`/`INTERNAL_API_SECRET`
dentro dessa função — validação de webhook do Asaas não deve aceitar o segredo interno.

Em `isAuthorizedRequest`, troque toda referência a `process.env.WEBHOOK_SECRET` (com o
fallback `'acaifood_webhook_2026'`) por `process.env.ASAAS_WEBHOOK_TOKEN` sem fallback
padrão nenhum (se não estiver configurado, essa via de autorização simplesmente não
autentica ninguém).

**Critério de aceite:** sem `ASAAS_WEBHOOK_TOKEN` configurado, toda chamada ao webhook é
recusada (nunca aceita por omissão). O segredo interno de rotas administrativas não serve
mais para forjar um webhook de pagamento.

---

### P0.5 — Corrigir bug que trava o repasse automático (`payout-sweep`)

**Arquivo:** `supabase/functions/payout-sweep/index.ts`

**Problema:** a linha abaixo usa uma variável que nunca foi declarada no arquivo, o que
gera `ReferenceError` e derruba a função inteira assim que ela é chamada:

```ts
console.log(`[payout-sweep] Iniciando varredura (${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'})`)
```

**Corrigir** declarando a variável logo após obter `ASAAS_API_KEY`:

```ts
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada nos Supabase Secrets')

const isSandbox = ASAAS_API_KEY.startsWith('$aact_hmlg_')
const ASAAS_URL = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3'
```

(hoje `ASAAS_URL` está fixo em produção — usar a mesma lógica de `getAsaasBaseUrl` do
resto do projeto para consistência entre sandbox/produção).

**Critério de aceite:** invocar a função manualmente (`supabase functions invoke
payout-sweep`) não lança mais `ReferenceError` e o log inicial aparece corretamente.

---

## P1 — Fazer esta semana

### P1.1 — Transferência Pix (`/api/asaas/transfer`) sem validação de valor devido

**Arquivo:** `apps/mobile/src/app/api/asaas/transfer/route.ts`

**Problema:** quando `orderId` é informado, o código só verifica se o pedido já foi pago
(`payout_seller_done`/`payout_driver_done`), nunca se o `value` enviado bate com o valor
realmente devido pelo pedido.

**O que implementar:**

1. Quando `orderId` é informado: **ignore o `value` do corpo da requisição** e recalcule o
   valor devido no servidor, usando exatamente a mesma fórmula já usada em
   `supabase/functions/payout-sweep/index.ts` (função `buildTransferBody` +
   cálculo de `sellerValue`/`driverValue` a partir de `products_subtotal`,
   `applied_platform_fee_percent`, `delivery_distance_km`, `applied_delivery_fee_per_km`
   etc.). Extraia essa fórmula para um módulo compartilhado (`lib/payoutCalc.ts`) usado
   tanto pelo `payout-sweep` quanto por esta rota, para não haver duas implementações que
   podem divergir.
2. Quando **não** há `orderId` (resgate/saque avulso do parceiro): hoje não existe no
   banco uma tabela de saldo disponível por parceiro para validar contra isso. **Não
   implemente uma trava aproximada** — em vez disso:
   - Como correção imediata (P1), **desative esse caminho** (saque avulso sem `orderId`)
     retornando erro 400 "Saque avulso temporariamente indisponível — use o saque vinculado
     ao pedido", até que o item **P2.1 (ledger de saldo por parceiro)** seja implementado.
   - Documente isso claramente no resumo do item para eu decidir se aceito a restrição
     temporária ou priorizo o ledger antes.

**Critério de aceite:** um parceiro não consegue mais receber, via `orderId`, um valor
diferente do calculado pelo servidor para aquele pedido. Saques sem `orderId` retornam
erro controlado em vez de executar a transferência.

---

### P1.2 — Rotacionar variáveis de segredo interno duplicadas (código)

**Arquivos:** `apps/mobile/.env.example` (crie se não existir), `apps/mobile/src/lib/apiAuth.ts`

1. Remova qualquer leitura de `process.env.NEXT_PUBLIC_INTERNAL_API_SECRET` no código
   (deixe só `INTERNAL_API_SECRET`, sem prefixo `NEXT_PUBLIC_`). Já cobrimos o uso dentro
   de `isValidAsaasWebhook` no item P0.4 — confirme que não sobrou nenhuma outra
   referência (`grep -rn "NEXT_PUBLIC_INTERNAL_API_SECRET"`).
2. Garanta que nenhum componente com `'use client'` importe `INTERNAL_API_SECRET`,
   `ASAAS_WEBHOOK_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` — só arquivos de rota (`route.ts`)
   e `lib/*.ts` usados apenas no servidor.
3. Crie/atualize um `.env.example` (sem valores reais) documentando as variáveis
   esperadas: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`,
   `INTERNAL_API_SECRET`, `ASAAS_WEBHOOK_TOKEN` (novo nome, substitui `WEBHOOK_SECRET`),
   `NEXT_PUBLIC_ASAAS_WALLET_ID`, `NEXT_PUBLIC_PLATFORM_PIX_KEY`.

**Critério de aceite:** nenhuma variável de segredo sensível tem prefixo `NEXT_PUBLIC_`.

---

### P1.3 — Exigir autenticação em `/api/asaas/activation`

**Arquivo:** `apps/mobile/src/app/api/asaas/activation/route.ts`

**Problema:** o `POST` (e o `GET`, que também revela dados de ativação) não chamam
`authorizeRequest` — qualquer chamador não autenticado pode informar `userId` de outra
pessoa.

**O que implementar:**

1. No início de `POST`, adicionar:
   ```ts
   const auth = await authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista', 'cliente']);
   if (!auth.authorized) return unauthorizedResponse(auth.error);
   ```
2. Validar que `userId` do corpo é igual ao `auth.user.id` do chamador, **a menos que**
   `auth.source === 'internal_secret'` ou o papel do chamador seja admin:
   ```ts
   const callerId = auth.user?.id || auth.profile?.id;
   const isAdmin = auth.source === 'internal_secret' || String(auth.profile?.role || '').toLowerCase() === 'admin';
   if (!isAdmin && callerId !== userId) {
     return NextResponse.json({ error: 'Você só pode ativar seu próprio cadastro.' }, { status: 403 });
   }
   ```
3. Aplicar a mesma proteção no `GET` (ou, no mínimo, restringir os dados retornados para
   quando `userId` bate com o chamador ou o chamador é admin).

**Critério de aceite:** uma requisição sem token de autenticação válido recebe 401 em vez
de processar a ativação.

---

### P1.4 — Preços do pedido não devem ser confiáveis quando vêm do comprador

**Arquivos:** política de INSERT de `orders` (nova migration) + fluxo de criação de pedido
no app (investigar em `store/useAppStore.ts` e nas telas de checkout/cadastro do
comprador onde o `insert` em `orders` acontece).

**Problema:** a política `Orders Granular Insert` só verifica `buyer_id = auth.uid()`,
sem checar se `products_subtotal`, `delivery_distance_km`,
`applied_delivery_fee_per_km`, `applied_platform_fee_percent` batem com valores reais
(preço dos produtos no catálogo, distância real). Esses campos alimentam diretamente o
trigger de balanço financeiro e o cálculo de repasse.

**O que implementar (escolha a opção A se possível; B como alternativa mínima):**

- **Opção A (recomendada):** criar uma função RPC `create_order_secure(...)`
  `SECURITY DEFINER` que recebe apenas IDs de produto + quantidades + endereço, calcula
  `products_subtotal` a partir da tabela `products` (preço atual gravado no banco, não o
  que o cliente mandar) e a distância via as coordenadas gravadas de loja/cliente, e só
  então insere o pedido. O app passa a chamar essa RPC em vez de fazer `insert` direto na
  tabela `orders`. Depois disso, revogue o INSERT direto de `authenticated` na tabela
  `orders` (ou restrinja via `WITH CHECK` adicional que valide contra uma tabela de
  referência).
- **Opção B (mínima, se a opção A for grande demais para este ciclo):** adicionar um
  trigger `BEFORE INSERT ON orders` que recalcula `products_subtotal` a partir dos
  `order_items` relacionados (se a arquitetura permitir inserir `order_items` antes/junto)
  e rejeita a inserção se o valor enviado divergir do calculado em mais de poucos
  centavos (arredondamento).

**Critério de aceite:** não é possível criar um pedido cujo `products_subtotal` não
corresponda ao preço real dos produtos no catálogo no momento da compra.

> Este item é o principal dependente do **P0.3** — sem ele, mesmo um checkout que recalcula
> "a partir do pedido salvo" ainda confia em números que podem ter sido manipulados na
> criação do pedido.

---

### P1.5 — Atualizar o Next.js (9 CVEs corrigidas em 16.2.11, jul/2026)

**Arquivo:** `apps/mobile/package.json`

1. Trocar `"next": "16.2.10"` por `"next": "16.2.11"` (ou versão estável mais recente da
   linha 16.2 disponível no momento da execução).
2. Rodar `npm install` e depois `npm run build` para confirmar que nada quebrou.
3. Conferir se `eslint-config-next` deve acompanhar a mesma versão.

**Critério de aceite:** `npm ls next` mostra `16.2.11` ou superior; build passa.

---

## P2 — Fazer este mês

### P2.1 — Criar ledger de saldo disponível por parceiro

Hoje não existe uma tabela que registre, por parceiro, quanto ele tem disponível para
saque — só existem totais agregados da plataforma (`admin_balances`). Isso é a causa raiz
de P1.1 não poder validar saldo de verdade.

**Sugestão de implementação:**
- Nova tabela `partner_ledger` (colunas: `id`, `partner_id`, `order_id` opcional, `type`
  [`credit`/`debit`], `amount`, `reason`, `created_at`, `balance_after` opcional).
- Um crédito é lançado quando um pedido chega ao status que hoje libera repasse
  (`RECEIVED`/`DELIVERED`/etc., mesmo evento que dispara `increment_admin_balances_on_received`).
- Um débito é lançado quando uma transferência Pix é efetivamente confirmada pelo Asaas.
- `/api/asaas/transfer` (e o saque avulso reativado depois deste item) passam a validar
  `value <= saldo_disponível(partner_id)` antes de chamar o Asaas.
- RLS: cada parceiro só pode `SELECT` suas próprias linhas; só `service_role`/triggers
  fazem `INSERT`.

### P2.2 — Só marcar repasse como concluído quando a transferência realmente for bem-sucedida

**Arquivo:** `supabase/functions/payout-sweep/index.ts`

Hoje `payout_seller_done`/`payout_driver_done` são marcados como `true` logo após a
chamada ao Asaas, **independente do resultado**. Mover essa atualização para **dentro**
do bloco `if (ok) { ... }` de cada trecho (vendedor e motorista). No bloco `else`
(falha), em vez de marcar como concluído:
- gravar a falha em uma tabela nova `payout_failures` (`order_id`, `role`
  [`seller`/`driver`], `attempted_value`, `asaas_response`, `created_at`, `resolved_at`);
- deixar o flag `payout_*_done` como `false` para que uma próxima execução do sweep (ou
  um processo manual de reconciliação) tente novamente, com um limite de tentativas para
  não tentar para sempre um caso claramente inválido (ex.: 5 tentativas, depois marcar
  `needs_manual_review = true`).

### P2.3 — Unificar checagem de papel administrador

**Arquivos:** `supabase/functions/remove-account/index.ts` e qualquer outro lugar com
checagem de `role` duplicada.

Trocar a checagem case-sensitive:

```ts
if (profileError || !callerProfile || callerProfile.role !== 'ADMIN') { ... }
```

por uma chamada à mesma função `is_admin()` já usada pelo Postgres, via RPC:

```ts
const { data: callerIsAdmin } = await supabaseClient.rpc('is_admin')
if (profileError || !callerIsAdmin) { ... }
```

Faça o mesmo em qualquer outra rota/Edge Function que reimplemente a checagem de admin
manualmente em vez de reusar `is_admin()` (Postgres) ou uma única função utilitária no
lado Next.js (`apps/mobile/src/lib/apiAuth.ts` já centraliza a maior parte — garanta que
tudo passe por ali).

### P2.4 — Centralizar a regra de "vagas de fundador"

A lógica de quota de fundadores (`freeQuota`, `subsidizedCount`, `isUserAlreadyFounder`)
está duplicada em `GET /api/asaas/activation`, `POST /api/asaas/activation` e
`POST /api/asaas/subaccount`. Extrair para uma função única, por exemplo
`lib/founderQuota.ts` exportando `getFounderQuotaStatus(userId)`, e usá-la nos três
lugares.

### P2.5 — Reduzir dados sensíveis em logs

Nos arquivos abaixo, remover `console.log`/`console.warn` que imprimem corpo completo de
transferências, chaves Pix ou dados de pagamento; manter apenas identificadores
(`orderId`, `paymentId`, status):
- `apps/mobile/src/app/api/asaas/transfer/route.ts`
- `apps/mobile/src/app/api/asaas/refund/route.ts`
- `apps/mobile/src/app/api/asaas/checkout/route.ts`
- `apps/mobile/src/app/api/asaas/status/route.ts`
- `apps/mobile/src/app/api/asaas/subaccount/route.ts`
- `apps/mobile/src/app/api/asaas/activation/route.ts`
- `supabase/functions/payout-sweep/index.ts`
- `apps/mobile/src/store/useAppStore.ts` (79 ocorrências — priorize as que imprimem
  dados de pedido/pagamento; pode manter logs de UI/depuração não sensíveis)

### P2.6 — Regenerar `package-lock.json`

Rodar `npm install` na raiz do monorepo e confirmar que o lockfile resultante não faz mais
referência a um workspace `apps/admin` inexistente. Commitar o lockfile atualizado.

### P2.7 — Registrar histórico de reembolsos parciais

**Arquivo:** `apps/mobile/src/app/api/asaas/refund/route.ts` + nova tabela
`refund_history` (`order_id`, `payment_id`, `requested_value`, `asaas_refund_id`,
`status`, `requested_by`, `created_at`). Antes de processar um novo reembolso parcial,
somar os reembolsos já registrados para aquele `payment_id` e impedir que o total
ultrapasse o valor original pago.

---

## P3 — Backlog (qualidade de código, sem risco de segurança direto)

- Dividir `apps/mobile/src/store/useAppStore.ts` (3195 linhas) em slices por domínio
  (pedidos, usuário/autenticação, financeiro, UI/notificações).
- Dividir as telas muito grandes em componentes menores: `app/admin/page.tsx` (~209 KB),
  `app/page.tsx` (~114 KB), `app/parceiros/batedeira/page.tsx` (~140 KB),
  `components/InteractiveVideoModal.tsx` (~104 KB).
- Reduzir uso de `: any`/`as any` (141 ocorrências) começando pelas interfaces de
  request/response das integrações Asaas e Supabase.
- Extrair a resolução da chave Asaas (`getAsaasApiKey`) e a detecção de admin para
  utilitários únicos reaproveitados por todas as rotas (parte disso já é resolvida no
  P2.3).

---

## Ações fora do código (o Fredson faz manualmente, o agente não deve tentar)

Liste estes itens de volta para mim ao final da execução — eles não são tarefas de
código:

1. **Rotacionar imediatamente** a chave de produção do Asaas, a Service Role Key do
   Supabase, `INTERNAL_API_SECRET` e o novo `ASAAS_WEBHOOK_TOKEN`, gerando valores novos
   nos respectivos painéis (Asaas, Supabase, Vercel).
2. Atualizar as variáveis de ambiente na Vercel e nos Secrets do Supabase com os nomes
   corretos (`ASAAS_WEBHOOK_TOKEN` no lugar de `WEBHOOK_SECRET`; remover qualquer
   `NEXT_PUBLIC_INTERNAL_API_SECRET`).
3. Verificar o histórico do Git (`git log --all --full-history -- **/.env*`) para
   confirmar se algum `.env.local` já foi commitado no passado; se sim, tratar todas as
   chaves envolvidas como comprometidas e rotacioná-las mesmo que já estejam cobertas no
   item 1.
4. Confirmar no painel do Supabase se a função `payout-sweep` está de fato agendada
   (cron) e, depois da correção do P0.5, rodar uma execução manual para validar antes de
   deixar o agendamento automático voltar a rodar sozinho.
5. Depois de aplicados os itens P0 e P1, considerar contratar um teste de invasão
   (pentest) independente antes de qualquer campanha de divulgação ou aumento de volume
   de pedidos.
