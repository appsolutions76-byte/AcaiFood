# Prompt — Correções R15: segurança, fluxo financeiro e contrato Asaas (AçaíFood)

> Base: `docs/17_AUDITORIA_POS_R13_R14_2026-10-06.md` (achados) e `docs/13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md` (contrato).
> **Versão 2 (06/10):** o app está no ar, mas **ainda sem operação real**. As correções são feitas direto, sem modo de transição. Esta versão também cobre o cadastro e os documentos das subcontas Asaas (Fase 1, item 1.2).
> Cole no Antigravity a partir de "Contexto". A migration de PIN já vem pronta e testada (anexo A).

---

## Antes de colar: o que o dono do produto faz

1. **Supabase:** confirmar o backup/PITR. Criar um **projeto Supabase de teste** (se ainda não existir) e apontar os previews da Vercel para ele e para o **Asaas sandbox**.
2. **Supabase → SQL Editor (produção):** rodar `supabase/migrations/20261006010000_r15_pin_hardening.sql` (anexo A).
3. **Verificar se a chave das subcontas está exposta:**

   ```sql
   select grantee, privilege_type from information_schema.column_privileges
   where table_schema='public' and table_name='users' and column_name='asaas_account_api_key';
   select polname, polcmd, pg_get_expr(polqual, polrelid) from pg_policy
   where polrelid = 'public.users'::regclass;
   ```

   - Se `anon`/`authenticated` tiver `SELECT` e já existirem **subcontas reais em produção** (mesmo de teste), pedir ao Asaas a rotação dessas chaves.
   - Se houve algum uso de terceiros, comunicar a prevencao@asaas.com.br em até 24 h (cl. 8.2.1; Anexo I, 8).
4. **Levantar as subcontas já criadas em produção:**

   ```sql
   select id, name, role, cpf_cnpj, asaas_account_id, asaas_wallet_id, asaas_account_status, birth_date, monthly_income, company_type, created_at
   from users where asaas_account_id is not null order by created_at;
   ```

   - As criadas antes de 02/10 foram com data de nascimento, renda ou tipo de empresa **fixos**.
   - As criadas depois, com renda dividida por 100 (item 1.2 g).
   - Enviar a lista ao Asaas e combinar a correção (atualizar os dados ou encerrar as subcontas de teste).
5. **Painel Asaas:** ativar **IP autorizado** (saída da Vercel) ou **token para transferências** (Anexo I, 4.1 e). Ativar MFA nas contas Asaas, Supabase, Vercel e GitHub.
6. **Enviar ao Asaas, por escrito**, as perguntas 1 a 3 do `docs/13` (modelo do dinheiro, taxa de ativação, tarifa Pix). Perguntar também como fica o **período de avaliação regulatória** da conta BaaS (ver "Lançamento"). Guardar as respostas em `docs/legal/`.

## Contexto

O AçaíFood está **no ar, mas ainda sem clientes nem dinheiro real**. Isso permite corrigir sem modo de compatibilidade nem transição, mas tudo precisa estar certo **antes** da abertura.

A Tomadora do contrato BaaS com o Asaas é a **Eletromecânica Baia Ltda** (CNPJ 42.035.623/0001-40). A Asaas Gestão Financeira Instituição de Pagamento S.A. presta os serviços financeiros.

A auditoria `docs/17` mostrou:
- brechas graves introduzidas em 03 e 04/10 (PIN, saque, dados de usuários);
- partes do contrato ainda não atendidas;
- o fluxo de documentos da subconta inexistente: nada leva a subconta até `APPROVED`.

## Regras

1. **Deploy por fase**, testado antes no preview da Vercel com **Asaas sandbox** e **projeto Supabase de teste**, e verificado em produção logo depois. Como não há operação, a migration e o app da mesma fase podem ir juntos, numa janela de manutenção.
2. **Migration:** backup antes; SQL de reversão em `supabase/rollback/`. **Nunca editar migration já aplicada:** corrigir com uma nova.
3. **É proibido:**
   - PIN fixo, PIN mestre ou "aceitar se não houver PIN";
   - `GRANT` para `anon` em função que muda pedido ou dinheiro;
   - "fallback" que grava direto em `orders`, `withdrawal_requests` ou `users` quando uma RPC falha (erro = mensagem ao usuário);
   - segredo, chave ou **dado fixo de cadastro** no código (inclusive "Centro", "Belém", "PA", "S/N" como valor padrão enviado ao Asaas);
   - valor de dinheiro calculado no navegador e aceito pelo servidor;
   - URL do Asaas fixa no código (usar `getAsaasBaseUrl`).
4. `settlements_enabled` e `auto_payout_enabled` continuam `false`. Não ligar.
5. Código em inglês, telas em PT-BR.
6. **Não reescrever** `docs/03` a `docs/18`: são histórico.
7. Ao fim de cada item, informar:
   - o que mudou;
   - como testou (incluindo os testes negativos em SQL/curl);
   - o resultado.

   **Pare e espere aprovação.**

---

## Fase 0 — Segurança (primeiro)

**0.1 PIN (Anexo I, 3 e 6).**
- O dono roda a migration do anexo A.
- No app:
  - `batedeira/page.tsx` (~713) e `fornecedor/page.tsx` (~464): remover o PIN calculado (`deliveryPin * 7 + 1337`) e os padrões `'4821'`/`'9354'`. Mostrar só `o.pickupPin`; sem PIN, "PIN indisponível — fale com o suporte".
  - `useAppStore.ts` (`validar_pin_retirada`, `validar_pin`, `aceitar_motorista`): **remover os fallbacks** que fazem `update` direto em `orders`. Erro da RPC = `alert` com a mensagem.
  - `api/admin/orders/regenerate-pin`:
    - só admin (com MFA);
    - usa `generate_*_pin` via service_role;
    - **não devolve o PIN**;
    - grava em `admin_audit_log`;
    - zera tentativas e tira de `PIN_LOCKED` para `DELIVERING`.
- Teste: os 12 testes do anexo A no projeto de teste e, em produção, os testes 1, 2 e 4 (curl com a chave anon).

**0.2 Lista de pedidos.** Em `useAppStore.ts` (`ORDER_SELECT_FIELDS` e `ORDER_SELECT_FIELDS_LEGACY`):
- tirar `seller_amount`, `driver_amount` e `total_delivery_fee` e usar `seller_payout_amount`, `driver_payout_amount` e `delivery_fee_amount`;
- toda leitura de `orders` pelo navegador usa só colunas do `GRANT` da migration `20261002060000`;
- apagar o `ORDER_SELECT_FIELDS_LEGACY` se não for mais necessário;
- teste: cliente, loja, batedeira, fornecedor, motoboy e admin veem seus pedidos.

**0.3 Dados de usuários e chave das subcontas (Anexo I, 4.1 e 6; LGPD).**
- App:
  - trocar todo `from('users').select('*'…)` do navegador (`fetchLojas`, `fetchAllUsers`, `linkAsaasAccount`, login) por lista de colunas;
  - vitrine e lojas: só `id, name, role, bairro, cidade, latitude, longitude, status, is_online, icon` + `storefronts(...)`/`products(...)`;
  - o próprio usuário lê o seu perfil por uma RPC `get_my_profile()` (`SECURITY DEFINER`, `WHERE id = auth.uid()`), **sem** chave de API;
  - o admin lê usuários por `/api/admin/users` (service_role, MFA).
- Migration `20261006020000_r15_users_privacy.sql`:
  - `REVOKE SELECT ON public.users FROM anon, authenticated;` + `GRANT SELECT (<colunas públicas>) … TO anon, authenticated;`
  - tabela `public.partner_secrets (user_id uuid primary key references users on delete cascade, asaas_account_api_key text not null, updated_at timestamptz default now())`, com RLS ligado, sem policy para usuários e só service_role;
  - copiar as chaves e **apagar a coluna** `users.asaas_account_api_key`.
- `subaccount/route.ts` e `documents/route.ts` passam a ler e gravar em `partner_secrets`.
- Teste negativo: com a chave anon e com um cliente logado, `GET /rest/v1/users?select=cpf_cnpj,pix_key,birth_date,monthly_income` → erro de permissão.

**0.4 Fechar o envio livre de dinheiro (cl. 6.4; Anexo I, 4.1).**
- `api/asaas/transfer` → **410** ("Use a aprovação de saque").
- No `admin/page.tsx` (~388 "Pagar" e ~474 "Pagar todos"), usar uma rota nova `POST /api/admin/payout/pay-partner { partnerId }`. Ela:
  - calcula o saldo **no servidor** (`getPartnerAvailableBalance`);
  - cria o `withdrawal_request` com `order_ids`;
  - chama `processWithdrawalApproval` (regras do item 1.4);
  - grava em `admin_audit_log`.

**0.5 Função antiga de subconta.**
- Remover a chamada `supabase.functions.invoke('asaas-create-subaccount')` de `useAppStore.ts`.
- O dono confere em Supabase → Edge Functions se ela existe e a apaga.

---

## Fase 1 — Contrato Asaas BaaS e cadastro

| Item | Cláusula | O que o contrato exige |
|---|---|---|
| 1.1 | 8.2.4 | Aceite registrado dos Termos e da Política do Asaas; mandato; consentimento da chave Pix aleatória |
| 1.2 | 8.2.3, 13.5 | Dados de cadastro verdadeiros; a Tomadora responde pela veracidade |
| 1.3 | 6.1, 3.3 | Não cobrar do cliente final por serviço financeiro; nada que atribua ao Asaas uma taxa da plataforma |
| 1.4 | 2.1, 6.3, 6.4 | Movimentação entre Contas Asaas; a Tomadora não intermedeia recursos em nome próprio |
| 1.5 | Anexo I, 3 | MFA e menor privilégio |
| 1.6 | Anexo I, 7 | Log de operações e mudanças críticas |
| 1.7 | 7.1, 11 | Reclamações encaminhadas ao Asaas; relatório mensal com indicadores reais |
| 1.8 | Anexo I, 6 e 7 | Sem dado pessoal em log |

**1.1 Aceites (cl. 8.2.4).**
- **Ordem no cadastro do parceiro:**
  1. criar o usuário;
  2. `/api/terms/accept` **com `Authorization`**, esperando sucesso (se falhar, mostrar erro e permitir repetir);
  3. criar a subconta (item 1.2);
  4. ativação (`/api/asaas/activation` **com token**; hoje vai sem e recebe 401).

  Tirar a criação de subconta de dentro de `registerUser`: hoje ela roda antes dos aceites e recebe 400.
- **Versões:**
  - `docs/legal/VERSOES.json` (ex.: `{"acaifood_terms":"2026-10-06", …}`), espelhado numa constante do servidor;
  - `/api/terms/accept` grava a versão do servidor, não a do navegador.
- **Aceite pendente:**
  - no login, `GET /api/terms/status` diz o que falta na versão atual;
  - um modal bloqueia o uso até aceitar (cliente: 4 documentos; parceiro: os 6).
- `/api/asaas/subaccount` recusa sem `asaas_terms`, `subaccount_mandate` e `pix_random_key_consent` **na versão atual** (hoje aceita qualquer versão).

**1.2 Cadastro e documentos da subconta Asaas (cl. 8.2.3).** Hoje a subconta é criada, mas:
- nenhuma tela pede os documentos;
- a rota de documentos está quebrada;
- nada atualiza o status para `APPROVED`;
- portanto nenhum parceiro consegue receber.

Referência: docs.asaas.com, "Criação de subcontas com o BaaS", "Detalhamento do fluxo de aprovação de subcontas", "Onboarding e envio de documentos via link" e "Enviar documentos".

a) **Criação (`/api/asaas/subaccount`):**
- **`incomeValue` obrigatório para CPF e CNPJ** (exigência do Asaas desde 30/05/2024). Hoje só o CPF envia; o cadastro com CNPJ coleta "Faturamento mensal", mas o servidor descarta. Validar e enviar nos dois casos.
- `mobilePhone` obrigatório e válido (celular com DDD).
- **Sem valores inventados:** remover os padrões `'Centro'`, `'Belém'`, `'PA'` e `'S/N'`. Se faltar endereço, número, bairro, cidade ou UF, devolver 400 com a lista do que falta. Usar a UF real (o formulário precisa pedir).
- E-mail: usar o do usuário; se o Asaas recusar por e-mail já usado, mostrar a mensagem.
- Buscar subconta existente por CPF/CNPJ só com `GET /accounts?cpfCnpj=` **da própria conta raiz**. Ao achar, **não** reaproveitar sem `apiKey`: marcar `asaas_account_status = 'NEEDS_ADMIN'` e avisar o admin (a `apiKey` só vem na criação).
- Gravar a `apiKey` em `partner_secrets` (0.3) **na hora**.
- **Webhooks da subconta:** enviar no `POST /accounts` o array `webhooks` apontando para a rota nova `/api/asaas/account-webhook?wh_token=…`, com os eventos de situação da conta (`ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`, `…_REJECTED`, `…_PENDING`, e os de documentos, dados comerciais e conta bancária, conforme a documentação atual).
- Status inicial no banco: `PENDING_DOCUMENTS`.

b) **Rota `/api/asaas/documents` (corrigir):**
- usar `getAsaasBaseUrl(...)` (hoje está fixo `https://www.asaas.com/api/v3`, o que quebra o sandbox);
- **esperar ~15 s depois da criação** antes da primeira consulta (recomendação do Asaas); na tela, "Preparando sua conta…" com nova tentativa;
- `GET /myAccount/documents` com a `apiKey` da subconta → devolver à tela os grupos pendentes, cada um com `id`, tipo, status e `onboardingUrl`;
- **se o grupo tiver `onboardingUrl`**, o envio é **só pelo link do Asaas** (documento com foto e selfie): abrir em nova aba ou navegador externo, nunca por upload próprio;
- **sem `onboardingUrl`**, upload por `POST /myAccount/documents/{id}` em multipart com os campos **`documentFile`** (arquivo) e **`type`** (`IDENTIFICATION`, `IDENTIFICATION_SELFIE`, `MEI_CERTIFICATE`, `SOCIAL_CONTRACT`, `ENTREPRENEUR_REQUIREMENT`, `POWER_OF_ATTORNEY`, `CUSTOM`…). Hoje o código manda o campo `file` e não manda `type`, então o envio falha;
- limitar o tamanho e os tipos do arquivo (PDF, JPG, PNG) antes de repassar.

c) **Status da conta:**
- rota nova `/api/asaas/account-webhook`:
  - valida o token (`isValidAsaasWebhook`);
  - acha o usuário por `asaas_account_id`/`walletId`;
  - grava `asaas_account_status` (`APPROVED`, `REJECTED`, `PENDING_DOCUMENTS`, `AWAITING_APPROVAL`) e o detalhe por etapa em `asaas_account_status_detail jsonb`;
  - registra em `incident_logs` ou numa tabela `partner_kyc_events`;
- **reserva:** um cron diário consulta `GET /myAccount/status` de cada subconta não aprovada. Aprovada = `general === 'APPROVED'`;
- `split_enabled = true` só quando `APPROVED`.

d) **Tela "Minha conta Asaas"** no painel do parceiro (`PartnerDashboardLayout`, para loja, batedeira, fornecedor, motoboy e caminhão), com as etapas:

  > Cadastro enviado → Documentos → Em análise → Aprovada / Recusada (com motivo)

  - lista dos documentos pendentes, com botão "Enviar pelo Asaas" (`onboardingUrl`) ou "Enviar arquivo";
  - texto: "Sua conta de pagamento é aberta e mantida pelo Asaas Gestão Financeira Instituição de Pagamento S.A. A análise pode levar até 48 horas.";
  - aviso permanente até `APPROVED`: "Você só recebe repasses depois que sua conta Asaas for aprovada".

e) **`PartnerActivationGuard`:** se faltar algum dado de KYC (data de nascimento para CPF; renda/faturamento; tipo de empresa para CNPJ; CEP, endereço, número, bairro, cidade, UF, celular), pedir na hora, gravar pelo servidor e então criar a subconta.

f) **`link-wallet`:**
- só admin;
- só aceita `walletId` encontrado em `GET /accounts` da conta raiz **com o mesmo CPF/CNPJ** do usuário;
- caso contrário, 400 (hoje grava qualquer walletId, até para cliente).

g) **Renda dividida por 100 (bug):** o cadastro calcula `Number(apenas_dígitos)/100`. O campo é `type="number"` com exemplo "2500", então quem digita 2500 envia **R$ 25** ao Asaas. Usar `Number(valor)` direto, mínimo R$ 100, e mostrar o valor formatado antes de enviar.

h) **Admin:**
- lista "Subcontas Asaas" com status, documentos pendentes e data;
- botão "Reconsultar status";
- CSV das subcontas antigas (o mesmo do item 1.7, com o download corrigido).

**Teste no sandbox:**
1. Parceiro CPF novo: aceites → subconta com dados reais → documentos via `onboardingUrl` → aprovação (no sandbox, aprovar pelo painel) → webhook → `APPROVED` na tela.
2. Parceiro CNPJ com `incomeValue`.
3. Negativos:
   - sem aceites → 400;
   - sem CEP/UF → 400;
   - `link-wallet` com walletId de outra pessoa → 400.

**1.3 Taxa de ativação (cl. 6.1).**
- `api/admin/activation-config` grava em `platform_settings.activation_fee_enabled` e numa coluna `activation_fee_amount`, com `admin_audit_log`.
- Tirar o JSON de dentro de `asaas_platform_wallet_id`: migrar taxa, cota e WhatsApp do suporte para `platform_config (key text primary key, value jsonb)`; `founderQuota.ts` e `api/support` leem dali.
- **Até o Asaas responder a pergunta 2 do `docs/13`, deixar `activation_fee_enabled = false`** (ativação gratuita).
- Texto: "Taxa de ativação da plataforma AçaíFood", sem citar o Asaas.

**1.4 Saque (cl. 2.1, 6.3, 6.4).** Em `asaasTransferHelpers.ts` e `withdrawalApproval.ts`:
- **Só subconta:** transferir por `walletId` quando `asaas_account_status = 'APPROVED'`. Remover os ramos de chave Pix, CPF/CNPJ, e-mail e telefone. Sem subconta aprovada → `FALHOU`: "Sua conta Asaas ainda não foi aprovada".
- Nas telas de saque (motoboy, caminhão, fornecedor, batedeira, `PartnerWithdrawalSection`):
  - o botão só aparece com conta aprovada;
  - antes disso, mostrar o link para "Minha conta Asaas".
- **Idempotência (H2):**
  - ler o `transfer_attempt_id` anterior **antes** da trava e consultar `GET /transfers?externalReference=<anterior>`; se existir, usar o resultado;
  - timeout ou erro de rede → `PROCESSING` com `last_error`, não `FALHOU`; o webhook `TRANSFER_*` ou a reconsulta fecha;
  - `FALHOU` só com erro de negócio do Asaas (4xx com `errors`).
- Recusar se algum pedido do saque estiver em outro saque `PENDENTE`, `PROCESSING` ou `PAGO`.
- Teste no sandbox:
  - saque com subconta aprovada → `walletId`;
  - sem aprovação → `FALHOU`;
  - timeout simulado → `PROCESSING`; reprocessar não duplica.

**1.5 MFA do admin (Anexo I, 3).**
- `apiAuth.ts`: rota de admin exige `aal.currentLevel === 'aal2'` sempre; erro na checagem = recusa. Exceções só para `internal_secret`/`cron_secret`.
- `AdminMfaGuard`: em erro, bloquear.
- O dono cadastra o TOTP antes do deploy.
- Teste: token de admin `aal1` → 401 em `/api/admin/*`, `/api/asaas/refund`, `/api/admin/reconcile-payment`.

**1.6 Log de admin (Anexo I, 7).** `logAdminAction` (quem, ação, alvo, antes/depois, IP, user agent) em:
- `pay-partner` e aprovar/rejeitar saque;
- `reconcile-payment` e `asaas/refund`;
- `activation-config` e `payout-settings`;
- `delete-user`, `user/status` (bloqueio pelo admin) e `link-wallet`;
- `clear-data` e `reset-balances`;
- `regenerate-pin` e `mark-done`.

Também: `admin_audit_log` só aceita `INSERT` (sem `UPDATE`/`DELETE`), e uma tela "Log de auditoria" só de leitura.

**1.7 Suporte e relatório mensal (cl. 7.1 e 11).**
- Botões "Relatório mensal" e "CSV KYC legado": trocar `window.open(...?token=)` por `fetch` com header e download por `Blob`. Nunca pôr token na URL.
- **Disponibilidade:**
  - remover o `'99.98%'` fixo;
  - o dono cadastra um monitor externo (ex.: UptimeRobot em `/api/health`) e informa o percentual mensal no admin (`monthly_sla`);
  - sem valor, "não medido".
- No fechamento do chamado: "Reclamação procedente? Sim/Não" (`is_merited`, `resolved_at`).
- Chamado financeiro: canais oficiais do Asaas lidos da configuração.

**1.8 Logs sem dados pessoais (Anexo I, 6 e 7).** Em `api/asaas/status`, `account-webhook`, `checkout`, `subaccount`, `documents` e `withdrawalApproval`:
- nada de CPF/CNPJ, nome, e-mail, telefone, chave Pix, arquivo ou corpo inteiro do webhook no `console.log`;
- só ids, evento e status.

---

## Fase 2 — Operação e financeiro

**2.1 Preço calculado no servidor (C8).** `api/asaas/checkout`:
- recebe só `{ items: [{ product_id, quantity }], storefrontId, orderType, deliveryInfo: { address, number, bairro, lat, lng, reference } }`;
- preço buscado no banco (`products` ou `price_b2c_*`/`price_b2b` da vitrine); produto inexistente, inativo ou de outra loja → 400;
- distância calculada no servidor (coordenadas da loja e do destino, mesma regra do `pricingEngine`);
- ignorar qualquer valor vindo do app;
- `order_items` com o preço do banco;
- o app passa a mandar só esse formato (sem compatibilidade com o antigo);
- teste: mandar `productsSubtotal: 0.01` ou `price: 0.01` → cobrança com o preço real.

**2.2 Comprador no Asaas.** No checkout:
- o cliente (pagador) é criado no Asaas com o e-mail e o CPF reais do cadastro;
- remover o e-mail inventado `cliente_<id>@acaifood.app.br`;
- se faltar CPF, pedir na tela antes do Pix.

**2.3 Radar.** `get_driver_radar()` com `approx_lat/lng` em **2 casas** (~1 km). Nova migration.

**2.4 Cron.** `isAuthorizedRequest`: aceitar o cron só com `Authorization: Bearer ${CRON_SECRET}` (sem exigir `x-vercel-cron`). Incluir o cron diário de reconsulta de subcontas (1.2 c).

**2.5 Tela "Repasses" no admin** (repasse novo, desligado):
- lista `settlements` por status;
- aprovar `REVIEW` com valor do servidor;
- cancelar;
- tudo com log.

**2.6 H5 e M1.**
- Comprovante, impressora e saldo leem `*_payout_amount`, `platform_fee_amount` e `delivery_fee_amount`.
- Remover "2 saques por dia", "transferir instantaneamente" e o contador em `localStorage`. Texto novo: "Seu saque é analisado e pago na sua subconta Asaas".

**2.7 Testes no CI** (projeto Supabase de teste e Asaas sandbox; segredos no GitHub Actions):
- os 12 testes do anexo A;
- radar;
- matriz de `advance_order_status`;
- saque (só walletId aprovado, idempotência);
- `users` sem colunas sensíveis;
- checkout com preço adulterado;
- criação de subconta sem aceites ou sem dados;
- `pricingEngine`.

O CI falha se algum teste falhar.

**2.8 Docs.**
- Atualizar `01`, `02`, `04` e `README` (índice `01`–`18`) só com o que existe e funciona; o `04` ganha "Como abrir sua conta Asaas" para parceiros.
- `docs/seguranca/REGISTRO_DE_VULNERABILIDADES.md`: registrar a brecha de PIN de 03/10 e a de `users`.

---

## Lançamento (antes de abrir para clientes reais)

1. **Limpar dados de teste** em produção: pedidos, saques, settlements, chamados e usuários de teste. Fazer por SQL com backup antes; não usar `clear-data` sem log.
2. **Período de avaliação regulatória do BaaS** (documentação do Asaas): no início, em produção, valem **no máximo 10 subcontas** e **R$ 2.000 em cobranças por subconta**, por até **60 dias**. Ao atingir um limite, o Asaas bloqueia novas subcontas e cobranças.
   - Confirmar com o Asaas em que fase a conta está.
   - Abrir com poucos parceiros (piloto).
   - Mostrar ao admin quantas subcontas existem e quanto cada uma já cobrou.
3. **Ensaio completo em produção com valores pequenos** (com a equipe):
   1. parceiro se cadastra e aceita;
   2. envia os documentos e tem a subconta aprovada;
   3. cliente paga o Pix;
   4. loja prepara;
   5. motoboy aceita, retira com PIN e entrega com PIN → `RECEIVED`;
   6. saque para a subconta → `PAGO`;
   7. estorno de um pedido cancelado.
4. Monitor externo de `/api/health` ligado; processo de incidentes (`docs/seguranca`) com responsável e contato do Asaas.

## Critério de aceite

- **Fluxo completo do item 3 do Lançamento** funcionando em produção.
- **PIN:**
  - sem login não se chama função de PIN;
  - não existe PIN mestre;
  - pedido sem PIN não é confirmado;
  - outro motorista é recusado sem gastar tentativa;
  - ninguém grava `RECEIVED` direto.
- **Dados:** visitante ou cliente não lê CPF, chave Pix, renda, data de nascimento nem chave de API de outros.
- **Dinheiro:**
  - valor cobrado calculado no servidor;
  - saque só para subconta `APPROVED`, sem duplicidade;
  - `/api/asaas/transfer` desativada;
  - toda ação de admin com MFA e log.
- **Contrato:**
  - aceites com versão antes da subconta;
  - KYC real (sem valores inventados, renda correta, `incomeValue` também para CNPJ);
  - documentos pelo fluxo do Asaas;
  - status atualizado por webhook;
  - taxa de ativação desligada até a resposta do Asaas;
  - reclamações financeiras encaminháveis;
  - relatório mensal com números reais.

---

## Anexo A — Migration de PIN (pronta)

Arquivos: `supabase/migrations/20261006010000_r15_pin_hardening.sql` e `supabase/rollback/20261006010000_rollback_r15_pin_hardening.sql`.

O rollback **não** volta a versão de 03/10 (a falha): só desliga a trava do trigger.

**Testes feitos num Postgres 16 local** com o estado de 03/10 + esta migration:

| # | Teste | Resultado |
|---|---|---|
| 1 | Sem login, retirada com `4821` | recusado (sem permissão) |
| 2 | Sem login, entrega com `0000` | recusado |
| 3 | Sem login, ler PINs | recusado |
| 4 | Outro motorista, entrega | recusado, sem gastar tentativa |
| 5 | Motorista certo, retirada com `4821` | "PIN incorreto, tentativa 1 de 5" |
| 6 | Comprador lê PINs | só o de entrega |
| 6b | Loja lê PINs | só o de retirada |
| 6c | Motorista lê PINs | nenhum |
| 7 | Motorista certo, PIN errado e depois certo | erro, depois `RECEIVED` |
| 8 | Motorista faz `UPDATE` direto para `RECEIVED` | bloqueado pelo trigger |
| 9 | Admin força `RECEIVED` | permitido |
| 10 | `anon` tem `EXECUTE` | não |
| 11 | Retirada com o PIN real | `DELIVERING` |
| 12 | Entrega com o PIN real | `RECEIVED` |

O backfill gerou PIN de entrega e de retirada para os pedidos abertos que estavam sem.

Repetir no projeto de teste. Conferir que o trigger de repasse (`trg_create_order_settlements`) continua funcionando (com a flag desligada, não cria repasse).
