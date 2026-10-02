# Prompt — Correções R11: brechas restantes + repasse depois do PIN (AçaíFood)

> Base: `docs/10_REAUDITORIA_2026-10-02.md` (e `09_…`, `03_…` para o histórico). Substitui o que restava do R8. Cole no Antigravity a partir de "Contexto".

---

## Contexto

O AçaíFood está **no ar, com clientes e dinheiro real**. As brechas mais graves das rotas de API foram fechadas no R10. O que falta agora é:

- **banco:** a RLS e as RPCs de `orders` ainda deixam o app (e qualquer usuário logado) mudar status, motorista e repasse direto pelo navegador, e o PIN fica visível para quem não é o comprador;
- **dinheiro:** o checkout ainda faz split para o vendedor e o saque paga de novo, o saque vai para chave Pix digitada, sem idempotência, e com taxa recalculada no dia do saque;
- **resto:** Edge Functions quebradas, estornos fora de regra, preço vindo do celular, saque automático quebrado e textos enganosos.

Leia `docs/10_REAUDITORIA_2026-10-02.md` antes de começar. Os códigos entre parênteses (A7, C5, N1…) são os itens desse relatório.

## Regras (obrigatórias)

1. **O app não pode parar.** Cada item é um deploy separado, testado antes no preview da Vercel com **Asaas sandbox** e um projeto Supabase de teste (ou branch), e verificado em produção logo depois com um pedido real de valor baixo.
2. **Rollback pronto:** anote o deploy anterior da Vercel (Instant Rollback) antes de cada publicação. Toda migration tem **backup/PITR confirmado** antes e um SQL de reversão em `supabase/rollback/` com o mesmo timestamp.
3. **Ordem do banco:** primeiro o app deixa de depender da permissão antiga (novo deploy usando RPC/rota de servidor); **só depois** a migration remove a permissão. Nunca o contrário.
4. Código em inglês, telas em PT-BR. Nenhum segredo, chave Pix, CNPJ ou e-mail fixo no código.
5. Ao fim de cada item: o que mudou, como testou, resultado em produção. **Pare e espere aprovação antes do próximo item.**
6. Não reescreva telas nem refatore o que não está listado. Os arquivos gigantes (`admin/page.tsx`, `batedeira/page.tsx`, `useAppStore.ts`) ficam para depois; mexa só nos trechos necessários.

## O que já funciona (não mexer sem necessidade)

Pix dinâmico da cobrança Asaas no checkout; conferência de valor e de status no webhook e no `GET /api/asaas/status`; resposta 200 do webhook em divergência; autenticação só por JWT do Supabase com admin vindo de `users.role`/`users.is_admin`; estorno com login e checagem de dono; `link-wallet` validando a subconta no Asaas; bloqueio de saque com outro `PROCESSING`; saldo de saque contando só `RECEIVED`; conciliação manual de Pix no admin.

---

## Fase 0 — Painéis e CI (sem código do app)

**0.1 Edge Functions.** `supabase/functions/asaas-checkout/index.ts` e `asaas-status/index.ts` **não compilam** (código antigo depois do `serve()`; URL sem crases na linha 58 da `asaas-status`). Por isso o deploy falha e a versão antiga, vulnerável, pode estar no ar.
1. O dono do produto apaga no painel do Supabase as funções `asaas-checkout` e `asaas-status`. Confirmar que o app não as chama (a rota `GET /api/asaas/status`, passo 4, chama `asaas-status`: **remover esse passo** no mesmo deploy).
2. Apagar do repositório as pastas `asaas-checkout`, `asaas-status`, `debug-orders`, `payout-sweep`, `clear-orders`, `remove-account` (as quatro últimas não são usadas pelo app; conferir com busca antes).
3. `asaas-webhook` e `asaas-create-subaccount`: verificar no painel do Asaas se a URL da Edge Function `asaas-webhook` está cadastrada (por exemplo, para eventos de conta/subconta). Se não estiver, apagar também. Se estiver, mantê-la, e nela também só marcar `PAID` se o pedido estiver pendente e o valor bater com `charged_amount`.
4. `.github/workflows/deploy.yml`: deployar **só as funções que existem**, pelo nome (`supabase functions deploy asaas-webhook …`), e falhar o job se alguma não compilar. Rodar `deno check` antes.
5. Conferir no GitHub → Actions que o job passou e, no painel do Supabase, a data de publicação de cada função.

**0.2 Pagamento automático** continua **desligado** até a Fase 3 terminar.

---

## Fase 1 — Correções de código sem mexer no banco

**1.1 Estorno de cobrança sem pedido (N1).** Em `/api/asaas/refund`: se nenhum pedido for encontrado (por UUID ou por `asaas_payment_id`), **só admin** pode estornar. Cobranças com `externalReference` começando com `ACTIVATE_` (taxa de ativação) só podem ser estornadas pelo admin, e o estorno **desativa** a ativação do parceiro (`activation_paid`/campo equivalente = false; confira o nome usado em `api/asaas/activation`).

**1.2 Quem pode cancelar e quando (N2).**
- Comprador: só com o pedido em `PENDING` (cancela a cobrança) ou `PAID` (estorna), antes da loja aceitar.
- Dono da loja/fornecedor: até `READY` (antes do motorista retirar).
- Depois de `DELIVERING`: só admin, pela tela de ocorrências.
- Mensagens claras no app para cada caso.

**1.3 Pix que chega depois do cancelamento (N3).** No webhook, se o pagamento chegar para um pedido `CANCELLED`/`CANCELED`: registrar em `incident_logs` (`PAYMENT_AFTER_CANCEL`) e **estornar automaticamente** a cobrança no Asaas (`POST /payments/{id}/refund`), gravando em `refund_history`. Responder 200.

**1.4 Saque `FALHOU` reaproveitado (H1).** Em `POST /api/asaas/withdrawals`, ao criar um saque novo, marcar como `REJEITADO` (motivo "substituído por nova solicitação") todo saque `FALHOU` do mesmo parceiro. Em `processWithdrawalApproval`, só aceitar `FALHOU` se não existir saque mais novo do parceiro, e se nenhum pedido do saque estiver em outro saque `PENDENTE`/`APROVADO`/`PROCESSING`/`PAGO`.

**1.5 Idempotência do saque (H2).** Antes de `POST /transfers`, gravar `transfer_attempt_id` (UUID) no saque e enviá-lo como `externalReference` da transferência (confirme na documentação do Asaas se `/transfers` aceita esse campo; se não aceitar, use a `description`). Antes de reaprovar um `FALHOU`, consultar `GET /transfers` por essa referência: se a transferência existir e não estiver falha, **não** enviar outra; atualizar o saque com ela.

**1.6 O app não grava `PAID` (H4/A7, parte do app).** Em `useAppStore.acaoPedido`, a ação `confirmar_pagamento`/`pagar` **não grava nada no banco**: só recarrega o pedido (`fetchOrders`). `PAID` é gravado exclusivamente pelo servidor (webhook, `GET /api/asaas/status`, conciliação manual). No `PixModal`, ao detectar pagamento, só fechar o modal e recarregar.

**1.7 Saque automático (H6).** Em `api/asaas/sweep`, trocar `partner:partner_id(city)` por `partner:partner_id(cidade)` e usar `cidade`. Só gravar `last_auto_payout_run_at` se nenhuma cidade foi pulada por horário. Conferir nos logs da Vercel que o cron chega com `Authorization: Bearer CRON_SECRET` (se o header `x-vercel-cron` não vier, aceitar só o Bearer do `CRON_SECRET`). Continua desligado até a Fase 3.

---

## Fase 2 — Banco: status, motorista e PIN só por RPC (A6, A7, A9, C4, H7)

Fazer em **dois deploys**: 2A (app passa a usar RPC) e depois 2B (migration que remove as permissões). Antes de começar, gerar `supabase db diff` contra a produção e salvar o resultado em `docs/historico/sql/` (há tabelas e scripts aplicados à mão).

### 2A — App usa só RPC para mudar pedidos

1. Criar a RPC `advance_order_status(p_order_id uuid, p_action text, p_reason text default null)`, `SECURITY DEFINER`, `search_path = public`, que:
   - identifica quem chama por `auth.uid()` (nunca por parâmetro) e o papel por `users.role`/`is_admin`;
   - aceita só estas ações e transições:

| Ação | Quem | De → Para |
|---|---|---|
| `accept` | dono da loja/fornecedor do pedido | `PAID` → `PREPARING` |
| `ready` | dono da loja/fornecedor | `PREPARING` → `READY` |
| `cancel_by_seller` | dono da loja/fornecedor | `PAID`/`PREPARING`/`READY` → `CANCELLED` (a rota de estorno faz o estorno; a RPC só é chamada por ela ou devolve erro pedindo para usar a rota) |
| `delivered_by_driver` | `driver_id` do pedido | `DELIVERING` → `DELIVERED` |
| `archive_driver` (`pagar_motorista`) | admin | `RECEIVED` → `COMPLETED` |
| `force_receive` (`forcar_baixa`) | admin | `DELIVERING`/`DELIVERED`/`PIN_LOCKED` → `RECEIVED`, com motivo obrigatório |

   - grava `accepted_at`, `ready_at`, `delivered_at` etc. no servidor e insere em `order_status_history`;
   - devolve `{success, error}` com mensagem em PT-BR quando a transição não é permitida.
2. `accept_order_atomic(p_order_id)`: usar `auth.uid()` como motorista (remover `p_operator_id` ou ignorá-lo), exigir papel de motorista/caminhão ativo, e só aceitar pedido `READY`/`PAID` sem motorista do tipo certo. Ele grava `driver_id` e `DELIVERING`/estado combinado.
3. `check_pickup_pin(p_order_id, p_pin)`: exigir `auth.uid() = driver_id`; passa para `DELIVERING` e grava `picked_up_at`.
4. `check_delivery_pin(p_order_id, p_pin)`: exigir `auth.uid() = driver_id`; comparar **só com `pin_hash`**; manter limite de 5 tentativas e o bloqueio.
5. `transition_order_status`: passar a **validar** a matriz (`v_is_valid_transition`) e o papel, levantando erro quando inválida; ou removê-la, se `advance_order_status` cobrir todos os usos (procure todos os chamadores antes).
6. **PIN só para o comprador.** Criar a RPC `get_my_order_pins(p_order_id)` que devolve `delivery_pin` só se `auth.uid() = buyer_id`, e `pickup_pin` só se `auth.uid()` for o dono da loja. `generate_delivery_pin` guarda o PIN para exibir ao comprador em coluna que **não** é lida pelo SELECT de terceiros (por exemplo, tabela `order_pins` com RLS `buyer_id = auth.uid()`), e grava `pin_hash` em `orders`.
7. No app (`useAppStore` e telas): trocar **todos** os `supabase.from('orders').update(...)` por RPC ou rota de servidor. Hoje estão nas linhas ~2296 e ~2348 (fallbacks de PIN: **remover**, sem RPC não há confirmação), ~2405 (`pagar_motorista`), ~2554 (`acaoPedido`), ~3127 (`markPayoutDone`, que vai para uma rota de admin no servidor). `is_hidden` pode continuar direto (ver 2B). Remover as comparações de PIN feitas no navegador (`targetOrd.deliveryPin === cleanPin`). O motorista nunca recebe `delivery_pin` nem `pickup_pin` no `fetchOrders`.
8. Publicar, acompanhar 24 h e conferir nos logs que não há mais UPDATE direto em `orders` vindo do app.

### 2B — Migration que remove as permissões

1. `orders`: `REVOKE INSERT, UPDATE ON public.orders FROM authenticated, anon;` e `GRANT UPDATE (is_hidden) ON public.orders TO authenticated;` com policy de UPDATE só para `buyer_id = auth.uid()` ou dono da loja. Pedidos são criados só pelo `/api/asaas/checkout` (service_role).
2. **SELECT do radar sem dados sensíveis:** trocar a policy que libera `SELECT *` de pedidos sem motorista por uma view `driver_radar_orders` (`security_invoker`/função `SECURITY DEFINER`) só com id, tipo, bairro/endereço resumido, coordenadas aproximadas, valor do frete e distância; **sem** telefone, nome completo, PIN nem `pin_hash`. Motorista vê o endereço completo e o telefone só depois de aceitar.
3. Garantir que `delivery_pin`/`pickup_pin` não sejam lidos por terceiros: `REVOKE SELECT (delivery_pin, pickup_pin, pin_hash, provided_pin) ON orders FROM authenticated` (se usar column grants, liste as colunas permitidas no GRANT SELECT) **depois** que o app ler os PINs só pela RPC do item 2A.6.
4. Trigger `trg_validate_order_fees`: não sobrescrever valores já gravados (ver Fase 3, snapshot).
5. Rollback em `supabase/rollback/` restaurando as policies e grants anteriores.
6. **Testes obrigatórios (sandbox + produção com contas de teste):** cliente comum, loja, motoboy e um usuário "estranho" tentam, pela anon key e JWT próprios (com `curl` ou script): mudar `status` de pedido alheio e do próprio; gravar `driver_id`; gravar `payout_*_done`; ler `delivery_pin`; chamar `check_delivery_pin` sem ser o motorista; chamar `transition_order_status`/`advance_order_status` com transição inválida. **Todas devem falhar.** O fluxo normal B2C, B2B e Coleta deve funcionar do começo ao fim.

---

## Fase 3 — Dinheiro: repasse depois do PIN para a subconta aprovada (C5, C6, H5)

**Pré-condição (dono do produto):** confirmar com o Asaas (Eliana, homologação BaaS) que o modelo "Pix cai na conta da plataforma; depois da entrega, transferência interna por `walletId` para a subconta aprovada do parceiro" atende a homologação. Se o Asaas pedir outro modelo, **pare e reporte**.

**3.1 Snapshot no checkout (H5).** No `/api/asaas/checkout`, depois do `calculateOrderPricing` com a cidade, gravar no pedido: `seller_payout_amount`, `driver_payout_amount`, `platform_fee_amount`, `delivery_fee_amount`, `asaas_fee_amount` e `pricing_snapshot jsonb` (taxas usadas, cidade, modo de frete). Migration para criar as colunas. Saldo, saque, transferência, comprovante (`OrderReceiptModal`) e impressora (`thermalPrinter`) passam a **ler esses valores** e não recalcular. Pedidos antigos sem snapshot: calcular uma vez, com as taxas de hoje, gravar e marcar `pricing_snapshot.backfilled = true`.

**3.2 Tirar o split do checkout (C5).** Remover `paymentBody.split` e todo o bloco de `calculatedSplits` do checkout. Todo Pix cai na conta da plataforma. Pedidos antigos que já tiveram split: identificar pelos pagamentos no Asaas (campo `split` da cobrança) e marcar `payout_seller_done = true` com `incident_logs` explicando, para não pagar de novo no saque (rodar como script único, com relatório antes de gravar).

**3.3 Liquidação depois do PIN (C6).**
1. Nova tabela `settlements` (`id`, `order_id`, `partner_id`, `role` seller/driver, `amount`, `wallet_id`, `status` PENDING/PROCESSING/DONE/FAILED/WAITING_ACCOUNT, `asaas_transfer_id`, `attempt_ref`, `failure_reason`, timestamps) com **unique (order_id, role)**. RLS: parceiro lê as próprias linhas; escrita só service_role.
2. Quando o pedido vira `RECEIVED` (trigger em `orders` ou a própria `check_delivery_pin`), inserir as duas linhas de `settlements` (vendedor e motorista) com os valores do snapshot e lançar o crédito em `partner_ledger`.
3. Rota de servidor `/api/settlements/process` (cron da Vercel a cada 15 min + chamada logo após o PIN): para cada `settlements` PENDING/FAILED, se o parceiro tem `asaas_account_status = 'APPROVED'` e `asaas_wallet_id`, fazer `POST /transfers` com `walletId` (transferência entre contas Asaas), `externalReference = attempt_ref`, e tratar o retorno como no saque (PENDING = processando; webhook `TRANSFER_*` fecha DONE/FAILED; idempotência como no item 1.5). Sem subconta aprovada: `WAITING_ACCOUNT`, e o app avisa o parceiro para concluir o cadastro no Asaas.
4. **Nunca** transferir para `pix_key`/`cpf_cnpj` digitados. O parceiro saca da própria subconta pelo app do Asaas.
5. Estorno antes do PIN: nada a desfazer (ainda não houve repasse). Estorno depois do PIN: só admin, e cria `settlements` negativo/ocorrência para cobrar do parceiro, sem automação.

**3.4 Transição do modelo antigo.**
1. Antes de ligar o 3.3: pagar ou rejeitar todos os `withdrawal_requests` abertos pelo fluxo atual, com conferência manual.
2. Depois de ligado: esconder o botão "Solicitar saque" nas telas de parceiro e mostrar "Seus repasses" (lista de `settlements` com status) e o link para o app do Asaas. `withdrawal_requests` fica só como histórico.
3. Desativar `/api/asaas/transfer` (rota legada) e `lib/payoutCalc.ts`; o sweep passa a processar `settlements`.
4. **Conciliação manual (M4):** pedido conciliado fora do Asaas não gera `settlements` automático (o dinheiro não está na conta Asaas); o admin registra o repasse manual. Exigir `pix_end_to_end_id` **único** (índice unique parcial).

**3.5 Testes.** Sandbox: B2C, B2B e Coleta pagos → PIN → duas transferências por `walletId` → webhook `TRANSFER_DONE` → `settlements.DONE`. Repetir a chamada de processamento 3 vezes seguidas: **uma** transferência por linha. Parceiro sem subconta aprovada fica `WAITING_ACCOUNT`. Em produção: um pedido real de valor baixo até a transferência chegar na subconta.

---

## Fase 4 — Restante

1. **Preço e distância no servidor (C8).** O checkout recebe só `items: [{product_id, quantity}]` e o endereço/coordenadas de entrega. O servidor busca preço em `products` (ou na tabela de preços da loja/fornecedor usada hoje), calcula o subtotal, e calcula a distância (Haversine) entre as coordenadas da loja (`users`/`storefronts`) e as da entrega. Recusar se a entrega estiver fora do raio configurado. Gravar `order_items` com o preço do servidor.
2. **Coleta (M2).** Definir o vendedor correto da coleta (EcoPonto/Caçamba de destino) e nunca usar o próprio comprador como `seller_storefront_id`. Confirmar com um pedido de teste que o valor não é cobrado em dobro.
3. **Textos (M1).** Remover "saque instantâneo", "2 saques por dia" e o contador em `localStorage` das telas de motoboy, caminhão, fornecedor e batedeira, dos manuais (`AdminManualModal`, `PartnerManualModal`, `docs/04_MANUAIS_DE_USO.md`) e dos PDFs públicos em `apps/mobile/public/`. Texto novo: "O repasse cai na sua subconta Asaas depois que o cliente confirma a entrega com o PIN."
4. **Banco versionado (M5).** Transformar o `db diff` da Fase 2 em migrations oficiais, mover os `.sql` soltos da raiz para `docs/historico/sql/` e corrigir as migrations com `\$\$`.
5. **Código morto.** `components/BlockedUserGuard.tsx`, `components/admin/UserManagementTable.tsx`, `/api/asaas/documents` (ou criar a tela), consultas de `partnerBalance` por colunas que não existem (`loja_id`, `fornecedor_id`, `origem_id`, `motorista_id`).
6. **Testes automatizados mínimos:** `pricingEngine` (B2C/B2B/Coleta, frete fixo e por km, taxas por cidade), `advance_order_status` (matriz e papéis) e idempotência de `settlements`.

---

## Critério de aceite do R11

- Nenhum usuário consegue, pela anon key e pelo próprio JWT, mudar status, motorista ou repasse de pedido, nem ler PIN de pedido que não comprou (testes da Fase 2B passam).
- Não existe split no checkout; todo pedido entregue gera no máximo um repasse por papel, sempre para a subconta aprovada, mesmo com chamadas repetidas e quedas de rede.
- Saldo, comprovante, impressora e repasse mostram os **mesmos** valores, vindos do snapshot do pedido.
- O deploy do CI passa e só publica Edge Functions que existem e compilam.
- 10 pedidos reais seguidos: pagos pelo QR, aceitos, entregues com PIN e repassados à subconta, sem ação manual.
