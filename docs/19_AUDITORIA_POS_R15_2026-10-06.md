# AçaíFood — Auditoria pós-R15 (06/10/2026, noite)

**Escopo:** tudo o que mudou depois do `docs/18` (R15):
- migrations `20261006010000` e `20261006020000`, e 7 migrations antigas que foram editadas;
- `useAppStore.ts`, `admin/page.tsx`, telas de batedeira e fornecedor;
- `AsaasAccountStatusCard` e `PartnerDashboardLayout`;
- rotas `subaccount`, `documents`, `account-webhook` (nova), `terms/status` (nova), `transfer` e `checkout`.

Também conferi os arquivos que o R15 mandava mudar e **não mudaram**.

**Não lido** (pastas fundas demais para a ferramenta): `api/admin/payout/pay-partner` (nova), `regenerate-pin`, `mark-done` e `withdrawals/[id]/*`.

**Método:** só leitura e comparação com a versão anterior; nenhum arquivo do app foi alterado. Não sei quais migrations já rodaram em produção.

---

## Resumo

**O R15 foi feito em pequena parte**, cerca de um quarto dos itens. A Fase 0 andou; a Fase 1 começou; a Fase 2 não foi feita.

O que foi feito está, em geral, certo:
- a migration de PIN é a mesma que testei;
- o PIN mestre saiu das telas;
- `/api/asaas/transfer` está desativada;
- as chaves das subcontas foram para `partner_secrets`;
- a rota de documentos foi corrigida.

Mas há **uma regressão nova que impede qualquer parceiro novo de criar subconta**, e **o webhook novo de status da conta pode aprovar contas indevidamente**.

| Situação | Itens |
|---|---|
| ✅ Feito | 0.1 migration de PIN (idêntica à testada); PIN `4821`/`9354` e o calculado saíram das telas; fallbacks de PIN removidos; 0.3 `partner_secrets` e coluna apagada de `users`; 0.4 `/api/asaas/transfer` → 410 e admin chamando `pay-partner`; 1.2 `incomeValue` também para CNPJ; rota de documentos com `getAsaasBaseUrl`, `documentFile` e `type`, limite de 10 MB |
| 🟡 Parcial / com defeito | 1.1 versão dos aceites (servidor sim, cadastro não → **regressão**); 1.2 webhook de conta (lógica errada, token opcional, nunca chamado); cartão "Minha conta Asaas" (chamada sem login → 401); 0.3 sem `REVOKE` em `users`; 0.1 fallback do aceite de corrida ainda grava direto |
| 🔴 Não feito | 0.2 lista de pedidos; 0.5 função `asaas-create-subaccount`; 1.1 ordem do cadastro, modal de aceite no login, versão vinda do servidor; 1.2 valores inventados (Centro/Belém/PA/S/N), renda ÷100, `webhooks` na criação, `link-wallet`, `PartnerActivationGuard`, lista no admin; 1.3 taxa de ativação; **1.4 saque**; **1.5 MFA**; 1.6 log de admin; 1.7 relatório; toda a Fase 2 (preço no servidor, comprador real no Asaas, radar, cron, repasses, H5, M1, testes no CI, docs) |

---

## 1. Problemas novos

**N1. Nenhum parceiro novo consegue criar subconta (Crítico, regressão).**
- O servidor (`subaccount/route.ts`) agora exige os aceites na versão **`2026-10-06`**.
- O cadastro (`cadastro/page.tsx`, linha ~290), que não mudou, continua gravando **`2026-10-02`**.
- Resultado: todo parceiro recebe 400 "Aceites regulatórios Asaas pendentes na versão atual". Não existe tela que peça o aceite de novo, porque `/api/terms/status` foi criada mas ninguém a chama.

→ Uma única constante de versão no servidor (`CURRENT_TERMS_VERSION`), usada por `terms/accept` (ignorando a versão enviada pelo navegador), `terms/status` e `subaccount`. Mais o modal de aceite no login, que chama `terms/status`.

**N2. O webhook de status da conta aprova contas cedo demais (Alto).** `account-webhook/route.ts` marca `APPROVED` quando `event.includes('APPROVED')`. O Asaas envia eventos parciais, por exemplo:
- `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED`;
- `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED`;
- `ACCOUNT_STATUS_DOCUMENT_APPROVED`.

Qualquer um deles marcaria a subconta como aprovada e ligaria `split_enabled`, antes da aprovação geral. O mesmo vale para `REJECTED` (um documento recusado marca a conta inteira como recusada).

→ Usar o objeto `accountStatus` do payload: `general === 'APPROVED'` → `APPROVED`; `general === 'REJECTED'` → `REJECTED`; e assim por diante. Guardar as quatro etapas (`commercialInfo`, `bankAccountInfo`, `documentation`, `general`) em `asaas_account_status_detail`.

**N3. O webhook de conta aceita chamada de qualquer um (Alto).**
- O token só é conferido **se** a variável `ASAAS_WEBHOOK_SECRET` existir. O resto do projeto usa `ASAAS_WEBHOOK_TOKEN`; se a nova não foi criada na Vercel, **qualquer pessoa** consegue aprovar uma subconta com um POST.
- Também lê `NEXT_PUBLIC_ASAAS_WEBHOOK_SECRET`: variável `NEXT_PUBLIC_` vai para o navegador, então o segredo ficaria público.

→ Usar `isValidAsaasWebhook()` (o mesmo do webhook de pagamento) e recusar sempre sem token válido. Remover a variável `NEXT_PUBLIC_`.

**N4. O webhook de conta nunca é chamado (Alto, funcional).**
- `subaccount/route.ts` não envia o array `webhooks` no `POST /accounts`, e não há configuração por subconta.
- Também não há a consulta diária de reserva em `/myAccount/status`.
- Resultado: nada atualiza o status, e **nenhum parceiro chega a `APPROVED`**.

→ Enviar `webhooks` na criação, com a URL da rota e os eventos `ACCOUNT_STATUS_*`. Criar o cron de reserva. Para as subcontas já criadas, um botão no admin "Reconsultar status" que chama `/myAccount/status` com a chave da subconta.

**N5. O cartão "Minha conta Asaas" não carrega (Médio).**
- `AsaasAccountStatusCard` chama `/api/asaas/documents` **sem o header `Authorization`**, e a rota responde 401. O cartão nunca mostra os documentos pendentes nem o link do Asaas.
- Não há tela de upload para documentos sem `onboardingUrl`.

→ Usar `getAuthHeaders()`. Para grupos sem `onboardingUrl`, botão de envio de arquivo com o `type` do grupo. Após a criação da subconta, esperar ~15 s antes da primeira consulta.

**N6. Rollback de `users_privacy` apaga as chaves (Médio).** `20261006020000_rollback…` faz `DROP TABLE partner_secrets` sem devolver as chaves para `users`. Se for usado, as chaves das subcontas se perdem (o Asaas só mostra a chave na criação).

→ O rollback precisa copiar as chaves de volta antes do `DROP`.

**N7. Migrations antigas editadas (Baixo).** Sete migrations já aplicadas foram alteradas, a maioria trocando `GRANT … advance_order_status` por `advance_order_status(uuid, text, text)` e incluindo `DROP FUNCTION get_driver_radar()`. Não muda o banco de produção (já rodaram), mas viola a regra 2 e faz o histórico deixar de bater com o que foi aplicado. Se o motivo foi fazer um banco novo subir do zero, registrar isso numa migration nova ou no `README`.

**N8. A cobrança de ativação saiu da criação de subconta (Baixo).** `subaccount/route.ts` deixou de conferir se a taxa foi paga. Com `activation_fee_enabled = true`, o parceiro abre a subconta sem pagar. Tudo bem se a taxa ficar desligada (recomendação do R15), mas a regra precisa estar num lugar só.

---

## 2. Itens do R15 ainda pendentes (que já existiam)

**Críticos e altos:**
- **0.2 Lista de pedidos:** `ORDER_SELECT_FIELDS` e o legado ainda pedem `seller_amount`, `driver_amount` e `total_delivery_fee`, colunas fora do GRANT da `20261002060000`. Se ela rodou, a lista vem vazia para todos.
- **0.3 Dados de usuários:**
  - a migration nova **não fez** o `REVOKE SELECT` + `GRANT` por coluna em `users`;
  - `fetchLojas` e `fetchAllUsers` continuam com `select('*')`;
  - CPF/CNPJ, chave Pix, renda, data de nascimento, e-mail e telefone dos parceiros podem continuar legíveis (depende da policy).
- **1.4 Saque:** `asaasTransferHelpers.ts` e `withdrawalApproval.ts` não mudaram:
  - o saque continua pagando chave Pix → CPF → **e-mail** antes da subconta;
  - a idempotência continua consultando o `attemptId` novo.

  O `pay-partner` (não lido) recebe do admin `pixKey`, `walletId` e `value`. **É preciso confirmar que ele ignora esses campos** e calcula tudo no servidor.
- **1.5 MFA:** `apiAuth.ts` não mudou; admin sem TOTP cadastrado passa.
- **2.1 Preço:** o checkout não mudou; o valor ainda vem do celular.
- **Renda ÷100:** `cadastro/page.tsx` não mudou; quem digita 2500 envia R$ 25 ao Asaas.
- **Valores inventados:** `subaccount/route.ts` ainda envia `'Centro'`, `'Belém'`, `'PA'` e `'S/N'` quando faltam dados (cl. 8.2.3).

**Médios:**
- 0.5 chamada `asaas-create-subaccount`;
- ordem do cadastro (subconta antes dos aceites; ativação sem token);
- `link-wallet` aberto a qualquer perfil;
- `PartnerActivationGuard` sem KYC;
- taxa de ativação no JSON de `asaas_platform_wallet_id`;
- relatório mensal (401, disponibilidade fixa);
- log de admin incompleto;
- fallback do aceite de corrida;
- radar com 3 casas decimais;
- cron exigindo `x-vercel-cron`;
- comprador com e-mail inventado.

**Baixos:** H5, M1 ("2 saques por dia"), tela de repasses, testes no CI, docs.

---

## 3. A conferir no banco (dono do produto)

```sql
-- 1) As migrations do R15 rodaram?
select to_regclass('public.partner_secrets') as secrets,
       exists(select 1 from information_schema.columns where table_name='users' and column_name='asaas_account_api_key') as coluna_antiga_ainda_existe,
       has_function_privilege('anon','public.check_delivery_pin(uuid,text,text)','execute') as anon_pin;
-- esperado: partner_secrets | false | false

-- 2) Quem consegue ler dados sensíveis de users
select grantee, column_name from information_schema.column_privileges
where table_name='users' and column_name in ('cpf_cnpj','pix_key','birth_date','monthly_income','email','telefone')
  and grantee in ('anon','authenticated');

-- 3) get_my_profile funciona (tipos das colunas)
select * from public.get_my_profile();  -- rodar logado pelo app ou simular com set_config
```

Na Vercel: conferir se `ASAAS_WEBHOOK_SECRET` existe (e **apagar** `NEXT_PUBLIC_ASAAS_WEBHOOK_SECRET`, se existir).

---

## O que fazer agora (ordem)

1. **N1** (constante de versão + modal de aceite) — sem isso o cadastro de parceiros está parado.
2. **N2, N3, N4** (webhook de conta correto, protegido e cadastrado na criação) + cron de reserva.
3. **0.2** (lista de pedidos) e **0.3** (`REVOKE` em `users`, fim do `select('*')`).
4. **1.4** (saque só para subconta aprovada; idempotência) e conferir o `pay-partner`.
5. **1.5** (MFA), renda ÷100, valores inventados, **2.1** (preço no servidor).
6. O restante do R15.

O `docs/18` continua valendo para os itens pendentes. Dá para mandar ao Antigravity só a lista acima, com a referência aos itens do `docs/18`.
