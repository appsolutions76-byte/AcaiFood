# Prompt — Correções R13: pendências pós-R12 (AçaíFood)

> Base: `docs/15_REAUDITORIA_POS_R12_2026-10-02.md`, `docs/13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md` e `docs/14_PROMPT_CORRECOES_R12.md`. Parte das correções já foi feita direto no código (seção "Já feito"). Cole no Antigravity a partir de "Contexto".

---

## Antes de colar: o que o dono do produto faz (ordem obrigatória)

1. **Supabase → SQL Editor:** rodar `supabase/migrations/20261002040000_r13_hotfix_pin_order_pins.sql`. Ela é compatível com o app que está no ar.
2. **Publicar o app** (commit + push dos arquivos alterados) e esperar o deploy da Vercel terminar sem erro.
3. **Testar** um pedido real pago: o cliente vê o PIN, o motoboy confirma a entrega, o pedido vira `RECEIVED`.
4. Só então rodar `supabase/migrations/20261002050000_r13_lock_order_pins_select.sql`.
5. Se algo der errado: os SQL de reversão estão em `supabase/rollback/` com o mesmo timestamp.

## Contexto

O AçaíFood está **no ar, com clientes e dinheiro real**. A Tomadora do contrato BaaS com o Asaas é a **Eletromecânica Baia Ltda** (CNPJ 42.035.623/0001-40). O R12 foi aplicado em parte. Este prompt fecha o que falta, sem refazer o que já está certo.

## Regras

1. O app não pode parar. Um deploy por item, testado antes no preview da Vercel com **Asaas sandbox** e **projeto Supabase de teste**. Verificado em produção logo depois.
2. Migration: backup/PITR antes; SQL de reversão completo em `supabase/rollback/`; aplicada em produção **antes** do código que depende dela.
3. Código em inglês, telas em PT-BR. Nenhum dado fixo de cadastro, segredo ou chave no código.
4. `settlements_enabled` e `auto_payout_enabled` continuam `false`. Não ligar.
5. Ao fim de cada item: o que mudou, como testou, resultado em produção e os testes negativos (SQL/curl). **Pare e espere aprovação.**
6. **Não reescreva os documentos** `docs/03` a `docs/16`: são histórico. Ao atualizar `01`, `02`, `04` e `README`, só descreva o que existe e funciona no código, com os CNPJs corretos.

## Já feito (não refazer; só conferir)

| Item | Onde |
|---|---|
| P1/P2: PIN só em `order_pins`; trigger que copia o PIN gravado em `orders` e limpa `orders.delivery_pin`/`pickup_pin`/`pin_hash`; `generate_*_pin` gravando em `order_pins`; backfill dos pedidos abertos | migration `20261002040000` |
| P2: todas as versões antigas de `check_delivery_pin`/`check_pickup_pin` removidas; versões seguras (só o motorista atribuído, recusa antes de contar tentativa); trigger de validação aceitando só a função segura, admin ou service_role | migration `20261002040000` |
| P3: leitura de PIN por `get_my_order_pins_bulk` (comprador: entrega; loja: retirada; motorista: nenhum); `SELECT` direto em `order_pins` revogado | migrations `20261002040000` e `20261002050000`; `useAppStore.ts` |
| App chama `check_*_pin` sem `p_operator_id` | `useAppStore.ts` |
| Checkout: PIN de entrega lido de `order_pins`; PIN de retirada não vai mais ao comprador; não sobrescreve CPF/CNPJ já cadastrado (K2) | `api/asaas/checkout/route.ts` |
| Repasse: colunas `settlements_enabled`/`activation_fee_enabled` em `platform_settings`; `attempts`, `last_error`, `transferred_at` e status `REVIEW`/`CANCELLED` em `settlements`; trigger só cria repasse com a flag ligada, marca `payout_*_done` (sem pagamento em dobro), não usa valor bruto (sem snapshot → `REVIEW`) e não repassa ao próprio comprador | migration `20261002040000` |
| K4/K5 (textos): "Taxa de ativação da plataforma AçaíFood" no cadastro e no `PartnerActivationGuard`; razão social completa do Asaas no selo, no cadastro e na política; política com Eletromecânica Baia como titular | `cadastro/page.tsx`, `PartnerActivationGuard.tsx`, `AsaasPartnerBadge.tsx`, `politica-de-privacidade/page.tsx` |
| `docs/01`: CNPJ da Tomadora corrigido; sem "custódia"; modelo de dinheiro atual descrito | `docs/01_OPERACAO_DO_APP.md` |

Testes já feitos num Postgres local com o mesmo esquema:
- a loja não lê o PIN de entrega e não confirma a entrega;
- outro motorista é recusado sem gastar tentativa;
- o motorista certo confirma;
- `generate_*_pin` é negado a usuários;
- com a flag desligada, nenhum repasse é criado.

**Repetir esses testes no projeto Supabase de teste.**

---

## Fase 1 — Banco e pedidos

**1.1 Radar e dados do cliente (P4; Anexo I, 6).**
- O app do motorista (motoboy e caminhão) passa a listar pedidos disponíveis por `get_driver_radar()`. Ajustar a função para devolver bairro de verdade (não `delivery_reference`, que pode ter endereço completo) e o tipo do pedido.
- Endereço completo, nome e telefone do cliente só para o motorista atribuído.
- Trocar a policy de SELECT de `orders`, que libera pedidos sem motorista para qualquer usuário logado: tirar o trecho `driver_id IS NULL AND status IN (...)`.
- `REVOKE SELECT ON public.orders FROM anon, authenticated;` + `GRANT SELECT (<lista explícita das colunas usadas pelo app>) ON public.orders TO authenticated;` sem `delivery_pin`, `pickup_pin`, `pin_hash`, `provided_pin`. Antes, trocar todo `select('*')` em `orders` no app pela lista de colunas.
- Teste negativo: motorista sem pedido atribuído não lê telefone nem endereço de nenhum pedido.

**1.2 Aceite de corrida e arquivamento.**
- `accept_order_atomic`:
  - remover `p_operator_id`;
  - aceitar só `READY`/`SEARCHING_OPERATOR`;
  - exigir veículo compatível (moto → B2C; caminhão → B2B e Coleta);
  - o app deixa de enviar `p_operator_id`.
- `advance_order_status('archive_driver')`: só admin, e só a partir de `RECEIVED`. Hoje o próprio motorista consegue levar `DELIVERED` (sem PIN) a `COMPLETED`, o que bloqueia o estorno do cliente.

**1.3 Rota de regenerar PIN.** Conferir `api/admin/orders/regenerate-pin`:
- só admin;
- usa `generate_delivery_pin` com service_role;
- **não** devolve o PIN na resposta;
- grava em `admin_audit_log`.

---

## Fase 2 — Contrato Asaas

**2.1 Tela de KYC (K1; cl. 8.2.3).** O servidor já exige os dados; falta a tela. No cadastro de parceiro e no `PartnerActivationGuard`, antes de criar a subconta, pedir e enviar a `/api/asaas/subaccount`:
- data de nascimento (CPF; maior de 18);
- renda/faturamento mensal;
- tipo de empresa (CNPJ: `MEI`, `LIMITED`, `INDIVIDUAL`, `ASSOCIATION`);
- CEP, número, bairro, telefone.

Corrigir também as chamadas em `useAppStore.ts` (~549, ~737, ~790, ~1192) e `admin/page.tsx` (~877), que chamam a rota sem esses dados e hoje recebem erro 400. Mensagens claras quando faltar dado.

Gerar no admin um CSV das subcontas criadas antes de 02/10 com data `1990-01-01`, renda `3000` ou `MEI` forçado, para regularizar com o Asaas.

**2.2 Aceites (K3; cl. 8.2.4).** A rota `/api/terms/accept` existe, mas ninguém a chama.
- **Cadastro do cliente:** aceite dos Termos e da Política AçaíFood, com menção e link aos Termos de Uso e à Política de Privacidade do Asaas.
- **Cadastro e ativação do parceiro:** checkboxes separados e obrigatórios para Termos AçaíFood, Termos e Política do **Asaas** (links oficiais), **mandato** ("autorizo a Eletromecânica Baia Ltda a solicitar a abertura e a movimentação da minha subconta Asaas para receber os repasses das minhas vendas/entregas") e **consentimento da chave Pix aleatória**. Cada aceite chama `/api/terms/accept` com a versão do texto.
- Textos versionados em `docs/legal/`.
- Usuário sem aceite da versão atual aceita no próximo login, antes de usar o app.
- `/api/asaas/subaccount` recusa criar subconta sem os aceites `asaas_terms`, `subaccount_mandate` e `pix_random_key_consent`.

**2.3 Taxa de ativação (K4; cl. 6.1).** Usar `platform_settings.activation_fee_enabled` (a coluna já existe) em `api/asaas/activation`, `PartnerActivationGuard` e cadastro. Com `false`, ativar o parceiro sem cobrança. Tela no admin para mudar a flag, gravando em `admin_audit_log`.

**2.4 Reclamações financeiras (K6; cl. 7.1).** Categoria "Pagamento, Pix ou repasse" no suporte (`SupportChatModal`, `AdminSupportSection`). Ao abrir chamado nessa categoria:
- informar ao usuário que os serviços financeiros são do Asaas e mostrar os canais oficiais;
- no admin, botão "Encaminhado ao Asaas" (data e protocolo);
- destaque quando aberto há mais de 24 h sem encaminhamento.

**2.5 Relatório mensal (K7; cl. 11).** Tela no admin, exportável (CSV/PDF):
- chamados abertos e fechados;
- reclamações procedentes (campo no fechamento);
- prazo médio da 1ª resposta e de solução;
- chamados financeiros encaminhados ao Asaas;
- disponibilidade (monitor externo em `/api/health`).

---

## Fase 3 — Saque e acesso

**3.1 Idempotência do saque (H2).** Em `lib/withdrawalApproval.ts`:
- trava condicional: `update … set status='PROCESSING', transfer_attempt_id=… where id=? and status in ('PENDENTE','FALHOU') returning`;
- enviar `externalReference = transfer_attempt_id` no `POST /transfers`;
- antes de reprocessar um `FALHOU`, consultar `GET /transfers` por essa referência;
- recusar `FALHOU` se algum pedido do saque estiver em outro saque aberto ou pago.
- `isAccountActive` exige `asaas_account_status = 'APPROVED'` e `asaas_wallet_id` (remover a aceitação por `pix_key`/`cpf_cnpj`).

**3.2 Log de admin (Anexo I, 7).** Gravar em `admin_audit_log` (quem, ação, alvo, antes/depois, IP, user agent):
- aprovar/rejeitar saque (`api/admin/withdrawals/[id]/*`);
- conciliar Pix (`reconcile-payment`);
- estorno feito pelo admin;
- mudar taxas/cidades/configurações/flags;
- bloquear/desbloquear e excluir usuário;
- regenerar PIN;
- `mark-done`.

**3.3 MFA para admin (Anexo I, 3).** Supabase Auth MFA (TOTP): o `/admin` exige cadastro e verificação do segundo fator; `authorizeRequest(['admin'])` recusa JWT sem `aal2`.

---

## Fase 4 — Repasse novo (continua desligado)

1. `api/settlements/process`:
   - aceitar só `asaas_account_status = 'APPROVED'` (remover `|| split_enabled === true`);
   - não marcar `DONE` na criação da transferência: marcar `PROCESSING` com `asaas_transfer_id` e deixar o webhook `TRANSFER_DONE` fechar `DONE` (conferir o trecho de `settlements` em `api/asaas/status`);
   - `REVIEW` nunca é processado automaticamente.
2. Tela no admin "Repasses": lista `settlements` por status, permite aprovar `REVIEW` (com valor recalculado pelo servidor) e cancelar, com `admin_audit_log`.
3. Cron na Vercel a cada 15 min para `/api/settlements/process` (`vercel.json`), autenticado por `Authorization: Bearer CRON_SECRET`.
4. **Coleta (R5):** em `api/asaas/checkout`, a coleta não pode usar o próprio comprador como `seller_storefront_id` (`storeTargetId = validBuyerId`). Definir o EcoPonto/Caçamba de destino como vendedor, ou nenhum vendedor quando o serviço é só o frete.
5. Ligar `settlements_enabled` **só** com a aprovação escrita do Asaas anexada em `docs/legal/` e depois de pagar/rejeitar todos os `withdrawal_requests` abertos. Nesse dia, esconder o botão de saque antigo e mostrar "Seus repasses".

---

## Fase 5 — Restante

1. **H5:** comprovante (`OrderReceiptModal`), impressora (`thermalPrinter`) e saldo leem o snapshot (`seller_payout_amount`, `driver_payout_amount`, `platform_fee_amount`, `delivery_fee_amount`).
2. **C8:** checkout recebe só `{product_id, quantity}` e o endereço/coordenadas; preço e distância calculados no servidor.
3. **M1:** remover "saque instantâneo", "2 saques por dia" e o contador em `localStorage` das telas de motoboy, caminhão, fornecedor e batedeira, dos manuais e dos PDFs em `apps/mobile/public/`.
4. **M5:** `supabase db diff` contra a produção → migrations oficiais; `.sql` soltos da raiz para `docs/historico/sql/`.
5. **Testes no CI** (contra o projeto Supabase de teste): os testes negativos de PIN, status e radar, matriz de `advance_order_status`, idempotência de saque e repasse, `pricingEngine`.
6. **`docs/seguranca/`:** processo de incidentes (comunicar o Asaas em até 24 h), registro de vulnerabilidades, backup/restauração testado, inventário de terceiros com acesso.
7. **Docs:** restaurar no `docs/README.md` o índice de todos os documentos (`01`–`16`) e a seção de limpeza; revisar `02` e `04` para descreverem só o que existe.

## Critério de aceite

- Os testes negativos passam no projeto de teste e em produção:
  - só o motorista atribuído confirma entrega;
  - só o comprador vê o PIN de entrega;
  - ninguém lê dados do cliente pelo radar;
  - ninguém além do servidor marca `PAID`.
- Parceiro novo consegue criar subconta com dados reais e aceites registrados; nenhum dado fixo vai ao Asaas.
- Nenhuma tela atribui ao Asaas uma taxa da plataforma; a taxa de ativação respeita a flag.
- Saque só para subconta aprovada, sem duplicidade; ações de admin no `admin_audit_log`; admin com MFA.
- Repasse novo pronto, mas desligado, até a aprovação do Asaas.
