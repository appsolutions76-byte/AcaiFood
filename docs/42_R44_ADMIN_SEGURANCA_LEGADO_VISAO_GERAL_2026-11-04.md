# R44 — Admin: trava do Limpar, funções antigas escondidas e Visão Geral no servidor (2026-11-04)

Sem migration. Nenhuma mudança em pagamentos.

## 1. Botão "Limpar" travado
- Removidas as senhas fixas do app ("admin", "admin123", "123456") e a senha guardada só no navegador.
- A senha agora é conferida **no servidor**: variável `ADMIN_CLEAR_DATA_PASSWORD` (mínimo 12 caracteres),
  além da chave já existente `ALLOW_DESTRUCTIVE_ADMIN_RESET=true`. Sem as duas, a limpeza fica travada.
- Tentativas com senha errada ficam no log de auditoria (`SYSTEM_DATA_CLEAR_WRONG_PASSWORD`).
- "🔑 Senha" (senha de login do admin): exige 12+ caracteres com maiúscula, minúscula, número e símbolo, e mostra erro real.

## 2. Saques "não criados pelo app" (checagem)
- 2 registros de 27/10/2026 19:37, R$ 1,23 cada: um "Token inválido" (recusado) e um "Desconhecido" (aprovado em modo monitor).
- Mesmo minuto e mesmo valor: padrão de teste do Asaas ao ligar a validação via webhook. Sem outros registros depois.

## 3. Funções do modelo antigo escondidas (botão "🗂️ Funções antigas" para mostrar de novo)
Escondidas por padrão: Pagar Todos / Liquidação em lote (Usuários, Financeiro, Cidades), Pagar e Zerar, Pix Automático
(selo e configuração da cidade), Zerar balanço, aba Conciliação Pix, Parâmetros de cobrança de ativação,
"Voltar ao modelo antigo". A preferência fica salva no navegador.
- Conformidade não mostra mais "modelo antigo"/"plataforma paga" enquanto carrega ("Carregando...").

## 4. Visão Geral com todos os pedidos
- Nova API `/api/admin/dashboard-stats` (só admin) calcula contadores e valores no servidor com todos os pedidos do período
  (antes: só os 200 mais recentes do navegador). Valores do `pricing_snapshot`, só concluídos, horário de Belém.
- Cartão "Volume Total" (quantidade) renomeado para "Total de Pedidos"; no Histórico, "Volume (R$)".
- `lib/orderFinance.ts`: cálculo financeiro por pedido reutilizável.

## Arquivos
- apps/mobile/src/app/admin/page.tsx
- apps/mobile/src/components/admin/AdminComplianceSection.tsx
- apps/mobile/src/store/useAppStore.ts (clearData envia a senha)
- apps/mobile/src/app/api/admin/clear-data/route.ts
- apps/mobile/src/app/api/admin/dashboard-stats/route.ts (novo)
- apps/mobile/src/lib/orderFinance.ts (novo)
- apps/mobile/.env.example (nova variável)
