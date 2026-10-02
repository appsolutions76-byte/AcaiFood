# AçaíFood — Reauditoria (02/10/2026, noite)

**Escopo:** conferir as correções aplicadas hoje sobre a oitava auditoria (`09_AUDITORIA_2026-10-02.md`). Foram lidos os 7 arquivos alterados (`lib/apiAuth.ts`, `lib/partnerBalance.ts`, rotas `refund`, `status`, `link-wallet`, `withdrawals` e a Edge Function `asaas-checkout`) e conferidos os que não mudaram. Nenhum arquivo de código foi alterado.
**Não houve migration nova:** tudo que depende do banco (RLS de `orders`, `transition_order_status`, PIN no radar) continua como estava.
**Método:** só leitura do código. Os itens 🗄️/⚙️ precisam ser conferidos no Supabase, Asaas, Vercel ou GitHub.

## Resumo

As 3 brechas críticas novas da oitava auditoria foram fechadas no código da Vercel, e o webhook não para mais a fila do Asaas. **Ainda não está ok:** as Edge Functions `asaas-checkout` e `asaas-status` estão com **erro de sintaxe** e o deploy automático provavelmente falha, o que pode deixar a versão antiga e vulnerável no ar. Além disso, as falhas que dependem do banco e o modelo de repasse decidido em 23/09 continuam abertos.

| Situação | Qtde |
|---|---|
| ✅ Corrigido | 5 (C1, C2, C3 na Vercel, C7, H3) |
| 🟡 Parcial | 4 (C4, H1, H4, Edge Functions) |
| 🔴 Aberto | 11 (A7, C5, C6, C8, H2, H5, H6, H7, M1, M2, M4–M6) |
| 🆕 Novo | 3 (N1–N3) |

---

## O que foi corrigido ✅

| Item | Como ficou |
|---|---|
| **C1** qualquer usuário vira admin | `user_metadata.role` removido. Admin só por `users.role`/`users.is_admin` |
| **C2** estorno sem login | Exige login; só comprador, dono da loja ou admin; só UUID completo (o prefixo `PED-` foi removido) |
| **C3** pedido pago com R$ 1 (lado Vercel) | `GET /api/asaas/status` confere o valor contra `charged_amount` e só muda pedido que ainda está pendente |
| **C7** `link-wallet` aprova qualquer UUID | Agora começa como não aprovado e só aprova se a wallet pertencer a uma subconta da plataforma com o CPF/CNPJ do usuário e status aprovado |
| **H3** webhook com erro 400 pausava a fila | Divergência de valor é registrada e responde 200 |
| **H4** webhook fazia o pedido voltar para `PAID` (lado servidor) | Só muda pedido pendente; nos outros casos atualiza apenas `asaas_charge_status`, sem gerar PIN novo. Falta o lado do app (ver abaixo) |

**H4 continua parcial no app** (errata, revisada ao preparar o R11): `acaoPedido('confirmar_pagamento')` grava `status = 'PAID'` **direto** em `orders` pelo navegador (`updates.status = newDbStatus`). O `PixModal` dispara essa ação em qualquer update Realtime (`PREPARING`, `READY`, `DELIVERING`…). Se o modal ainda estiver aberto quando a loja aceitar o pedido, ele volta para `PAID`. O webhook está corrigido; falta tirar essa gravação do app.

## Parciais 🟡

**C4. Entrega sem o cliente.** ✅ O saldo de saque agora só conta `RECEIVED`, o único status que passa pelo PIN (os textos em português da lista são barrados pela constraint do banco 🗄️). 🔴 Mas o PIN continua visível para a loja e para o motoboy (`SELECT *` em `orders`), e `check_delivery_pin` não confere quem chama. A loja ou um motoboy que se coloque como entregador (UPDATE livre no radar) lê o PIN, confirma a "entrega" sem o cliente e saca. Depois do `RECEIVED`, o cliente perde o estorno automático.
→ Depende das migrations A6/A9: tirar o PIN do SELECT de quem não é o comprador, guardar só o hash e fazer `check_delivery_pin` exigir `auth.uid() = driver_id`.

**H1. Saque em dobro.** ✅ Um saque `PROCESSING` agora bloqueia um pedido novo. 🔴 Um saque `FALHOU` ainda não bloqueia: o parceiro pede um saque novo com os mesmos pedidos, e o antigo continua podendo ser reaprovado (`processWithdrawalApproval` aceita `FALHOU`). Se os dois forem aprovados, paga duas vezes.
→ Bloquear também com `FALHOU` aberto, ou fechar o `FALHOU` como `REJEITADO` quando um saque novo for criado.

**Edge Functions (C3/M5).** `asaas-checkout` foi "desativada", mas o código antigo ficou **abaixo** do `serve()`, e o arquivo não compila (4 erros de sintaxe, linhas 208 e 218). `asaas-status` também não compila (linha 58: uma URL perdeu as crases). O CI roda `supabase functions deploy` a cada push; com erro de sintaxe, o deploy dessas funções falha e **a versão que está no ar continua sendo a antiga** ⚙️. A versão antiga de `asaas-checkout` aceita qualquer valor, e a de `asaas-status` marca o pedido como `PAID` sem conferir o valor. Juntas, elas reabrem o C3.
→ **Hoje:** apagar `asaas-checkout` e `asaas-status` no painel do Supabase (o app não usa a primeira; a rota `status` só chama a segunda como último recurso). Depois, apagar as pastas no repositório. Conferir no GitHub → Actions se o deploy está falhando e, no painel, a data de publicação de cada função (inclusive se a `debug-orders` desativada chegou a ser publicada).

## Novos 🆕

**N1. Estorno de cobrança que não é pedido (Alto).** Em `/api/asaas/refund`, a checagem de dono só roda quando o pedido é encontrado. Se a pessoa manda um `paymentId` (`pay_…`) que não está ligado a nenhum pedido, o estorno é feito no Asaas sem checar nada. Exemplo real: o parceiro paga a **taxa de ativação** (`ACTIVATE_<id>`), é ativado e depois estorna a própria taxa por essa rota, continuando ativo.
→ Sem pedido encontrado, só admin pode estornar.

**N2. Cliente estorna depois que o motoboy saiu (Médio).** O estorno automático só é bloqueado depois da entrega. O comprador consegue estornar com o pedido em `PREPARING`, `READY` ou `DELIVERING`, ou seja, com o açaí já pronto ou a caminho.
→ Comprador só cancela em `PAID` (antes da loja aceitar); depois disso, só a loja ou o admin.

**N3. Pagamento que chega depois do cancelamento (Médio).** Se o cliente paga um Pix de um pedido já `CANCELLED`, o webhook não muda o pedido (correto), mas também não estorna nem registra nada. O dinheiro fica parado na conta.
→ Registrar em `incident_logs` e estornar automaticamente.

## Continuam abertos 🔴

| Item | Resumo |
|---|---|
| **A7** | `transition_order_status` não confere papel nem matriz: qualquer usuário logado chama a RPC e leva o próprio pedido de `PENDING` para `PAID` sem pagar 🗄️ |
| **C5** | Checkout ainda faz split para o vendedor com qualquer wallet não rejeitada, e o saque paga de novo (pagamento em dobro) |
| **C6** | Saque ainda vai para `pix_key` ou `cpf_cnpj`, que o próprio usuário edita |
| **C8** | Subtotal, preços e distância ainda vêm do celular |
| **H2** | Saque sem idempotência: se a rede cair depois do Asaas aceitar, o saque vira `FALHOU` e pode ser pago de novo |
| **H5** | Saldo e `/transfer` usam a taxa global de hoje, não a da cidade nem a do momento da compra |
| **H6** | `sweep` busca `users.city` (a coluna é `cidade`); o automático provavelmente não processa nada 🗄️ |
| **H7** | PIN em texto puro e RPCs de PIN sem checar quem chama (ver C4) |
| **M1** | Telas ainda falam em "saque instantâneo" e "2 por dia" |
| **M2, M4–M6** | Coleta, conciliação manual (E2E repetido; repasse sai do saldo de outros), banco sem versionamento, arquivos gigantes |

---

## O que fazer hoje (sem código)

1. **Supabase → Edge Functions:** apagar `asaas-checkout` e `asaas-status`.
2. **GitHub → Actions:** ver se o "Deploy to Production" está falhando.
3. **Pagamento automático:** manter desligado.
4. **Antes de aprovar um saque:** confirmar que o parceiro não tem outro saque `FALHOU` com os mesmos pedidos (H1).
5. **Taxas de ativação:** conferir no Asaas se alguma foi estornada (N1).

## Próxima rodada de correção (R11)

1. **Urgente:** Edge Functions (apagar), N1, H1 (`FALHOU`), N2.
2. **Migration de banco (uma só, testada antes):** A7 (`transition_order_status` com papel + matriz; `PAID` só pelo servidor), A6 (revogar UPDATE de `status`, `driver_id`, `payout_*`, `products_subtotal`), A9/H7 (PIN fora do SELECT, só hash, RPC com `auth.uid()`).
3. **Modelo de repasse decidido em 23/09:** tirar o split do checkout (C5), repasse depois do PIN para a subconta aprovada (C6), snapshot dos valores no pedido (H5), idempotência (H2).
4. **Depois:** C8, H6, M1–M6.
