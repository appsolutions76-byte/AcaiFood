# Registro de Vulnerabilidades e Gestão de Riscos

## 1. Visão Geral
Este documento rastreia a identificação, classificação, mitigação e resolução de vulnerabilidades de segurança da plataforma AçaíFood.

## 2. Histórico de Vulnerabilidades Identificadas e Mitigadas

| ID | Data | Severidade | Descrição da Vulnerabilidade | Mitigação Aplicada | Status |
|---|---|---|---|---|---|
| **VULN-2026-001** | 2026-10-02 | Crítica (P0) | Exposição de PIN de entrega e retirada na tabela `orders` em texto claro. | Migration `20261002040000_r13_hotfix_pin_order_pins.sql`: Isolamento completo em `order_pins`, RPCs seguras com rate limiting e bloqueio após 5 tentativas. | **RESOLVIDO** |
| **VULN-2026-002** | 2026-10-02 | Alta (P1) | Leitura de pedidos não atribuídos com endereços de clientes liberada via RLS. | Migration `20261002060000_r14_driver_radar_and_order_privacy.sql`: Removido trecho `driver_id IS NULL`, RPC `get_driver_radar()` com ofuscação de endereço e anonimização de comprador. | **RESOLVIDO** |
| **VULN-2026-003** | 2026-10-02 | Alta (P1) | Possibilidade de arquivamento (`archive_driver`) a partir do status DELIVERED sem validação do PIN de entrega. | Migration `20261002070000_r14_accept_order_and_archive_security.sql`: `archive_driver` restrito a administradores e apenas a partir de `RECEIVED`. | **RESOLVIDO** |
| **VULN-2026-004** | 2026-10-02 | Alta (P1) | Risco de saques concorrentes duplicados em falhas intermitentes de gateway. | Atualização `withdrawalApproval.ts`: Trava atômica com `transfer_attempt_id`, consulta de idempotência no Asaas prévia e restrição estrita a contas `APPROVED`. | **RESOLVIDO** |
| **VULN-2026-005** | 2026-10-02 | Média (P2) | Pedidos de Coleta atribuindo o próprio comprador como vendedor. | Atualização `checkout/route.ts`: Coleta com `sellerStorefrontId = null`, sem gerar repasse indevido ao comprador. | **RESOLVIDO** |
| **VULN-2026-006** | 2026-10-03 | Crítica (P0) | Funções de PIN aceitavam PIN fixo/mestre e podiam ser chamadas sem login (`anon`), permitindo confirmar retirada/entrega sem o PIN real. Achado em `docs/17`. | Migration `20261006010000_r15_pin_hardening.sql`: sem PIN mestre, só o motorista atribuído valida, `REVOKE EXECUTE` de `anon`, trigger exige validação pela função segura. 12 testes no CI (`supabase/tests/10_pin.test.sql`). | **RESOLVIDO (aplicar migration em produção)** |
| **VULN-2026-007** | 2026-10-06 | Alta (P1) | Qualquer usuário logado lia todas as colunas de `users` de outras pessoas (CPF/CNPJ, chave Pix, nascimento, renda, e-mail, endereço fiscal, dados da subconta); `anon` também lia. O app podia gravar `asaas_account_status = APPROVED` no próprio usuário. | Migrations `20261006020000` e `20261006030000`: chaves em `partner_secrets`, `SELECT` por coluna, `get_my_profile_json()`, trigger de campos financeiros, sem default `APPROVED`. Testes no CI (`20_users_radar_audit.test.sql`). | **RESOLVIDO (aplicar migration junto com o deploy)** |
| **VULN-2026-008** | 2026-10-04 | Crítica (P0) | Saque/pagamento ao parceiro enviava Pix para chave/CPF/e-mail digitado ou vindo do navegador, com valor vindo do navegador (`pay-partner`). | `withdrawalApproval.ts`, `asaasTransferHelpers.ts`, `api/admin/payout/pay-partner`, `api/asaas/withdrawals`: só `walletId` de subconta `APPROVED`, valor = saldo do servidor, um saque em aberto por vez, log de admin. | **RESOLVIDO (deploy R16)** |
| **VULN-2026-009** | 2026-10-06 | Média (P2) | Radar dos motoristas usava `sf.name`/`sf.bairro` (colunas que não existem) e quebrava; coordenadas com precisão alta. | Migration `20261006030000`: `store_name`, coordenadas com 2 casas (~1 km), sem dados do cliente. | **RESOLVIDO (aplicar migration)** |
| **VULN-2026-010** | 2026-10-06 | Média (P2) | Ações sensíveis do admin sem registro (excluir usuário, limpar dados, zerar balanços, bloquear, conciliar, estornar, configurar saque); limpeza geral apagava registros financeiros. | `logAdminAction` em todas as rotas; `admin_audit_log` só inclusão; exclusão bloqueada com pedido pago/saque; limpeza geral só com `ALLOW_DESTRUCTIVE_ADMIN_RESET=true`. | **RESOLVIDO (deploy R16)** |

## 3. Diretrizes de Desenvolvimento Seguro
- Toda rota administrativa exige validação JWT com MFA (TOTP) ou segredo interno do servidor.
- Todo acesso direto à tabela `orders` é protegido por RLS e `GRANT SELECT` com colunas explícitas (sem `*`).
- Nenhuma operação bancária é executada sem chave de idempotência (`externalReference`).
- Nenhum valor de dinheiro vem do navegador; nenhum dado inventado é enviado ao Asaas; nenhum segredo em variável `NEXT_PUBLIC_` (conferido no CI por `scripts/ci_guards.sh`).
