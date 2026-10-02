# Prompt — Correções R12 (consolidado): auditoria pós-R11 + contrato Asaas BaaS

> Prompt único com **tudo** que está aberto: a auditoria `docs/12_AUDITORIA_POS_R11_2026-10-02.md` e a conformidade com o contrato BaaS em `docs/13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md`. Cada item traz o problema e a correção, para o agente não depender de outro documento. Cole no Antigravity a partir de "Contexto".

---

## Contexto

O AçaíFood está **no ar, com clientes e dinheiro real**. A **Eletromecânica Baia Ltda** (CNPJ 42.035.623/0001-40) é a Tomadora num contrato de Banking as a Service com o **Asaas Gestão Financeira Instituição de Pagamento S.A.** (CNPJ 19.540.550/0001-21). O contrato exige:

- dados de cadastro (KYC) verdadeiros (cl. 8.2.3);
- marca Asaas clara e nada que confunda o papel do Asaas (cl. 3);
- nenhuma cobrança do cliente final por serviço financeiro (cl. 6.1);
- registro de aceite dos Termos do Asaas, mandato para abrir e movimentar subcontas e consentimento da chave Pix aleatória (cl. 8.2.4);
- reclamações financeiras encaminhadas ao Asaas (cl. 7.1) e relatório mensal de atendimento (cl. 11);
- os controles de segurança do Anexo I: MFA, chaves de API, ambientes separados, logs, incidentes, backup, desenvolvimento seguro.

O descumprimento gera multa de R$ 20 mil a R$ 500 mil por infração, além de rescisão.

A auditoria pós-R11 encontrou:
- qualquer usuário gera um PIN válido e confirma a entrega de qualquer pedido;
- a RPC antiga de status marca pedido como pago sem pagamento;
- o PIN continua visível para quem não é o comprador;
- o repasse novo (`settlements`) não bate com a tabela e, se funcionasse, pagaria em dobro junto com o saque antigo.

## Regras (obrigatórias)

1. **O app não pode parar.** Um deploy por item, testado antes no preview da Vercel com **Asaas sandbox** e um **projeto Supabase de teste** (Anexo I, item 5: proibido usar chave ou credencial de produção fora de produção). Verificar em produção logo depois com um pedido real de valor baixo.
2. **Migrations:** backup/PITR confirmado antes de cada uma. O SQL de reversão em `supabase/rollback/` restaura **tudo** o que foi mudado (funções, policies, grants, colunas). A migration fica **aplicada em produção antes** do deploy do código que depende dela.
3. **Ordem do banco:** primeiro o app deixa de depender da permissão antiga; depois a migration remove a permissão.
4. Código em inglês, telas em PT-BR. Nenhum segredo, CPF, data, renda ou valor de cadastro fixo no código.
5. **Feature flags** em `platform_settings` (só service_role altera): `settlements_enabled` (padrão **false**), `auto_payout_enabled` (padrão **false**), `activation_fee_enabled`. Nada de dinheiro novo é ligado sem o dono do produto mudar a flag.
6. Ao fim de cada item, informar: o que mudou, como testou, o resultado em produção e o **SQL/curl dos testes negativos**. **Pare e espere aprovação antes do próximo item.**
7. Não refatore o que não está listado. Os arquivos grandes (`admin/page.tsx`, `batedeira/page.tsx`, `useAppStore.ts`) só mudam nos trechos indicados.

## Mapa dos achados

| Código | Problema | Item |
|---|---|---|
| R3 | Qualquer usuário gera PIN e confirma entrega | 1.1 |
| A7 | `transition_order_status` sem validação, executável por todos | 1.2 |
| H4/1.6 | App grava `PAID` (PixModal faz o pedido voltar a `PAID`) | 1.3 |
| R6 | Baixa forçada aceita pedido cancelado/estornado | 1.4 |
| A9/H7 | PIN, telefone e endereço visíveis para terceiros | 1.5 |
| K1 | KYC com data de nascimento, renda e tipo de empresa fixos | 2.1 |
| K2 | CPF/CNPJ editável depois da subconta | 2.2 |
| K3 | Sem registro de aceite, mandato e consentimento da chave Pix | 2.3 |
| K4 | "Taxa Única de Homologação Asaas" cobrada dos parceiros | 2.4 |
| K5 | Política de privacidade com empresa errada | 2.5 |
| K6 | Reclamações financeiras não vão ao Asaas | 2.6 |
| K7 | Sem indicadores mensais de atendimento | 2.7 |
| K8 | Dados pessoais no log do webhook | 2.8 |
| C6 / cl. 6.4 | Saque para chave Pix digitada (dinheiro sai das Contas Asaas) | 3.1 |
| H2 | Saque sem idempotência | 3.2 |
| Anexo I 4/7/3 | Chave lida do banco, rota legada, sem log de admin, admin sem MFA, rotas destrutivas | 3.3–3.6 |
| R1, R2, R4, R5, R7 | Repasse novo quebrado, duplicado com o saque, valor bruto sem snapshot, coleta repassando ao comprador, ordem de deploy | 4.1–4.6 |
| H5, C8, M1, M5 | Valores recalculados, preço do celular, textos enganosos, banco sem versionamento | 5.1–5.6 |

---

## Fase 0 — Painéis (dono do produto, sem código)

1. **Supabase → SQL Editor:** listar migrations aplicadas e privilégios de `EXECUTE` em `generate_delivery_pin`, `generate_pickup_pin`, `check_delivery_pin`, `check_pickup_pin`, `transition_order_status`, `accept_order_atomic`, `advance_order_status` (`information_schema.routine_privileges`). Entregar ao agente.
2. **Asaas:** ativar **IP autorizado** ou **token de autorização para transferências** (Anexo I, 4.1 e: obrigatório). Se usar IP fixo, informar ao agente de qual servidor as transferências vão sair.
3. **MFA** em Asaas, Supabase, Vercel e GitHub. Confirmar PITR do Supabase e anotar RPO/RTO.
4. **Chave de API:** se a chave exposta em setembro não foi revogada, gerar uma nova, trocar na Vercel, revogar a antiga e comunicar a prevencao@asaas.com.br (Anexo I, 4.2 e 8.2: em até 24 h).
5. **Comunicar o Asaas** (cl. 8.2.1) sobre as falhas de segurança corrigidas desde 23/09 e qualquer indício de uso indevido, e enviar as perguntas da seção "Perguntas para enviar ao Asaas" do `docs/13`. A resposta à pergunta 1 (modelo do dinheiro) decide o item 4.6.
6. **Suspender a criação de subcontas** pelo app até o item 2.1 estar em produção (flag ou aviso na tela de cadastro de parceiro).

---

## Fase 1 — Banco: entrega, status e PIN

**1.1 PIN não pode ser gerado nem testado por terceiros (R3).**
- Migration: `REVOKE EXECUTE ON FUNCTION public.generate_delivery_pin(uuid), public.generate_pickup_pin(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role;`.
- O botão de admin que gera PIN novo (`admin/page.tsx`, ~linha 2382) passa a chamar uma rota de servidor `/api/admin/orders/regenerate-pin` (só admin, com MFA, com registro em `admin_audit_log`). Essa rota **não devolve o PIN**: o comprador o vê pela `get_my_order_pins`.
- `check_delivery_pin(p_order_id, p_pin)` e `check_pickup_pin(p_order_id, p_pin)`:
  - remover `p_operator_id`;
  - recusar logo no início se `auth.uid() <> orders.driver_id` (exceto service_role), **antes** de contar tentativa;
  - comparar só com `pin_hash`; o PIN em texto puro sai da tabela `orders` (fica em `order_pins`, ver 1.5).
- **Teste negativo:** usuário que não é o motorista chama as quatro funções num pedido `DELIVERING`. Todas falham, e `pin_attempts`/`status` não mudam.

**1.2 Status só por caminho autorizado (A7).**
- Estender `advance_order_status` com:
  - `pickup` (motorista atribuído, `READY` → `DELIVERING`, se a retirada não for só pelo `check_pickup_pin`);
  - `cancel_unpaid` (comprador ou loja, só `PENDING`).
  - O cancelamento de pedido **pago** continua exclusivamente pela rota `/api/asaas/refund`, que, depois do estorno, chama a RPC com service_role.
- No app (`useAppStore.acaoPedido`):
  - remover **todas** as chamadas a `transition_order_status`;
  - remover o `supabase.from('orders').update(updates)` (~2530);
  - `pagar_motorista` (~2381) passa a usar `advance_order_status('archive_driver')`;
  - mostrar ao usuário o erro devolvido pela RPC.
- Depois do deploy do app: `REVOKE EXECUTE ON FUNCTION public.transition_order_status FROM PUBLIC, anon, authenticated;`. Se algum código de servidor ainda a usar, reescrevê-la para aplicar `v_is_valid_transition` e recusar `PAID`, `RECEIVED`, `REFUNDED` e `COMPLETED` para quem não é service_role.
- `accept_order_atomic`: aceitar só pedidos `READY`/`SEARCHING_OPERATOR` e do tipo compatível com o veículo do motorista (moto → B2C; caminhão → B2B/Coleta).
- **Teste negativo:** cliente comum tenta levar o próprio pedido `PENDING` para `PAID` (pela RPC antiga e pela nova) e cancelar pedido alheio. Tudo falha.

**1.3 O app nunca grava `PAID` (H4).** Em `acaoPedido`, `confirmar_pagamento`/`pagar` só chamam `fetchOrders`. O `PixModal`, ao detectar pagamento, fecha e recarrega, sem gravar nada. `PAID` é gravado só pelo webhook, pelo `GET /api/asaas/status` e pela conciliação manual (todos no servidor).

**1.4 Baixa forçada (R6).** `force_receive` só a partir de `DELIVERING`, `DELIVERED` ou `PIN_LOCKED`; nunca a partir de `PENDING`, `PAID`, `CANCELLED`, `REFUNDED` ou `COMPLETED`. Motivo com no mínimo 10 caracteres e registro em `admin_audit_log`.

**1.5 Dados sensíveis fora do SELECT (A9/H7; Anexo I, 6).**
- Tabela nova `order_pins (order_id, delivery_pin, pickup_pin)` com RLS: o comprador lê `delivery_pin`, o dono da loja lê `pickup_pin`, o admin lê ambos; escrita só por service_role. `generate_*_pin` grava em `order_pins` e o hash em `orders`. Migrar os PINs existentes e depois limpar `orders.delivery_pin`/`pickup_pin`.
- O app lê PIN só por `get_my_order_pins` (ajustar para ler de `order_pins`). Remover `delivery_pin`/`pickup_pin` do `select` do `fetchOrders` (~2699) e os PINs calculados a partir do id (~2944–2955). Sem PIN do servidor, mostrar "PIN indisponível — atualize a tela".
- Radar: substituir a parte da policy de SELECT que libera pedidos sem motorista por uma função `SECURITY DEFINER` `get_driver_radar()` que devolve só id, tipo, bairro, coordenadas arredondadas (3 casas), frete do motorista e distância. Endereço completo, nome e telefone do cliente só para o motorista atribuído.
- Depois do deploy do app: `REVOKE SELECT ON public.orders FROM anon, authenticated;` + `GRANT SELECT (<colunas explícitas, sem pin_hash, provided_pin, delivery_pin, pickup_pin>) ON public.orders TO authenticated;` (revogar uma coluna sobre um GRANT de tabela não tem efeito).
- **Teste negativo:** motoboy e loja tentam ler `delivery_pin` (pela tabela e por `order_pins`) e ver telefone de pedido do radar. Tudo falha.

---

## Fase 2 — Contrato Asaas: KYC, termos, transparência, atendimento

**2.1 KYC verdadeiro (K1; cl. 8.2.3, 10.2, 13.5; crítico).**
- `api/asaas/subaccount`: remover `birthDate: '1990-01-01'`, `incomeValue: 3000` e `companyType: 'MEI'`.
- Cadastro de parceiro pede e valida (com mensagens claras):
  - CPF/CNPJ com dígito verificador;
  - nome completo/razão social;
  - data de nascimento real (CPF; maior de 18 anos);
  - renda ou faturamento mensal declarado;
  - tipo de empresa (`MEI`, `LIMITED`, `INDIVIDUAL`, `ASSOCIATION`) para CNPJ;
  - endereço completo com CEP, telefone e e-mail.
- Gravar em colunas novas de `users` (`birth_date`, `monthly_income`, `company_type`, `postal_code`, `address_number`, `province`) e enviar ao Asaas **exatamente** o que foi declarado. Se faltar dado, não criar a subconta.
- Relatório no admin (CSV) com as subcontas já criadas com dados fixos (data 1990-01-01, renda 3000 ou MEI forçado), para o dono do produto regularizar com o Asaas. **Não** alterar essas subcontas automaticamente.

**2.2 CPF/CNPJ travado depois da subconta (K2).** Migration: tirar `cpf_cnpj` e `pix_key` do `GRANT UPDATE` de `users` para `authenticated`. O usuário informa o CPF/CNPJ no cadastro (pela rota de servidor). Depois de criada a subconta, só o admin altera, com motivo e registro em `admin_audit_log`.

**2.3 Aceites registrados (K3; cl. 8.2.4).**
- Tabela `terms_acceptances (id, user_id, document, version, accepted_at, ip, user_agent)`, insert só pela rota de servidor `/api/terms/accept`, sem UPDATE/DELETE.
- `document` ∈ `acaifood_terms`, `acaifood_privacy`, `asaas_terms`, `asaas_privacy`, `subaccount_mandate`, `pix_random_key_consent`.
- **Comprador:** aceita os Termos e a Política AçaíFood. O texto menciona que pagamentos são processados pelo Asaas, com link para os Termos de Uso e a Política de Privacidade do Asaas.
- **Parceiro**, antes de criar a subconta, com checkboxes separados e obrigatórios:
  - Termos AçaíFood;
  - Termos de Uso e Política de Privacidade do **Asaas** (links oficiais);
  - **mandato:** autorizo a Eletromecânica Baia Ltda a solicitar a abertura e a movimentação da minha subconta Asaas para receber os repasses das minhas vendas/entregas;
  - consentimento para a criação da **chave Pix aleatória** na minha subconta.
- Os textos ficam versionados em `docs/legal/` (ex.: `termos_v2026-10.md`). Usuário com versão antiga aceita a nova no próximo login, antes de usar o app.
- O cadastro atual (`termosAceitos`, só na tela) passa a gravar em `terms_acceptances`.

**2.4 Taxa de ativação (K4; cl. 6.1 e 3.3).**
- Em `api/asaas/activation`, `PartnerActivationGuard`, cadastro e manuais: trocar "Taxa Única de **Homologação Asaas** & Ativação de Parceiro" por "Taxa de ativação da plataforma AçaíFood". Nunca dizer ou sugerir que o Asaas cobra essa taxa.
- Respeitar `activation_fee_enabled`: com `false`, o parceiro é ativado sem pagar (manter o histórico). O dono do produto decide depois da resposta do Asaas.

**2.5 Empresa e marca corretas (K5; cl. 3.3).**
- Política de privacidade:
  - trocar "AçaíFood Tecnologia Ltda." por "Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40), titular da marca AçaíFood, controladora dos dados";
  - incluir o canal do encarregado/contato LGPD;
  - atualizar a data.
- Usar a razão social completa do Asaas ("Asaas Gestão Financeira Instituição de Pagamento S.A., CNPJ 19.540.550/0001-21") na política, nos termos, no `AsaasPartnerBadge` e no comprovante, no lugar de "Asaas IP S.A.".
- Manter o selo Asaas onde já existe: cadastro, login, telas de parceiro, Pix, comprovante e rodapé.

**2.6 Reclamações financeiras ao Asaas (K6; cl. 7.1).**
- No suporte (`SupportChatModal`, `AdminSupportSection`), criar a categoria "Pagamento, Pix ou repasse".
- Ao abrir um chamado nessa categoria:
  - mostrar ao usuário que os serviços financeiros são do Asaas e os canais oficiais de atendimento do Asaas;
  - marcar o chamado como "financeiro";
  - mostrar ao admin o botão "Encaminhado ao Asaas", que grava data e protocolo.
- Chamado financeiro aberto há mais de 24 h sem encaminhamento aparece em destaque.

**2.7 Indicadores mensais (K7; cl. 11).** Tela no admin com relatório mensal exportável (CSV/PDF): chamados abertos e fechados, reclamações procedentes (campo no fechamento), taxa de reclamações procedentes, prazo médio da primeira resposta e de solução, chamados financeiros encaminhados ao Asaas, e disponibilidade do app (monitor externo de uptime em `/api/health`, rota nova e leve).

**2.8 Logs sem dados pessoais (K8; Anexo I, 6/7).**
- Remover `console.log(JSON.stringify(body))` do webhook.
- Em todas as rotas, logar só evento, ids, status e resultado; nunca CPF, nome, telefone, endereço, chave Pix, PIN ou chave de API.

---

## Fase 3 — Saque, chaves e acesso (enquanto o repasse novo está desligado)

**3.1 Saque só para a subconta Asaas aprovada (C6; cl. 6.4 e 2.1).**
- Em `withdrawalApproval`/`buildAsaasTransferPayload`: o destino passa a ser **exclusivamente** `asaas_wallet_id` de usuário com `asaas_account_status = 'APPROVED'` (transferência entre Contas Asaas por `walletId`). Remover os destinos `pix_key`, `cpf_cnpj` e e-mail.
- Sem subconta aprovada: o pedido de saque fica "Aguardando subconta" e o parceiro vê como concluir o cadastro.
- A tela de saque (`PartnerWithdrawalSection` e telas de parceiro) diz: "O valor vai para a sua subconta Asaas. Para sacar para seu banco, use o app do Asaas."

**3.2 Idempotência e trava do saque (H2).**
- Antes do `POST /transfers`: travar com `update withdrawal_requests set status='PROCESSING', transfer_attempt_id=… where id=? and status in ('PENDENTE','FALHOU') returning *` (se não voltar linha, parar).
- Enviar `externalReference = transfer_attempt_id` (confirmar na documentação do Asaas; se não houver o campo, usar a `description`).
- Em falha de rede ou para reprocessar um `FALHOU`: consultar `GET /transfers` por essa referência antes de reenviar; se já existir e não estiver falha, só atualizar o saque.
- `processWithdrawalApproval` recusa `FALHOU` se algum pedido do saque estiver em outro saque `PENDENTE`/`APROVADO`/`PROCESSING`/`PAGO`.

**3.3 Chaves e rotas legadas (Anexo I, 4).**
- `asaasConfig.ts` lê a chave **só** de `process.env.ASAAS_API_KEY`. Remover a leitura de `platform_settings.asaas_api_key` e a coluna (migration).
- Desativar `/api/asaas/transfer` (responde 410) e apagar `lib/payoutCalc.ts`.
- Conferir que nenhum `.env*` está versionado e que os previews da Vercel usam chaves de **sandbox** (variáveis separadas por ambiente).

**3.4 Log de ações de admin (Anexo I, 7).** Tabela `admin_audit_log (id, actor_id, action, target_type, target_id, before jsonb, after jsonb, ip, user_agent, created_at)`, insert só por service_role, sem UPDATE/DELETE para ninguém (nem admin). Registrar: aprovar/rejeitar saque, conciliar Pix, estornar, baixa forçada, regerar PIN, mudar taxas/configurações/flags, bloquear/desbloquear usuário, alterar CPF/CNPJ, apagar dados. Tela simples de consulta no admin.

**3.5 MFA para admin (Anexo I, 3).** Exigir MFA TOTP (Supabase Auth) para usuários admin: o painel `/admin` pede o cadastro/verificação do segundo fator, e `authorizeRequest(['admin'])` recusa JWT sem `aal2`.

**3.6 Rotas destrutivas.** `/api/admin/clear-data` e `/api/admin/reset-balances` só funcionam se `ALLOW_DESTRUCTIVE_ADMIN=true` (variável **ausente** em produção); caso contrário, 403.

---

## Fase 4 — Repasse novo (`settlements`): corrigir agora, ligar só com aprovação

Corrija tudo abaixo com `settlements_enabled = false`. O cron e a rota rodam, mas não transferem enquanto a flag estiver desligada (só registram o que fariam).

**4.1 Tabela e rota alinhadas (R1).**
- Um único conjunto de status: `PENDING`, `PROCESSING`, `DONE`, `FAILED`, `WAITING_ACCOUNT`, `REVIEW`, `CANCELLED`.
- Colunas `attempts int default 0`, `last_error text`, `transferred_at timestamptz` (migration).
- Corrigir `api/settlements/process`, que hoje usa `TRANSFERRED`, `WAITING_KYC` e colunas inexistentes.
- Travar cada linha com `update … set status='PROCESSING' where id=? and status in ('PENDING','FAILED') returning`.
- Idempotência por `externalReference = settlements.id`.
- Transferência só por `walletId` para subconta `APPROVED`.

**4.2 Confirmação pelo webhook.** Status `DONE` só com `TRANSFER_DONE`/`TRANSFER_COMPLETED` (casar por `asaas_transfer_id`), e `FAILED` com `TRANSFER_FAILED`/`CANCELLED`/`REVERSED`. Hoje o webhook só atualiza `withdrawal_requests`.

**4.3 Agendamento.** Cron na Vercel a cada 15 min para `/api/settlements/process` (`vercel.json`), autenticado só por `Authorization: Bearer CRON_SECRET`. Logo depois de um PIN validado, chamada interna (servidor, com `INTERNAL_API_SECRET`), nunca pelo navegador.

**4.4 Sem pagamento em dobro (R2).**
- O trigger que cria `settlements` marca `payout_seller_done`/`payout_driver_done = true` no mesmo pedido.
- `partnerBalance` e o saque antigo ignoram pedidos que já têm `settlement`.
- Script único, com relatório antes de gravar: marcar como já pagos os pedidos que receberam split no checkout antes do R11 (consultar o campo `split` da cobrança no Asaas).
- No dia de ligar: pagar ou rejeitar todos os `withdrawal_requests` abertos; depois desligar o saque antigo (rota 410, botão escondido) e mostrar a tela "Seus repasses" lendo `settlements`.

**4.5 Valores certos (R4, R5).**
- Pedido sem snapshot: **nunca** usar `products_subtotal`. Calcular uma vez no servidor com `calculateOrderPricing` (taxas da cidade do pedido) e marcar `pricing_snapshot.backfilled = true`, ou criar o `settlement` como `REVIEW` para o admin aprovar. Repasse calculado zero fica zero.
- Não criar `settlement` de vendedor quando o vendedor é o próprio comprador.
- Coleta: o vendedor é o EcoPonto/Caçamba de destino. Corrigir `checkout` (`storeTargetId = validBuyerId` hoje) e o trigger.
- Estorno depois do `RECEIVED` (só admin): `settlement` `PENDING` vira `CANCELLED`; se já estiver `DONE`, abrir ocorrência para cobrança manual.

**4.6 Modelo aprovado pelo Asaas (cl. 2.1, 4.2, 6.3, 6.4).**
- Ligar `settlements_enabled` **só** com a resposta escrita do Asaas aprovando "Pix na conta raiz + transferência por `walletId` para a subconta aprovada depois da confirmação da entrega", anexada pelo dono do produto em `docs/legal/`.
- Se o Asaas exigir outro modelo (cobrança na subconta do vendedor com split para a Tomadora e o entregador, ou conta de custódia/Escrow): **não implemente**. Escreva em `docs/` um plano técnico do modelo indicado (chaves das subcontas no Vault, pagamento do entregador, estorno, migração dos pedidos em andamento) e espere aprovação.

**4.7 Ordem de deploy (R7).** A migration das colunas de snapshot e de `settlements` fica aplicada em produção antes de qualquer deploy do checkout que grave essas colunas. Incluir no checkout um teste de fumaça (criar pedido de teste no sandbox) antes de promover o deploy.

---

## Fase 5 — Restante

1. **Valores únicos (H5):** comprovante (`OrderReceiptModal`), impressora (`thermalPrinter`), saldo e telas de ganhos leem o snapshot do pedido (`seller_payout_amount`, `driver_payout_amount`, `platform_fee_amount`, `delivery_fee_amount`), sem recalcular. Remover `calculateOrderFreight/Taxes` do cliente onde já houver snapshot.
2. **Preço e distância no servidor (C8):** o checkout recebe só `items: [{product_id, quantity}]` e o endereço/coordenadas de entrega. O servidor busca o preço em `products` (ou na tabela de preços usada hoje pela loja/fornecedor) e calcula a distância (Haversine) entre as coordenadas da loja e da entrega. Recusar fora do raio configurado. `order_items` com preço do servidor.
3. **Textos (M1):** remover "saque instantâneo", "2 saques por dia" e o contador em `localStorage` das telas de motoboy, caminhão, fornecedor e batedeira, dos manuais (`AdminManualModal`, `PartnerManualModal`, `docs/04_MANUAIS_DE_USO.md`) e dos PDFs em `apps/mobile/public/`. Texto novo: "O repasse vai para sua subconta Asaas depois que o cliente confirma a entrega com o PIN."
4. **Banco versionado (M5):** `supabase db diff` contra a produção → migrations oficiais; mover os `.sql` soltos da raiz para `docs/historico/sql/`; corrigir as migrations com `\$\$`; rollback da Fase 2B do R11 recriando a policy de UPDATE removida.
5. **Código morto:** `BlockedUserGuard.tsx`, `admin/UserManagementTable.tsx`, `/api/asaas/documents` (ou criar a tela), consultas de `partnerBalance` por colunas inexistentes (`loja_id`, `fornecedor_id`, `origem_id`, `motorista_id`).
6. **Desenvolvimento seguro e incidentes (Anexo I, 8, 9, 12, 13):**
   - **Testes automatizados no CI, contra o projeto Supabase de teste:** `pricingEngine`, matriz de `advance_order_status`, testes negativos das Fases 1 e 3, idempotência de `settlements` e saque.
   - **Documentos em `docs/seguranca/`:** processo de incidentes (quem decide, como comunicar o Asaas em até 24 h), registro de vulnerabilidades (as auditorias 03 a 12, com responsável, prazo e status), procedimento de backup/restauração com teste registrado, e inventário de terceiros com acesso ao código e às credenciais (Antigravity, Vercel, Supabase, GitHub).

---

## Critério de aceite do R12

- Os testes negativos passam no CI e em produção:
  - só o motorista atribuído confirma entrega;
  - só o servidor marca `PAID`;
  - só o comprador lê o PIN de entrega;
  - ninguém lê telefone ou endereço de pedido do radar.
- Nenhum dado de cadastro fixo é enviado ao Asaas, e o CPF/CNPJ não muda depois da subconta.
- Todo aceite (termos AçaíFood e Asaas, mandato, chave Pix) tem registro com data, versão e IP.
- Nenhuma tela ou cobrança atribui ao Asaas uma taxa da plataforma. A política cita a Eletromecânica Baia como titular e o Asaas com a razão social completa.
- Reclamações financeiras têm encaminhamento registrado ao Asaas, e o relatório mensal de atendimento sai do admin.
- Nenhum dinheiro sai para chave Pix digitada: saque e repasse só por `walletId` para subconta aprovada, sem duplicidade, mesmo com chamadas repetidas e queda de rede.
- Ações de admin ficam em `admin_audit_log`, e o admin entra com MFA.
- `settlements_enabled` e `auto_payout_enabled` continuam `false` até o dono do produto ligar, com a aprovação do Asaas anexada.
- Comprovante, impressora e saldo mostram os mesmos valores, vindos do snapshot.
