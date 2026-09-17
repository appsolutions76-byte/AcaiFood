# Prompt — Rodada 5 (AçaíFood / AppAçaíBelém): saque sob aprovação do admin

> Contexto para o agente: este prompt é diferente dos anteriores — não é uma correção pontual, é uma mudança de arquitetura no fluxo de repasse de dinheiro a parceiros (lojas, fornecedores, motoristas). Hoje existem dois caminhos que enviam Pix automaticamente, sem revisão humana: (1) o parceiro autenticado chama `/api/asaas/transfer` diretamente pelo app, vinculado a um pedido; (2) `supabase/functions/payout-sweep/index.ts` varre pedidos pendentes e transfere sozinho, numa agenda automática. A partir desta rodada, **nenhum dos dois deve mais mandar dinheiro sozinho, sem passar pela solicitação abaixo**. O novo fluxo é: o parceiro só *solicita* o saque do saldo disponível dele pelo app; a solicitação fica pendente; e a transferência real só acontece de duas formas — (a) um admin aprova manualmente a solicitação pelo painel, ou (b) o admin liga um **modo de pagamento automático**, com horário configurável, que aprova e paga sozinho as solicitações pendentes naquele horário, todo dia, até o admin desligar. Em nenhum dos dois casos o parceiro informa chave Pix/walletId de destino em lugar nenhum desse fluxo — o servidor sempre usa a chave já cadastrada do próprio parceiro (`users.pix_key` / `users.cpf_cnpj` / `users.asaas_wallet_id`).
>
> **Isto substitui o item P0 do prompt `PROMPT_CORRECOES_ANTIGRAVITY_R4.md`** (checagem de dono em `/api/asaas/transfer`) e o P1 desse mesmo prompt (checagem de `split_enabled`) — em vez de remendar esses dois pontos no endpoint atual, o endpoint deixa de ser chamável por parceiro e as duas checagens passam a viver no fluxo de aprovação abaixo. **Se o prompt R4 ainda não foi executado, pode pular os itens P0 e P1 dele e aplicar só o P2, P3 e P4 (que continuam válidos e independentes deste aqui).** Se o R4 já foi executado, sem problema — este prompt não conflita com o que já foi feito, só substitui o ponto de entrada.
>
> Regras de negócio já definidas (não perguntar de novo, seguir exatamente assim):
> - O parceiro só pode solicitar o **saldo total disponível** de uma vez — não existe saque de valor parcial.
> - Existe um **valor mínimo de saque** (configurável, ver P0 abaixo).
> - O parceiro só pode ter **uma solicitação pendente por vez** — não pode abrir uma nova enquanto a anterior não for aprovada, rejeitada ou paga.
> - O **pagamento automático é opcional e controlado pelo admin**: por padrão vem **desligado** (tudo manual, como descrito acima). O admin pode, a qualquer momento, ligar o modo automático e escolher um horário do dia — a partir daí, toda solicitação `PENDENTE` naquele momento passa a ser processada sozinha no horário configurado, sem precisar de clique manual. O admin pode desligar o modo automático a qualquer momento e voltar a aprovar manualmente.

---

## P0 — Migration: tabela `withdrawal_requests` + configurações de pagamento

Criar uma nova migration (`supabase/migrations/<timestamp>_create_withdrawal_requests.sql`) com:

```sql
CREATE TABLE public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.users(id),
  role text not null,
  requested_amount numeric(12,2) not null,
  order_ids uuid[] not null default '{}',
  status text not null default 'PENDENTE',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  asaas_transfer_id text,
  pix_key_used text,
  wallet_id_used text,
  rejection_reason text,
  failure_reason text,
  processed_automatically boolean not null default false,
  created_at timestamptz not null default now()
);

-- status válidos: 'PENDENTE', 'APROVADO', 'REJEITADO', 'PAGO', 'FALHOU'
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN ('PENDENTE','APROVADO','REJEITADO','PAGO','FALHOU'));

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- parceiro só vê as próprias solicitações
CREATE POLICY "Partner reads own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (partner_id = auth.uid() OR public.is_admin());

-- nenhum INSERT/UPDATE direto do cliente — tudo passa pelas rotas de servidor (Service Role)
-- não criar policy de INSERT/UPDATE para authenticated; Service Role ignora RLS normalmente.

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
```

Adicionar também colunas próprias em `platform_settings` para o valor mínimo de saque e para o pagamento automático — **não reaproveitar `asaas_platform_wallet_id`** (essa coluna já está sobrecarregada com JSON de outras configs, é dívida técnica conhecida, não piorar):

```sql
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS min_withdrawal_value numeric(12,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS auto_payout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_payout_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS auto_payout_timezone text NOT NULL DEFAULT 'America/Belem',
  ADD COLUMN IF NOT EXISTS last_auto_payout_run_at timestamptz;

NOTIFY pgrst, 'reload schema';
```

(`auto_payout_timezone` existe para deixar explícito qual fuso horário o horário configurado representa — confirme se o projeto já usa outro fuso como padrão em algum lugar do código antes de fixar `America/Belem`, e ajuste o default se for o caso, mas mantenha a coluna para não depender do fuso do servidor.)

---

## P1 — Lib compartilhada: cálculo de saldo disponível do parceiro

Criar `apps/mobile/src/lib/partnerBalance.ts`, com uma função `getPartnerAvailableBalance(partnerId: string, role: string)` que:

1. Busca todos os pedidos elegíveis ao parceiro que ainda não foram pagos — mesma lógica de elegibilidade que `apps/mobile/src/app/api/asaas/transfer/route.ts` e `supabase/functions/payout-sweep/index.ts` já usam hoje (pedido entregue/concluído, `payout_seller_done = false` para loja/fornecedor ou `payout_driver_done = false` para motorista, e `driver_id`/`storefronts.partner_id` batendo com o `partnerId`).
2. Para cada pedido elegível, recalcula o valor com `calculateSellerPayout`/`calculateDriverPayout` (as mesmas funções já usadas em `transfer/route.ts` — reaproveitar, não duplicar lógica).
3. Retorna `{ totalDisponivel: number, orderIds: string[], quantidadePedidos: number }`.

Esta função deve ser a **única fonte de verdade** do saldo — tanto o endpoint de saldo do parceiro (P2) quanto a aprovação (manual ou automática, P3) chamam ela, nunca recalculam por conta própria.

---

## P2 — Endpoints do parceiro: ver saldo e solicitar saque

### `GET /api/asaas/withdrawals` (novo arquivo `apps/mobile/src/app/api/asaas/withdrawals/route.ts`)

- `authorizeRequest(['loja','fornecedor','motorista'])`.
- Chama `getPartnerAvailableBalance(userId, role)`.
- Busca se já existe solicitação com `status IN ('PENDENTE','APROVADO')` para esse `partner_id` (a mais recente).
- Retorna: saldo disponível, valor mínimo (`platform_settings.min_withdrawal_value`), se pode solicitar agora (saldo >= mínimo E não há pendente), e os dados da solicitação em andamento, se houver (para o app mostrar "aguardando aprovação").

### `POST /api/asaas/withdrawals` (mesmo arquivo, handler `POST`)

- Mesmo `authorizeRequest`.
- Antes de criar, revalidar no servidor (nunca confiar em nada vindo do corpo da requisição — este endpoint não deve receber valor nem chave de destino no body, só aciona o cálculo):
  1. Não pode já existir solicitação `PENDENTE` ou `APROVADO` para esse parceiro → se existir, retornar erro 400 com a solicitação existente.
  2. Recalcular saldo via `getPartnerAvailableBalance`. Se `totalDisponivel < min_withdrawal_value`, retornar 400.
  3. Confirmar que o parceiro tem `pix_key`/`cpf_cnpj`/`asaas_wallet_id` cadastrado (pelo menos uma chave válida) — se não tiver nenhuma, retornar 400 com mensagem clara pedindo para cadastrar uma chave Pix antes de solicitar saque.
- Criar a linha em `withdrawal_requests` com `status = 'PENDENTE'`, `requested_amount = totalDisponivel`, `order_ids` = lista de pedidos cobertos, `role`.
- Retornar a solicitação criada.

---

## P3 — Aprovação da solicitação: lógica compartilhada + endpoints manuais do admin

**Importante:** a lógica de efetivamente pagar uma solicitação precisa ser usada tanto pelo admin clicando "aprovar" (manual) quanto pelo pagamento automático agendado (P3-B). Para não duplicar, criar essa lógica uma vez só.

### Função compartilhada `processWithdrawalApproval(requestId: string, actorId: string | null)` em `apps/mobile/src/lib/withdrawalApproval.ts`

`actorId` é o id do admin quando é aprovação manual, e `null` (ou um marcador fixo, ex. `'SISTEMA_AUTOMATICO'`, se a coluna `reviewed_by` exigir texto) quando é o pagamento automático. Passos:

1. Buscar a solicitação pelo `id`; se `status !== 'PENDENTE'`, retornar erro (já foi processada).
2. Buscar o parceiro (`users`) pelo `partner_id` da solicitação: `pix_key`, `cpf_cnpj`, `asaas_wallet_id`, `split_enabled`, `asaas_account_status`.
3. **Revalidar `split_enabled === true` e/ou `asaas_account_status === 'APPROVED'`** antes de prosseguir — se a conta do parceiro não estiver aprovada no Asaas, marcar a solicitação como `FALHOU` com `failure_reason` explicando isso, e retornar (não deixar passar).
4. **Recalcular o saldo agora**, chamando `getPartnerAvailableBalance` de novo (não confiar só no `requested_amount` gravado na criação — pode ter passado tempo). Usar o valor recalculado agora como valor definitivo da transferência, atualizando `requested_amount` na linha com o valor final.
5. Resolver a chave de destino **exclusivamente** a partir do cadastro do parceiro no banco, na mesma ordem de prioridade do `payout-sweep`: `cpf_cnpj || pix_key || email || asaas_wallet_id`. Nunca aceitar chave vinda de fora desta função.
6. Montar `transferBody` e chamar `${ASAAS_URL}/transfers` (extrair a lógica de detecção de tipo de chave — CPF/CNPJ/e-mail/telefone/EVP/walletId — que já existe em `apps/mobile/src/app/api/asaas/transfer/route.ts` para uma função utilitária compartilhada, ex. `lib/asaasTransferHelpers.ts`, para não duplicar).
7. Em caso de sucesso: marcar a solicitação como `PAGO`, gravar `asaas_transfer_id`, `pix_key_used`/`wallet_id_used`, `paid_at`, `reviewed_by = actorId`, `reviewed_at`, `processed_automatically = (actorId === null)`; marcar `payout_seller_done`/`payout_driver_done = true` em todos os `order_ids` cobertos; inserir crédito em `partner_ledger` (mesmo padrão já usado hoje).
8. Em caso de falha na chamada ao Asaas: marcar a solicitação como `FALHOU`, gravar `failure_reason` com a mensagem de erro, **sem** marcar os pedidos como pagos. Uma solicitação `FALHOU` pode ser tentada de novo (manualmente pelo admin, ou automaticamente na próxima janela do pagamento agendado, se ainda estiver dentro do dia — ver P3-B) chamando esta mesma função de novo (ela deve aceitar reprocessar uma solicitação `FALHOU` do mesmo jeito que uma `PENDENTE`, ou ser chamada após o admin/sistema voltar o status para `PENDENTE` — escolher a abordagem mais simples de implementar sem quebrar o restante do fluxo, documentando a decisão no código).

### `GET /api/admin/withdrawals` (novo arquivo `apps/mobile/src/app/api/admin/withdrawals/route.ts`)

- `authorizeRequest(['admin'])`.
- Lista solicitações, com filtro por `status` via query param (default: `PENDENTE`), incluindo dados básicos do parceiro (nome, papel, telefone) via join com `users`.

### `POST /api/admin/withdrawals/[id]/approve` (novo arquivo `apps/mobile/src/app/api/admin/withdrawals/[id]/approve/route.ts`)

- `authorizeRequest(['admin'])`.
- Chama `processWithdrawalApproval(id, auth.user.id)`.
- Retorna o resultado (sucesso com id da transferência, ou erro com o motivo da falha).

### `POST /api/admin/withdrawals/[id]/reject` (mesmo diretório, `reject/route.ts`)

- `authorizeRequest(['admin'])`.
- Body: `{ reason: string }` (motivo obrigatório).
- Se `status !== 'PENDENTE'`, recusar.
- Marcar `status = 'REJEITADO'`, `rejection_reason`, `reviewed_by`, `reviewed_at`.
- Isso libera o parceiro para abrir uma nova solicitação em seguida (a checagem de "só uma pendente" do P2 considera só `PENDENTE`/`APROVADO`).

---

## P3-B — Pagamento automático agendado (opcional, controlado pelo admin)

### Endpoints de configuração

`GET`/`POST /api/admin/payout-settings` (novo arquivo `apps/mobile/src/app/api/admin/payout-settings/route.ts`):

- `authorizeRequest(['admin'])` nos dois métodos.
- `GET`: retorna `auto_payout_enabled`, `auto_payout_time`, `auto_payout_timezone`, `min_withdrawal_value`, `last_auto_payout_run_at` de `platform_settings`.
- `POST`: recebe `{ auto_payout_enabled?: boolean, auto_payout_time?: string, min_withdrawal_value?: number }` e atualiza `platform_settings`. Validar formato de horário (`HH:MM`) e que `min_withdrawal_value > 0`.

### Repropósito de `supabase/functions/payout-sweep/index.ts`

Este arquivo deixa de transferir direto a partir dos pedidos (como faz hoje) e passa a ter esta responsabilidade nova:

1. No início do handler, buscar `platform_settings` (`auto_payout_enabled`, `auto_payout_time`, `auto_payout_timezone`, `last_auto_payout_run_at`).
2. Se `auto_payout_enabled === false`, apenas logar "pagamento automático desligado" e retornar sem fazer nada.
3. Se estiver ligado: calcular a hora atual no fuso configurado (`auto_payout_timezone`) e comparar com `auto_payout_time`. Como a função roda numa agenda (cron) com granularidade provavelmente de minutos/hora, processar quando o horário atual estiver dentro da mesma janela do horário configurado (ex.: mesmo `HH:MM` truncado ao intervalo do cron) **e** `last_auto_payout_run_at` ainda não for de hoje (para não repetir o pagamento várias vezes no mesmo dia, caso o cron rode com mais frequência que uma vez por dia). Se não estiver na janela certa ou já rodou hoje, retornar sem processar.
4. Se estiver na janela certa e ainda não rodou hoje: buscar todas as solicitações `status = 'PENDENTE'` e chamar `processWithdrawalApproval(request.id, null)` (ou o marcador equivalente) para cada uma, uma de cada vez, registrando sucesso/falha por solicitação sem deixar uma falha interromper o processamento das demais.
5. Ao final, atualizar `platform_settings.last_auto_payout_run_at = now()`.
6. Confirmar (ação de infraestrutura, fora do código) que o agendamento (cron) dessa função está configurado para rodar com frequência suficiente para não perder a janela do horário escolhido pelo admin — recomenda-se a cada 15–30 minutos. Isso já valia como pendência das rodadas anteriores; agora passa a ser ainda mais importante porque o horário configurado pelo admin depende disso.

---

## P4 — Travar o caminho antigo de repasse direto pelo parceiro

Em `apps/mobile/src/app/api/asaas/transfer/route.ts`: trocar `authorizeRequest(request, ['admin', 'loja', 'fornecedor', 'motorista'])` para `authorizeRequest(request, ['admin'])`. Este endpoint deixa de ser acessível a parceiros — só fica como ferramenta de uso interno/admin para casos excepcionais (ex.: saque avulso sem `orderId`, que já era restrito a admin). Se não houver mais nenhum uso legítimo dele fora do fluxo novo, avaliar removê-lo e mover de vez a lógica de montagem de `transferBody` para o helper compartilhado do P3.

---

## P5 — Interface do parceiro (app)

Na área do parceiro (loja, fornecedor, motorista — provavelmente dentro da tela de perfil/financeiro que já existe, ou uma nova aba "Meus Ganhos"):

- Mostrar saldo disponível (via `GET /api/asaas/withdrawals`).
- Se houver solicitação em andamento (`PENDENTE` ou `APROVADO`), mostrar isso no lugar do botão, com o valor e a data da solicitação, e não permitir abrir outra.
- Se não houver e o saldo for >= mínimo, mostrar botão "Solicitar saque" que chama `POST /api/asaas/withdrawals` e, ao concluir, atualiza a tela para o estado "aguardando aprovação".
- Se o saldo for menor que o mínimo, mostrar o saldo e uma mensagem indicando o valor mínimo necessário (sem botão ativo).
- Mostrar um histórico simples das últimas solicitações (status, valor, data) — pode ser uma lista simples, sem necessidade de paginação sofisticada nesta primeira versão. Se a solicitação foi paga automaticamente (`processed_automatically = true`), não precisa distinguir isso visualmente para o parceiro — só importa para o admin.

## P6 — Interface do admin (painel)

Nova seção "Saques" no painel admin (mesmo local de `components/admin/UserManagementTable.tsx`):

- Lista de solicitações pendentes, com nome do parceiro, papel, valor, data da solicitação.
- Botão "Aprovar" (chama o approve do P3) e "Rejeitar" (abre campo de motivo, chama o reject do P3).
- Aba/filtro para ver histórico (aprovadas, pagas, rejeitadas, com erro) — útil para o admin acompanhar solicitações que falharam e precisam ser tentadas de novo. Indicar quais foram pagas automaticamente vs. manualmente (`processed_automatically`).
- Ao aprovar manualmente, mostrar claramente o resultado (sucesso com id da transferência do Asaas, ou erro com o motivo) antes de fechar a tela.
- **Novo bloco de configuração "Pagamento automático"**, nesta mesma seção ou em Configurações gerais do admin:
  - Um alternador (switch) "Ativar pagamento automático" (liga/desliga `auto_payout_enabled` via `POST /api/admin/payout-settings`).
  - Um seletor de horário (`auto_payout_time`), habilitado só quando o alternador está ligado.
  - Mostrar, abaixo, quando foi a última execução automática (`last_auto_payout_run_at`), para o admin confirmar que está rodando.
  - Deixar claro no texto da tela que, com o modo automático ligado, todas as solicitações pendentes no horário configurado são pagas sozinhas, sem revisão individual — e que o admin pode desligar a qualquer momento para voltar a aprovar uma por uma.

---

## Ordem recomendada de execução

1. **P0** (migration) — base para tudo o resto.
2. **P1** (lib de saldo) — usada pelos endpoints dos próximos passos.
3. **P2** e **P3** (endpoints de parceiro, lógica compartilhada de aprovação e endpoints manuais do admin) — podem ser feitos em paralelo, mas testar a integração entre eles antes de seguir.
4. **P3-B** (pagamento automático) — depende da função compartilhada do P3 já estar pronta e testada manualmente primeiro.
5. **P4** (travar caminho antigo do `/api/asaas/transfer`) — só depois que P2/P3 estiverem funcionando ponta a ponta em homologação, para não deixar uma janela sem nenhum jeito de sacar.
6. **P5** e **P6** (interfaces) — por último, quando os endpoints já estiverem estáveis.

Teste manual obrigatório antes de considerar concluído:
- Um parceiro de teste com saldo acima do mínimo solicita saque; admin vê a solicitação, aprova manualmente, e o Pix realmente sai para a chave cadastrada do parceiro (testar em ambiente sandbox do Asaas, não em produção).
- Parceiro tenta abrir uma segunda solicitação enquanto a primeira está pendente e é bloqueado.
- Admin rejeita uma solicitação e o parceiro consegue solicitar de novo depois.
- Admin liga o pagamento automático com um horário próximo (para testar rápido) e confirma que uma solicitação `PENDENTE` é paga sozinha na janela configurada, sem clique manual, e que `last_auto_payout_run_at` foi atualizado.
- Com o pagamento automático desligado, confirmar que nenhuma solicitação pendente é processada sozinha, mesmo passando do horário configurado.

## Fora do escopo deste prompt

- Confirmar/ajustar o agendamento (cron) do `payout-sweep` no painel do Supabase para rodar com a frequência recomendada (ação de infraestrutura, não de código — ver P3-B).
- Notificações push/e-mail ao parceiro quando a solicitação for aprovada/paga/rejeitada — não está coberto aqui; se o app já tiver alguma infraestrutura de notificação, pode ser um prompt separado depois que este fluxo estiver estável.
- Os itens P2, P3, P4.1 e P4.2 do prompt `PROMPT_CORRECOES_ANTIGRAVITY_R4.md` continuam válidos e independentes deste — não estão cobertos aqui.
