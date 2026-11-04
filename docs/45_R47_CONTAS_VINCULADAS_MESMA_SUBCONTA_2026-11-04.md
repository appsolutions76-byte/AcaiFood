# R47 — Várias contas do app na mesma subconta Asaas (mesmo CPF/CNPJ) — 2026-11-04

## Problema
Uma mesma pessoa (mesmo CPF/CNPJ) com 2–3 lojas, ou que é motoboy e fornecedor, criava a segunda conta
(outro e-mail) e recebia: "Já existe uma subconta Asaas com este CPF/CNPJ...". O Asaas só permite uma
subconta por CPF/CNPJ.

## Solução
- A primeira conta que abriu a subconta é a **conta principal**. As demais viram **contas vinculadas** e
  recebem pela mesma subconta (mesma carteira, mesma chave, mesmo saldo).
- Ao abrir a conta de recebimento na segunda conta, o app encontra a principal (mesmo CPF/CNPJ e mesma
  subconta) e cria um **pedido de vínculo** (PENDING). A principal aprova no cartão "🔗 Contas vinculadas"
  do painel (ou o admin, em Conformidade).
- Na aprovação o servidor confere que as duas contas têm o mesmo CPF/CNPJ e a mesma subconta.
- **Saque**: por padrão só na conta principal. A principal pode "Liberar saque" para cada vinculada.
- **Saque duplo**: no máximo um saque aberto por subconta (índice único `uq_withdrawal_open_per_account_group`
  + checagem no servidor). O saldo disponível desconta as reservas de todas as contas do grupo.
- **Desvincular**: bloqueado se a vinculada tiver saque, pedido ou corrida em andamento.
- **Registro para o suporte Asaas**: tabela `asaas_request_log` grava o que o app enviou e o que o Asaas
  respondeu na abertura de subconta (sem chaves secretas). Admin → Conformidade → "Requisições enviadas ao
  Asaas" → "Copiar para o suporte".
- Fechamento Mensal: opção "Agrupar por CPF/CNPJ" (uma nota por pessoa).

## Banco (aplicar no Supabase SQL Editor, pelo dono)
`supabase/migrations/20261104020000_r47_shared_payment_accounts.sql` — só adiciona.
Reversão: `supabase/rollback/20261104020000_r47_shared_payment_accounts_rollback.sql`.
Sem a migração o app continua funcionando como antes (contas isoladas).

## Observações
- O Pix que o cliente vê mostra o nome do titular da subconta (o CPF/CNPJ), não o nome de cada loja.
- Pedir ao Asaas (Eliana) confirmação por escrito de que várias contas do app na mesma subconta é permitido.

## Arquivos
Novos: lib/accountGroup.ts, lib/asaasRequestLog.ts, api/asaas/account-links/route.ts,
api/admin/account-links/route.ts, components/PartnerLinkedAccountsCard.tsx,
components/admin/AdminAccountLinksSection.tsx, migração e rollback.
Alterados: api/asaas/subaccount/route.ts, api/asaas/withdrawals/route.ts, lib/partnerBalance.ts,
lib/withdrawalApproval.ts, components/PartnerWithdrawalSection.tsx, components/PartnerDashboardLayout.tsx,
components/admin/AdminFiscalCloseSection.tsx, app/admin/page.tsx.
