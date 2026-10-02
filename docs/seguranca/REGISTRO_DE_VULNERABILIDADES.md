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

## 3. Diretrizes de Desenvolvimento Seguro
- Toda rota administrativa exige validação JWT com MFA (TOTP) ou segredo interno do servidor.
- Todo acesso direto à tabela `orders` é protegido por RLS e `GRANT SELECT` com colunas explícitas (sem `*`).
- Nenhuma operação bancária é executada sem chave de idempotência (`externalReference`).
