# AçaíFood — Auditoria pós-R11 (02/10/2026, noite)

**Escopo:** o que mudou com o R11: 3 migrations novas (`20261002000000_fase2…`, `20261002010000_fase2b…`, `20261002020000_fase3…`) e os rollbacks, `deploy.yml`, `useAppStore.ts`, `admin/page.tsx`, `page.tsx`, rotas `checkout`, `refund`, `status`, `sweep`, `withdrawals` e a rota nova `api/settlements/process`. A pasta `supabase/functions` agora está vazia. Nenhum arquivo de código foi alterado.
**Não lido:** `api/admin/payout/mark-done` e `api/admin/withdrawals/[id]/*` (pastas fundas demais para a ferramenta).
**Método:** só leitura. Não sei quais migrations já rodaram em produção; os itens 🗄️/⚙️ precisam ser conferidos no Supabase, na Vercel e no Asaas.

## Resumo

A Fase 1 entrou quase toda. O split saiu do checkout e o snapshot de valores passou a ser gravado. **Mas o app ainda não está ok, e a parte nova de dinheiro não pode ser ligada como está:**

1. A rota que faz os repasses (`/api/settlements/process`) usa colunas e status que **não existem** na tabela `settlements` criada pela migration. Ela falha logo na primeira consulta, e nenhum repasse sai.
2. O saque antigo continua ativo **ao mesmo tempo** que o repasse novo. Quando o repasse funcionar, o mesmo pedido pode ser pago duas vezes.
3. Qualquer usuário logado ainda consegue gerar um PIN válido para qualquer pedido e confirmar a entrega. Agora isso **dispara o repasse automaticamente**.
4. O pedido sem snapshot repassa ao vendedor o **valor bruto dos produtos**, sem descontar a comissão.

| Situação | Itens |
|---|---|
| ✅ Corrigido | Edge Functions removidas, N1, N2, N3, H1, C5 (split fora do checkout), snapshot no checkout, coluna `cidade` no sweep, fallbacks de PIN no navegador, índice único do E2E |
| 🟡 Parcial | A6 (UPDATE direto revogado, mas a RPC antiga contorna), Fase 3 (tabela e trigger criados, processamento quebrado) |
| 🔴 Aberto | A7, A9/H7, H2, H4/1.6, C6, C8, H5, M1, M2, M5 |
| 🆕 Novo | R1–R7 abaixo |

---

## O que foi corrigido ✅

| Item | Como ficou |
|---|---|
| Edge Functions quebradas | Pasta vazia. O CI agora só roda `tsc` e não publica funções. ⚙️ Confirme no painel do Supabase que `asaas-checkout` e `asaas-status` foram **apagadas** lá também (o CI não apaga) |
| N1 estorno sem pedido | Sem pedido encontrado, só admin |
| N2 quem cancela e quando | Comprador só até `PAID`; loja até `READY`; depois disso só admin |
| N3 Pix depois do cancelamento | Registra `PAYMENT_AFTER_CANCEL` e estorna sozinho |
| H1 saque `FALHOU` reaproveitado | Um saque novo marca os `FALHOU` anteriores como `REJEITADO` |
| C5 split no checkout | Removido. Todo Pix cai na conta da plataforma |
| H5 (parte) snapshot | Checkout grava `seller_payout_amount`, `driver_payout_amount`, taxas e `pricing_snapshot` |
| H6 coluna da cidade | `sweep` usa `cidade` |
| Fallbacks de PIN no navegador | Removidos (sem RPC não confirma) |
| M4 E2E repetido | Índice único em `pix_end_to_end_id` |
| `advance_order_status` / `accept_order_atomic` | Usam `auth.uid()`, checam papel e status |

---

## Novos 🆕

**R1. O processamento de repasses não funciona (Crítico, funcional).** A migration cria `settlements` com os status `PENDING/PROCESSING/DONE/FAILED/WAITING_ACCOUNT` e **sem** as colunas `attempts`, `last_error` e `transferred_at`. A rota `api/settlements/process`:
- faz `select(…, attempts, …)` e `.lt('attempts', 5)` → erro na consulta → 500;
- grava os status `TRANSFERRED` e `WAITING_KYC`, que a constraint recusa;
- marca `TRANSFERRED` assim que o Asaas aceita, sem esperar o `TRANSFER_DONE`, e o webhook não atualiza `settlements` (só `withdrawal_requests`);
- não tem cron no `vercel.json` (só o `sweep`) e exige admin; o app não a chama depois do PIN.

→ Alinhar a tabela e a rota (mesmos nomes de status e colunas), tratar `TRANSFER_*` no webhook para `settlements`, criar o cron e travar cada linha com update condicional (`.eq('status','PENDING')`) antes de transferir.

**R2. Saque antigo e repasse novo ao mesmo tempo = pagamento em dobro (Crítico).** O botão "Solicitar saque" e `POST /api/asaas/withdrawals` continuam ativos. `partnerBalance` conta todo pedido `RECEIVED` com `payout_*_done = false`, e o trigger de `settlements` **não marca** `payout_*_done`. Assim que o R1 for corrigido, o mesmo pedido entra no saque **e** no repasse.
→ Antes de ligar o repasse: zerar os saques abertos, desligar o saque antigo (rota devolve 410, botão escondido) e fazer o trigger marcar `payout_seller_done`/`payout_driver_done` ao criar o `settlement`. Também é preciso excluir de `settlements` os pedidos já pagos por split antes do R11 (item 3.2 do prompt; não encontrei o script).

**R3. Qualquer usuário confirma a entrega de qualquer pedido, e agora isso gera repasse (Crítico) 🗄️.** `generate_delivery_pin(p_order_id)` é `SECURITY DEFINER`, **devolve o PIN em texto** e não confere quem chama. Nenhuma migration revoga o `EXECUTE` dela, e funções novas no Postgres são executáveis por todos por padrão. `check_delivery_pin` também não confere se quem chama é o motorista. Um motoboy aceita um pedido `PAID` (o `accept_order_atomic` aceita até `PAID`/`PREPARING`), chama `generate_delivery_pin`, recebe o PIN, chama `check_delivery_pin`: o pedido vira `RECEIVED`, o cliente perde o estorno e o trigger cria os repasses.
→ `REVOKE EXECUTE ON FUNCTION generate_delivery_pin, generate_pickup_pin FROM PUBLIC, anon, authenticated` (só service_role). `check_delivery_pin`/`check_pickup_pin` exigindo `auth.uid() = driver_id`. Conferir em produção quem tem `EXECUTE` nessas funções.

**R4. Repasse do valor bruto quando falta snapshot (Crítico).** No trigger, se `seller_payout_amount` for nulo **ou zero**, o repasse do vendedor vira `products_subtotal` inteiro, sem a comissão de 10–15%. Isso vale para todo pedido criado antes do deploy que for entregue depois, e para pedido cujo repasse calculado é zero de verdade (por exemplo, quando o subsídio de frete da loja cobre tudo).
→ Sem snapshot: calcular uma vez com `calculateOrderPricing` (backfill marcado) ou deixar o `settlement` em revisão manual, **nunca** usar o subtotal. Repasse zero continua zero.

**R5. Coleta repassa o dinheiro de volta para quem pagou (Alto).** Na coleta, `seller_storefront_id` é a loja do próprio comprador (C1/M2, aberto). O trigger cria um `settlement` de vendedor para essa loja com ~90% do valor da coleta. A Loja/Batedeira paga a coleta e recebe quase tudo de volta.
→ Corrigir o vendedor da coleta (EcoPonto/Caçamba) antes de ligar o repasse, ou não criar `settlement` de vendedor quando o vendedor é o próprio comprador.

**R6. Baixa forçada sem checar o status (Médio).** `advance_order_status('force_receive')` (admin) leva a `RECEIVED` pedidos em qualquer status, inclusive `CANCELLED` e `REFUNDED`, e o trigger cria repasse para pedido estornado.
→ Aceitar só a partir de `DELIVERING`/`DELIVERED`/`PIN_LOCKED`, como no prompt.

**R7. Ordem de deploy do checkout (Médio) ⚙️.** O checkout grava as colunas novas do snapshot já no INSERT, inclusive no "fallback". Se a migration da Fase 3 não estiver aplicada quando o código for publicado, **nenhum pedido é criado**.
→ Confirmar que `20261002020000_fase3…` rodou em produção antes (ou junto) do deploy.

---

## Continuam abertos 🔴

| Item | Situação |
|---|---|
| **A7** `transition_order_status` | Sem mudança. Calcula a matriz e não usa; é `SECURITY DEFINER` e executável por qualquer usuário. Por isso contorna o REVOKE da Fase 2B: qualquer logado leva o próprio pedido de `PENDING` a `PAID` sem pagar, ou cancela pedido alheio. O app ainda a usa para pagar, cancelar e retirar |
| **H4 / item 1.6** | `confirmar_pagamento` ainda chama `transition_order_status(…'PAID')`. Com o `PixModal` aberto, o pedido volta de `PREPARING` para `PAID` |
| **A9 / H7** PIN visível | `fetchOrders` continua lendo `delivery_pin` e `pickup_pin` para todo mundo, inclusive o motoboy. A policy do radar continua `SELECT *`. O `REVOKE SELECT (pin_hash, provided_pin) FROM anon` não tem efeito (há GRANT na tabela inteira, e o problema é `authenticated`). `get_my_order_pins` foi criada, mas o app não usa |
| **H2** idempotência do saque | `withdrawalApproval` sem mudança |
| **C6** saque para chave digitada | Continua, porque o saque antigo continua ativo |
| **C8** preço e distância | Ainda vêm do celular |
| **H5** | Saldo, comprovante e impressora ainda recalculam (não leem o snapshot) |
| **M1** textos | "Saque instantâneo" e "2 por dia" continuam nas telas |
| **M2** coleta | Ver R5 |
| **M5** banco | Sem `db diff`; `.sql` soltos continuam na raiz |
| Rollback 2B | Devolve o GRANT, mas não recria a policy de UPDATE removida |
| Ação `pagar_motorista` | Ainda faz UPDATE direto em `orders`. Com o REVOKE, **falha em silêncio**; deveria chamar `advance_order_status('archive_driver')` |

---

## O que fazer hoje (sem código)

1. **Não ligar** o repasse novo nem o pagamento automático.
2. **Supabase → SQL Editor:** conferir quais migrations rodaram e quem tem `EXECUTE` em `generate_delivery_pin`, `check_delivery_pin` e `transition_order_status`.
3. **Supabase → Edge Functions:** confirmar que não sobrou nenhuma função publicada.
4. **Pedidos `RECEIVED` nas últimas horas:** conferir se foram entregues de verdade, comparando com o histórico do PIN (`pin_attempt_log`).
5. Continuar aprovando saques manualmente, conferindo os pedidos.

## Próxima rodada (R12): ordem sugerida

1. **Banco, urgente:** R3 (revogar `generate_*_pin`; `check_*_pin` com `auth.uid()`), A7 (matriz + papel em `transition_order_status`, `PAID` só para service_role) e 1.6 (o app nunca pede `PAID`).
2. **Repasse antes de ligar:** R1 (alinhar tabela e rota, webhook, cron), R2 (desligar o saque antigo, marcar `payout_*_done`, excluir pedidos já pagos por split), R4 (sem fallback bruto), R5 (coleta), R6.
3. **PIN fora do SELECT:** o app passa a usar `get_my_order_pins`, view do radar sem PIN e telefone, e REVOKE das colunas para `authenticated`.
4. **Depois:** H2, H5 (comprovante e impressora leem o snapshot), C8, M1, M5, `pagar_motorista` e o rollback 2B.
