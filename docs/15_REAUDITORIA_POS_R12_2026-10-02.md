# AçaíFood — Reauditoria pós-R12 (02/10/2026, noite)

**Escopo:** o que mudou com o R12: a migration `20261002030000_r12_security_pin_kyc_audit_core.sql` e o rollback; `useAppStore.ts`, `asaasConfig.ts`, `asaasTransferHelpers.ts`; as rotas `subaccount`, `activation`, `status`, `transfer`, `settlements/process`, `clear-data`, `reset-balances`, e as novas `health` e `terms/accept`; os docs `01`, `02`, `04` e `README`. Também conferi os arquivos que o R12 mandava mudar e **não mudaram**. Nenhum arquivo de código foi alterado.
**Não lido:** `api/admin/orders/regenerate-pin`, `api/admin/payout/mark-done`, `api/admin/withdrawals/[id]/*` (pastas fundas demais para a ferramenta).
**Método:** só leitura. Não sei se a migration já rodou em produção (o Supabase CLI foi usado às 16h17); os itens 🗄️ precisam de confirmação no banco.

## Resumo

**Não está ok.** O R12 foi feito **em parte**: cerca de um terço dos itens está completo. Há uma **regressão provável em produção** e a brecha principal do PIN continua aberta:

1. **Entregas novas podem não conseguir ser confirmadas por PIN (regressão) 🗄️.** O app agora lê o PIN da tabela nova `order_pins`, mas nada grava nela depois da migration. Além disso, o webhook troca o PIN no momento do pagamento.
2. **A versão antiga e insegura de `check_delivery_pin`/`check_pickup_pin` continua no banco e é a que o app usa.** A versão nova e segura foi criada ao lado, com outra assinatura, e ninguém a chama.
3. O cadastro de parceiro (KYC), o registro de aceite dos termos, MFA, suporte ao Asaas, relatório mensal, política de privacidade e boa parte do repasse **não foram feitos**, embora os docs reescritos digam que sim.

| Situação | Itens |
|---|---|
| ✅ Feito | R3 parcial (`generate_*_pin` revogado), A7 (`transition_order_status` revogado), 1.3 (o app não grava `PAID`), R6 (baixa forçada), K1 no servidor, K8 (logs), 3.1 no helper (saque só por `walletId`), 3.3 (chave só da variável de ambiente; `/transfer` 410), 3.6 (rotas destrutivas travadas), `/api/health`, tabelas `admin_audit_log`, `terms_acceptances` e `order_pins`, CPF/Pix travados para o usuário |
| 🟡 Parcial | R3/1.1, 1.5 (PIN e radar), K1 (sem tela), K3 (rota sem uso), K4 (só a API), 3.4 (log só na baixa forçada), R1 (trava e flag, mas tabela sem colunas) |
| 🔴 Não feito | K2 (brecha no checkout), K5, K6, K7, 3.2/H2, 3.5 (MFA), 1.2 (veículo × tipo), R2, R4, R5, cron de repasse, H5, C8, M1, M5, testes, `docs/seguranca` |
| 🆕 Novo | P1–P5 abaixo |

---

## 🆕 Problemas novos

**P1. PIN de entrega errado ou ausente nos pedidos novos (Crítico, funcional) 🗄️.**
O R12 copiou para `order_pins` os PINs que já existiam, mas:
- o checkout continua gravando o PIN só em `orders.delivery_pin`;
- `generate_delivery_pin` e `generate_pickup_pin` (chamadas pelo webhook no pagamento) **não foram alteradas**: geram um PIN **novo** e gravam só em `orders`;
- o `fetchOrders` do app agora lê **só** `order_pins`.

O que acontece com um pedido pago depois da migration:
1. O cliente vê, no máximo, o PIN devolvido pelo checkout (guardado no aparelho), que o webhook já trocou. Em outro aparelho, não vê PIN nenhum.
2. O motoboy digita o PIN que o cliente informa e recebe "PIN incorreto".
3. Depois de 5 tentativas, o pedido vira `PIN_LOCKED` e só o admin destrava.

A loja também não vê o PIN de retirada; a retirada passa pela ação `pickup`, que não exige PIN.
→ **Teste agora** com um pedido real pago. Se confirmar: fazer `generate_*_pin` e o checkout gravarem em `order_pins` (e o hash em `orders`), e copiar para `order_pins` os PINs dos pedidos abertos.

**P2. A função antiga de PIN continua ativa e é a que o app usa (Crítico, segurança).**
A migration criou `check_delivery_pin(uuid, text, text)` e `check_pickup_pin(uuid, text, text)` com a checagem de motorista, mas **não apagou** as versões antigas `(uuid, text, uuid, text)`. Elas continuam executáveis por qualquer usuário logado, sem checar quem chama, comparando com `orders.delivery_pin`. O app chama com `p_operator_id`, então **usa a antiga**.

Consequência:
- a loja (que lê `orders.delivery_pin` dos próprios pedidos) ou o motoboy atribuído (idem) confirma a entrega sem o cliente, e o trigger cria o repasse;
- qualquer usuário consegue bloquear qualquer pedido (`PIN_LOCKED`) com 5 tentativas erradas.

→ `DROP FUNCTION public.check_delivery_pin(uuid, text, uuid, text); DROP FUNCTION public.check_pickup_pin(uuid, text, uuid, text);`. O app passa a chamar sem `p_operator_id`.

Atenção: a versão nova **não grava `provided_pin`**, e o trigger antigo `validate_delivery_pin_trigger` exige `provided_pin` para ir a `RECEIVED` quando quem chama é um usuário logado. Ao trocar, a confirmação vai falhar com "PIN de segurança incorreto ou ausente". Ajustar o trigger para aceitar a mudança vinda da função segura, ou fazer a função gravar `provided_pin` antes do update.

**P3. `order_pins` mostra os dois PINs para comprador e loja (Alto).**
As policies são por linha: quem passa numa delas lê a linha inteira. A loja lê o `delivery_pin` e o comprador lê o `pickup_pin`. Com P2, a loja confirma a entrega sozinha.
→ Não dar SELECT direto em `order_pins`. O app lê só por `get_my_order_pins`, que já filtra por papel; revogar `SELECT ON order_pins FROM authenticated`.

**P4. O radar e o SELECT de `orders` não mudaram (Alto).**
`get_driver_radar()` foi criada, mas o app não a usa, e a policy de SELECT continua liberando `SELECT *` de pedidos sem motorista (telefone, endereço, `delivery_pin`, `pin_hash`). Não houve `REVOKE SELECT` com GRANT por coluna.
→ App passa a usar `get_driver_radar()`; GRANT SELECT por coluna em `orders` sem `delivery_pin`, `pickup_pin`, `pin_hash`, `provided_pin`; depois limpar `orders.delivery_pin`/`pickup_pin`.

**P5. Docs reescritos com dados errados (Médio, contrato cl. 3.3 e 10.2).**
- `01_OPERACAO_DO_APP.md` diz "Tomadora: Eletromecânica Baia Ltda (CNPJ: **19.540.550/0001-21**)". Esse é o CNPJ **do Asaas**; o da Tomadora é 42.035.623/0001-40.
- O mesmo arquivo fala em "custódia e divisão das parcelas", que não existe.
- O README e o `02` apresentam o R12 como implementado ("isolamento de PINs em `order_pins`"), mas está incompleto.
- O índice e a seção de limpeza da pasta foram apagados do README.

→ Corrigir. Os docs são a fonte de verdade e podem ser pedidos pelo Asaas em auditoria.

---

## Itens do R12 que não foram feitos ou ficaram pela metade

| Item | Situação |
|---|---|
| **K1 KYC** | ✅ O servidor exige data de nascimento real, renda e tipo de empresa, e não envia mais dados fixos. ❌ **Nenhuma tela pede esses dados**: cadastro, `PartnerActivationGuard` e store chamam `/api/asaas/subaccount` sem eles, então **toda criação de subconta passa a falhar com erro 400**. Também não há o relatório das subcontas antigas com dados fixos |
| **K2 CPF travado** | ✅ O usuário não altera mais pelo banco. ❌ O checkout (service_role) ainda **sobrescreve `users.cpf_cnpj`** com o CPF digitado no carrinho, inclusive de parceiro com subconta |
| **K3 Aceites** | 🟡 Tabela e rota `/api/terms/accept` criadas, mas **ninguém chama a rota**. O cadastro continua só com `termosAceitos` na tela; sem os checkboxes de Termos e Política do Asaas, mandato e chave Pix; sem aceite no login para usuários antigos |
| **K4 Taxa de ativação** | 🟡 A descrição da cobrança mudou. ❌ O cadastro ainda mostra "Taxa Única de Homologação Asaas", "Homologação Asaas & Split Automático" e "Homologação Asaas Sob Demanda". A flag `activation_fee_enabled` não existe |
| **K5 Política** | ❌ Continua "AçaíFood Tecnologia Ltda." e "Asaas IP S.A." |
| **K6 / K7** | ❌ Suporte sem categoria financeira nem encaminhamento ao Asaas; sem relatório mensal |
| **1.2** | 🟡 Ações novas em `advance_order_status` e `transition_order_status` revogado. ❌ `accept_order_atomic` ainda aceita `PAID`/`PREPARING` e qualquer veículo. ⚠️ `archive_driver` agora pode ser chamado pelo **próprio motorista** e leva `DELIVERED` (sem PIN) a `COMPLETED`, o que bloqueia o estorno do cliente |
| **3.2 Idempotência do saque** | ❌ `withdrawalApproval.ts` não mudou |
| **3.4 Log de admin** | 🟡 Só a baixa forçada grava em `admin_audit_log`; aprovar saque, conciliar, estornar, mudar taxas e bloquear usuário não gravam |
| **3.5 MFA admin** | ❌ `apiAuth.ts` não mudou |
| **Fase 4 repasse** | 🟡 Flag e trava na rota. ❌ A coluna `settlements_enabled` **não existe** em `platform_settings` (a flag nunca liga). ❌ `settlements` continua **sem** `attempts`, `last_error`, `transferred_at` (a rota quebra quando ligada). ❌ R2: o trigger não marca `payout_*_done` e `partnerBalance` não exclui pedidos com repasse. ❌ R4: fallback do valor bruto. ❌ R5: coleta. ❌ Sem cron no `vercel.json` |
| **Fase 5** | ❌ H5 (comprovante e impressora), C8 (preço do celular), M1 (textos "saque instantâneo"), M5 (db diff), testes no CI, `docs/seguranca/` |

---

## O que fazer agora

1. **Teste já** um pedido real pago até a entrega. Se o PIN falhar (P1), destrave pelo admin com baixa forçada e aplique o hotfix abaixo antes de qualquer outra coisa.
2. **Mantenha suspensa** a criação de subcontas (ela falha de qualquer forma até a tela do K1 existir).
3. Não ligue repasse nem pagamento automático.
4. Corrija o CNPJ no `docs/01`.

## Hotfix imediato (antes do resto do R12)

1. Migration:
   - `DROP` das versões antigas de `check_delivery_pin`/`check_pickup_pin`;
   - `generate_delivery_pin`/`generate_pickup_pin` gravam em `order_pins` (e o hash em `orders`);
   - copiar para `order_pins` os PINs dos pedidos abertos;
   - ajustar `validate_delivery_pin_trigger` para não bloquear a função segura;
   - `REVOKE SELECT ON order_pins FROM authenticated`.
2. App:
   - chamar `check_*_pin` sem `p_operator_id`;
   - ler PIN só por `get_my_order_pins`;
   - checkout grava o PIN em `order_pins`.
3. Teste: pedido B2C pago no sandbox → cliente vê o PIN → motoboy confirma → `RECEIVED`; a loja não consegue ler o `delivery_pin` nem confirmar.

Depois do hotfix, retomar os itens pendentes do R12 (tabela acima), na ordem: P4 → K1 (tela) e K3 → K4/K5 → 3.2/3.5 → Fase 4 → Fase 5.
