# Relatório final do R16 — 06/10/2026

> O que foi corrigido no código, o que foi testado e o que o dono do produto precisa fazer antes de publicar.
> Base: `docs/19_AUDITORIA_POS_R15_2026-10-06.md` e `docs/20_PROMPT_CORRECOES_R16.md`.
> Tomadora: Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40). App no ar, **ainda sem operação real**.

## 1. Situação dos itens do R16

| Item | Quem fez | Situação |
|---|---|---|
| "Já feito" (aceites, cadastro com KYC real, webhook de conta, saque por subconta aprovada, MFA, privacidade de `users`, preço no servidor) | Claude | Feito |
| 1 — `pay-partner`, `regenerate-pin`, logs de `mark-done` e saques | Antigravity (revisado pelo Claude) | Feito |
| 2 — Log de admin em todas as ações sensíveis | Claude | Feito |
| 3 — Admin: aba **Conformidade** (subcontas, repasses, log, SLA) | Claude | Feito |
| 4 — Relatório mensal e suporte | Claude | Feito |
| 5 — Telas de saque e textos | Claude | Feito |
| 6 — `platform_config` e e-mail inventado na ativação | Claude | Feito |
| 7 — Testes no CI | Claude | Feito (banco e regras de código). Testes de API com Asaas sandbox: manuais |
| 8 — Docs | Claude | Feito |

## 2. O que mudou nesta etapa (itens 2–8)

### Dinheiro e segurança

- **Saque do parceiro:** só com subconta Asaas `APPROVED` e `walletId`. O botão "Solicitar Saque" só aparece com a conta aprovada. Só um saque em aberto por vez (pendente, aprovado ou em processamento).
- **Corrigido um erro do próprio R16:** a rota `/api/asaas/withdrawals` lia CPF/chave Pix do perfil reduzido do login e recusaria todo saque. Agora lê a situação da subconta direto do banco.
- **Webhook de pagamento:** só muda para `PAID` um pedido que ainda está aguardando pagamento, e só gera PIN nessa hora (webhook repetido não troca o PIN). Removida a geração de PIN com `Math.random` (checkout usa `crypto.randomInt`).
- **Conciliação manual:** só para pedido aguardando pagamento e com valor recebido não menor que o valor do pedido. PIN gerado pelo banco. Com log.
- **Estorno:** o valor nunca vem do navegador (se o Asaas não informar, estorno total). Com log quando é admin.
- **Excluir usuário:** recusado se a pessoa tem pedido pago (como comprador, motorista ou loja) ou saque, para preservar os registros financeiros. Use "Bloquear".
- **Limpar todos os dados:** só funciona com `ALLOW_DESTRUCTIVE_ADMIN_RESET=true` (não definir em produção).
- **Saque automático:** o servidor recusa ligar `auto_payout_enabled` sem `ALLOW_AUTO_PAYOUT=true`.
- **MFA:** toda conta admin precisa de `aal2`, mesmo chamando rota que também aceita parceiros.
- **Ativação:** os dados do pagador vêm do cadastro (nome, e-mail, CPF/CNPJ, celular). Sem e-mail inventado e sem nova tentativa "só com nome e e-mail".

### Log de admin (`admin_audit_log`)

Novas ações registradas: `USER_DELETED`, `USER_DELETE_BLOCKED`, `SYSTEM_DATA_CLEARED`, `SYSTEM_DATA_CLEAR_BLOCKED`, `ADMIN_BALANCES_RESET`, `USER_BLOCKED`, `USER_UNBLOCKED`, `USER_STATUS_CHANGED`, `PAYMENT_RECONCILED_MANUALLY`, `ORDER_REFUNDED_BY_ADMIN`, `ORDER_CANCELLED_BY_ADMIN`, `REFUND_BY_ADMIN`, `PAYOUT_SETTINGS_UPDATED`, `SUPPORT_CONFIG_UPDATED`, `SUPPORT_FORWARDED_TO_ASAAS`, `SUPPORT_TICKET_RESOLVED`, além das do item 1 e das de ativação.

### Telas

- **Admin → 🛡️ Conformidade:** Subcontas Asaas (CPF/CNPJ mascarado, situação, detalhe, "Reconsultar", filtro "Só com problema", aviso de chave da subconta ausente), Repasses (aprovar `REVIEW` com valor recalculado no servidor, cancelar), Log de auditoria (filtro por data e ação, antes/depois), SLA mensal.
- **Suporte:** "Relatório mensal" pede o mês e baixa o arquivo com o token no cabeçalho (antes ia na URL e a rota recusava). O mesmo para "KYC legado".
- **Relatório mensal:** sem o `99.98%` fixo; usa o valor de `monthly_sla` ou "não medido".
- **Parceiros:** removidos "2 saques por dia", "transferir instantaneamente" e o contador no navegador; texto "Seu saque é analisado e pago na sua subconta Asaas". O aviso "Vincular conta/chave Pix" da batedeira agora explica a abertura da conta Asaas.
- **Comanda, impressão e taxas do pedido:** usam os valores gravados pelo servidor (`seller_payout_amount`, `driver_payout_amount`, `platform_fee_amount`, `delivery_fee_amount`) quando existem.

### Banco

- Migration nova `20261006040000_r16_platform_config_and_sla.sql` (+ reversão): `platform_config` (copia taxa de ativação, cota de fundadores e configuração do suporte do JSON antigo) e `monthly_sla`. Só `service_role`.

## 3. Como foi testado

- **TypeScript** (checagem com stubs, sem `npm install` aqui): mesmos 8 avisos de antes, todos dos stubs; nenhum erro novo.
- **Banco** (`supabase/tests/run_ci.sh`, Postgres 16): stub do Supabase + esquema mínimo + migrations `010000`, `020000`, `030000`, `040000` + testes:
  - PIN: 19 verificações cobrindo os 12 casos do Anexo A do `docs/18`;
  - `users`: cliente não lê CPF, chave Pix nem nascimento de outro; lê o nome público; `get_my_profile_json` devolve o próprio CPF e não devolve chave; cliente não aprova a própria subconta; sem default `APPROVED`;
  - radar com `store_name`, coordenadas de 2 casas, sem dados do cliente, sem `anon`;
  - log de admin não aceita `UPDATE`/`DELETE`;
  - `platform_config` copiou a configuração antiga; `platform_config`/`monthly_sla` fechadas; mês inválido recusado.
  - Reversões `040000` e `030000` rodam sem erro.
- **Regras de código** (`scripts/ci_guards.sh`): sem segredo em `NEXT_PUBLIC_`, sem PIN com `Math.random`, sem e-mail inventado, sem token na URL, sem contador de saque no navegador.
- **`npm run build`:** rodar no computador antes do deploy (ver seção 4).

## 4. Antes de publicar (dono do produto)

1. **Build local:** em `apps/mobile`, `npm run build` sem erro.
2. **Vercel → Environment Variables** (Production e Preview separados):
   - `ASAAS_API_KEY` (produção só em Production; sandbox em Preview);
   - `ASAAS_WEBHOOK_TOKEN`, `ASAAS_WEBHOOK_EMAIL`;
   - `APP_BASE_URL=https://www.acaifood.app.br`;
   - `CRON_SECRET`.
   - **Não** criar `ALLOW_DESTRUCTIVE_ADMIN_RESET` nem `ALLOW_AUTO_PAYOUT` em produção.
   - Apagar `NEXT_PUBLIC_ASAAS_WEBHOOK_SECRET`, se existir.
3. **Admin:** cadastrar o TOTP (MFA) **antes** do deploy.
4. **Supabase → SQL Editor, junto com o deploy:** `20261006030000_r16_users_privacy_account_status_radar.sql` e depois `20261006040000_r16_platform_config_and_sla.sql`. (Se `010000` e `020000` ainda não rodaram em produção, rodar antes, nessa ordem.)
5. **GitHub:** o CI novo roda sozinho no push (não precisa de segredo).
6. **Testar no ar (sandbox/preview):**
   - cliente vê lojas e os próprios pedidos;
   - checkout com `productsSubtotal: 0.01` cobra o preço real;
   - parceiro novo se cadastra, vê "Minha conta Asaas" e não vê o botão de saque;
   - saque de conta não aprovada → recusado;
   - webhook de conta sem token → 401; `ACCOUNT_STATUS_DOCUMENT_APPROVED` não aprova a conta;
   - motoboy vê corridas no radar;
   - admin abre a aba Conformidade e baixa o relatório mensal.
7. **Asaas:** enviar as perguntas pendentes (modelo do dinheiro e taxa de ativação) antes de ligar repasse automático.

## 5. O que continua desligado de propósito

- `settlements_enabled = false` (repasse automático depois do PIN).
- `auto_payout_enabled = false` (saque automático).
- Ligar qualquer um deles só com aprovação escrita do Asaas (`docs/13`).
