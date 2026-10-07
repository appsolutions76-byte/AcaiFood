# Prompt — R16 para o Antigravity (AçaíFood)

> **Situação (06/10/2026, fim do dia):** todos os itens deste prompt foram feitos — o item 1 pelo Antigravity (revisado) e os itens 2 a 8 pelo Claude direto no código. **Não é preciso colar este prompt de novo.** O resumo, os testes e o checklist de publicação estão em `docs/21_RELATORIO_FINAL_R16_2026-10-06.md`.

## Contexto

O AçaíFood (Next.js 16 em `apps/mobile`, Supabase, Asaas BaaS) está no ar, **ainda sem operação real**.
- A Tomadora do contrato BaaS com o Asaas é a **Eletromecânica Baia Ltda** (CNPJ 42.035.623/0001-40).
- Leia antes: `docs/18_PROMPT_CORRECOES_R15.md` (regras e contrato) e `docs/19_AUDITORIA_POS_R15_2026-10-06.md` (achados).

## Regras (obrigatórias)

1. **Não altere a lógica dos arquivos do bloco "Já feito"**, a não ser para corrigir erro de compilação; nesse caso explique o porquê.
2. **Nunca edite migration já existente.** Mudança no banco = migration nova em `supabase/migrations/` + reversão em `supabase/rollback/`.
3. **É proibido:**
   - PIN fixo ou PIN mestre;
   - `GRANT` para `anon` em função que muda pedido ou dinheiro;
   - "fallback" que grava direto em `orders`, `users` ou `withdrawal_requests`;
   - dado inventado enviado ao Asaas (e-mail, CPF, renda, endereço, cidade, UF);
   - valor de dinheiro vindo do navegador;
   - Pix para chave digitada, CPF ou e-mail (saque só por `walletId` de subconta `APPROVED`);
   - variável `NEXT_PUBLIC_` com segredo.
4. Código em inglês, telas em PT-BR. Nenhum `console.log` com CPF, nome, e-mail, telefone ou chave Pix.
5. `settlements_enabled` e `auto_payout_enabled` continuam `false`.
6. Ao fim de **cada item**, rode `npm run build` em `apps/mobile`, diga o que mudou e como testou. **Pare e espere aprovação** antes do próximo.

## Já feito pelo Claude (só conferir; não refazer)

| Item | Arquivos |
|---|---|
| Versão única dos aceites (`CURRENT_TERMS_VERSION`) + modal de aceite no login | `lib/legalVersions.ts`, `api/terms/accept`, `api/terms/status`, `components/TermsAcceptanceGate.tsx`, `app/layout.tsx` |
| Cadastro na ordem certa: aceites → subconta (KYC real) → ativação com token; renda sem ÷100; celular, rua, número e bairro obrigatórios | `app/cadastro/page.tsx`, `store/useAppStore.ts` (`registerUser` não cria mais subconta; chamada `asaas-create-subaccount` removida) |
| Subconta sem valores inventados, `mobilePhone` obrigatório, `webhooks` de situação da conta na criação, subconta já existente → `NEEDS_ADMIN` | `api/asaas/subaccount` |
| Webhook de conta: token obrigatório (`isValidAsaasWebhook`), aprovação só com `accountStatus.general === 'APPROVED'` | `api/asaas/account-webhook`, `lib/asaasAccountStatus.ts` |
| Reserva do webhook: `GET` (cron diário) e `POST` (botão "Reconsultar") | `api/asaas/account-status-sync`, `vercel.json` |
| Cartão "Minha conta Asaas": formulário de abertura, documentos (`onboardingUrl` ou upload com `documentFile` + `type`) | `components/AsaasAccountStatusCard.tsx`, `api/asaas/documents` |
| Saque só para `walletId` de subconta `APPROVED`; valor nunca acima do saldo do servidor; idempotência pela tentativa anterior; timeout → `PROCESSING` (não `FALHOU`); webhook casa por `externalReference` | `lib/asaasTransferHelpers.ts`, `lib/withdrawalApproval.ts`, `api/asaas/status` |
| MFA obrigatório (claim `aal2`) em rota de admin; cron só com `Bearer CRON_SECRET` | `lib/apiAuth.ts` |
| Chave Asaas só da variável de ambiente; preview nunca usa chave de produção | `lib/asaasConfig.ts` |
| Preço e distância calculados no servidor; e-mail real do comprador | `lib/serverOrderPricing.ts`, `api/asaas/checkout` |
| Privacidade de `users` (SELECT por coluna, `get_my_profile_json`); admin lê usuários por `/api/admin/users`; lista de pedidos sem colunas bloqueadas; fallback do aceite de corrida removido | migration `20261006030000`, `store/useAppStore.ts`, `api/admin/users` |
| Radar com `store_name` (antes usava `sf.name`, que não existe) e coordenadas a ~1 km; `admin_audit_log` só aceita inclusão; app não cria usuário com subconta aprovada | migration `20261006030000` |
| `link-wallet` só admin e só walletId com o mesmo CPF/CNPJ; flag de taxa de ativação gravada na coluna, com log | `api/asaas/link-wallet`, `api/admin/activation-config` |
| Rollback de `20261006020000` devolve as chaves antes de apagar `partner_secrets` | `supabase/rollback/20261006020000_…` |

## Item 0 — Compilar

- Em `apps/mobile`: `npm install` e `npm run build`.
- Corrija só erros de tipo/compilação, sem mudar a lógica.
- Liste cada correção.

## Item 1 — Rotas que o Claude não conseguiu abrir (pastas fundas)

1. **`api/admin/payout/pay-partner/route.ts`**:
   - aceitar só `{ partnerId }`;
   - **ignorar** `pixKey`, `walletId`, `value`, `role`, `description` vindos do navegador;
   - calcular o saldo com `getPartnerAvailableBalance`;
   - criar um `withdrawal_request` (`requested_amount`, `order_ids`, status `PENDENTE`);
   - chamar `processWithdrawalApproval` e gravar `logAdminAction`.

   No `app/admin/page.tsx` (~388 e ~474), mandar só `{ partnerId }` e mostrar a mensagem de "conta Asaas não aprovada" quando vier.
2. **`api/admin/orders/regenerate-pin`**:
   - só admin;
   - usa `generate_delivery_pin`/`generate_pickup_pin` com service_role;
   - **não devolve o PIN**;
   - zera tentativas e tira de `PIN_LOCKED` para `DELIVERING`;
   - `logAdminAction`.
3. **`api/admin/payout/mark-done`** e **`api/admin/withdrawals/[id]/approve|reject`**: `logAdminAction` com antes/depois. `approve` só chama `processWithdrawalApproval`.

## Item 2 — Log de admin (Anexo I, 7)

`logAdminAction` (quem, ação, alvo, antes/depois, `request`) em:
- `reconcile-payment` e `asaas/refund`;
- `payout-settings`;
- `delete-user` e `user/status` (quando quem muda é admin);
- `clear-data` e `reset-balances`;
- `admin/settlements`, se ainda faltar.

Tela "Log de auditoria" no admin: só leitura, com filtro por data e ação, via rota de servidor.

## Item 3 — Admin: subcontas e repasses

1. **Lista "Subcontas Asaas"** (rota de servidor, service_role):
   - nome, perfil, CPF/CNPJ mascarado, `asaas_account_status`, `asaas_account_status_detail`, data;
   - botão "Reconsultar" → `POST /api/asaas/account-status-sync { userId }`;
   - destaque para `NEEDS_ADMIN` e `REJECTED`.
2. **Tela "Repasses"** usando `api/admin/settlements`:
   - lista por status;
   - aprovar `REVIEW` com valor recalculado no servidor;
   - cancelar;
   - tudo com log.

## Item 4 — Relatório mensal e suporte (cl. 7.1 e 11)

- `AdminSupportSection` (~397, ~403): trocar `window.open(...?token=)` por `fetch` com header `Authorization` + download por `Blob`.
- `monthly-report`:
  - remover `'99.98%'`;
  - criar tabela `monthly_sla (month text primary key, uptime_percent numeric, source text, created_at timestamptz)` com campo no admin para informar o mês;
  - sem valor, "não medido".
- No fechamento do chamado: "Reclamação procedente? Sim/Não" gravando `is_merited` e `resolved_at`.

## Item 5 — Telas de saque e textos (M1, H5)

- Em `parceiros/motoboy`, `caminhao`, `fornecedor`, `batedeira` e `PartnerWithdrawalSection`:
  - remover "2 saques por dia", "transferir instantaneamente" e o contador em `localStorage`;
  - botão de saque só com `asaas_account_status === 'APPROVED'`; antes disso, mostrar o cartão "Minha conta Asaas";
  - texto: "Seu saque é analisado e pago na sua subconta Asaas".
- `OrderReceiptModal`, `thermalPrinter` e a tela de saldo leem `seller_payout_amount`, `driver_payout_amount`, `platform_fee_amount` e `delivery_fee_amount`.

## Item 6 — Configuração fora de `asaas_platform_wallet_id`

- Migration nova: tabela `platform_config (key text primary key, value jsonb, updated_at timestamptz)`.
- Mover para ela taxa de ativação, cota de fundadores e WhatsApp do suporte, que hoje ficam em JSON dentro de `platform_settings.asaas_platform_wallet_id`.
- Atualizar `founderQuota.ts`, `api/support` e `api/admin/activation-config`.
- A flag que vale continua sendo a coluna `activation_fee_enabled`.
- Em `api/asaas/activation`, remover o e-mail inventado `user_…@acaifood.app.br` (usar o e-mail do usuário logado).

## Item 7 — Testes no CI

Em `.github/workflows/deploy.yml`, além do `tsc`, rodar testes contra o **projeto Supabase de teste** e o **Asaas sandbox** (segredos no GitHub):
- PIN: os 12 casos do anexo A do `docs/18`;
- `users`: cliente não lê `cpf_cnpj`/`pix_key`/`birth_date` de outro usuário;
- radar sem dados do cliente;
- checkout com `productsSubtotal: 0.01` → cobra o preço real;
- saque sem conta `APPROVED` → `FALHOU`; timeout → `PROCESSING`; reprocessar não duplica;
- `/api/asaas/subaccount` sem aceites → 400;
- webhook de conta sem token → 401; evento `ACCOUNT_STATUS_DOCUMENT_APPROVED` não aprova a conta.

## Item 8 — Docs

- Atualizar `docs/01`, `02`, `04` e o `README` (índice `01`–`20`) só com o que existe.
- O `04` ganha "Como abrir sua conta Asaas".
- Em `docs/seguranca/REGISTRO_DE_VULNERABILIDADES.md`, registrar:
  - PIN mestre/anônimo de 03/10;
  - leitura ampla de `users`;
  - saque por chave Pix de 04/10;
  - radar quebrado (`sf.name`).

## Antes de publicar (dono do produto)

1. **Vercel → Environment Variables** (Production e Preview separados):
   - `ASAAS_API_KEY`: produção só em Production; chave sandbox em Preview;
   - `ASAAS_WEBHOOK_TOKEN`;
   - `ASAAS_WEBHOOK_EMAIL` (e-mail da equipe para avisos do webhook);
   - `APP_BASE_URL=https://www.acaifood.app.br`;
   - `CRON_SECRET`.

   Apagar `NEXT_PUBLIC_ASAAS_WEBHOOK_SECRET`, se existir.
2. **Admin:** entrar no `/admin` e cadastrar o TOTP (MFA) **antes** do deploy. Depois dele, sem MFA o admin fica sem acesso às rotas de admin.
3. **Supabase → SQL Editor:** rodar `20261006030000_r16_users_privacy_account_status_radar.sql` **junto com o deploy** (o app novo lê o perfil por `get_my_profile_json`).
4. **Testar no ar:**
   - cliente vê a lista de lojas e os próprios pedidos;
   - parceiro novo se cadastra e vê "Minha conta Asaas";
   - motoboy vê corridas no radar.
