# R39 — Indicação de Motoristas, Entrega por Conta Própria e Avaliações (02/11/2026)

> **Branch de implementação:** `r39-indicacoes`  
> **Status em produção:** **Desligado por padrão** em todas as cidades (`referrals_enabled = false`, `ratings_enabled = false`). Nenhuma migration foi aplicada em produção e nenhum termo vigente (`CURRENT_TERMS_VERSION`) foi alterado.

---

## 1. Visão Geral

O ciclo **R39** implementa dois recursos independentes por cidade nos três fluxos da plataforma (**B2C**, **B2B** e **Coleta**):

1. **Indicação de Motoristas (`referrals_enabled`):**
   - Lojas (Batedeiras) e Fornecedores podem gerar links de convite (`/convite/[token]`, validade de 7 dias, token criptográfico SHA-256) para entregadores e transportadores autônomos (`Motoboy` em B2C, `Caminhão` em B2B e `Caçamba` em Coleta).
   - Preferência de chamada configurável por parceiro e por fluxo:
     - `OPEN` (*Aberto a todos do app* — padrão);
     - `PRIORITY_REFERRED` (*Priorizar meus indicados* — janela inicial exclusiva configurável por cidade/fluxo, padrão 180s, abrindo automaticamente a todos após a janela);
     - `REFERRED_ONLY` (*Só meus indicados* — visível apenas para motoristas com indicação `ACTIVE` naquele fluxo).
   - **Comissão reduzida no frete (`*_referred_driver_commission_pct`):** aplicada no checkout **somente** quando a cidade tem `referrals_enabled = true`, o parceiro está em `REFERRED_ONLY` para aquele fluxo e possui ao menos 1 motorista indicado `ACTIVE` com veículo compatível e subconta Asaas `APPROVED`.
   - **Pedido parado e Entrega por Conta Própria (`self_delivery = true`):** em pedidos `REFERRED_ONLY` prontos (`READY` / `SEARCHING_OPERATOR`) sem motorista após o tempo de alerta da cidade (padrão 300s), o parceiro pode:
     1. Abrir apenas aquele pedido para todos os motoristas do app (`dispatch_open_order_to_app`);
     2. Continuar aguardando (`dispatch_mark_stuck_alert_sent`);
     3. Em **B2C** e **B2B** (nunca em Coleta), assumir a **entrega por conta própria** (`dispatch_set_self_delivery`), mantendo o repasse líquido do frete na própria subconta e concluindo a entrega mediante digitação do **PIN de 4 dígitos** do destinatário (`confirm_delivery_with_pin`).

2. **Avaliações de 1 a 5 Estrelas (`ratings_enabled`):**
   - Avaliação mútua entre as partes do pedido após status `RECEIVED`, dentro da janela configurável (`rating_window_days`, padrão 7 dias), com comentário opcional de até 280 caracteres e bloqueio automático de dados pessoais (telefone, e-mail, CPF/CNPJ).
   - Em pedidos com `self_delivery = true`, não há avaliação de/para motorista (apenas entre comprador e vendedor).
   - Média pública (`user_rating_summary`) exibida com `"⭐ X,X (N)"` a partir de `rating_min_count_display` (padrão 3 avaliações), ou `"Novo"` abaixo disso.
   - Sistema de denúncia (`rating_report_create`) e moderação administrativa (`admin_rating_moderate`) com registro obrigatório em `admin_audit_log`.

---

## 2. Migrations e Rollbacks Criados

| Fase | Migration | Rollback | Descrição |
|---|---|---|---|
| **F1** | `supabase/migrations/20261102010000_r39_indicacoes_e_avaliacoes_schema.sql` | `supabase/rollback/20261102010000_r39_indicacoes_e_avaliacoes_schema_rollback.sql` | Colunas aditivas em `cities`, `platform_settings`, `users`, `orders`; tabelas `partner_driver_referrals`, `ratings`, `rating_reports`; views `ratings_public` e `user_rating_summary`; RLS. |
| **F1b** | `supabase/migrations/20261102010100_r39_f1b_ratings_views_privacy.sql` | `supabase/rollback/20261102010100_r39_f1b_ratings_views_privacy_rollback.sql` | Remove `order_id` de `ratings_public` e revoga `SELECT` de `anon` nas views `ratings_public` e `user_rating_summary`. |
| **F2** | `supabase/migrations/20261102020000_r39_referrals_rpcs_and_dispatch.sql` | `supabase/rollback/20261102020000_r39_referrals_rpcs_and_dispatch_rollback.sql` | RPCs `referral_create_invite`, `referral_get_invite_preview`, `referral_accept_invite`, `referral_update_status`, `partner_set_dispatch_mode`, `get_partner_referrals_Overview`, `get_driver_referrals_Overview`; atualização de `get_radar_orders` e `accept_order_safe` para respeitar `dispatch_mode` e `referred_exclusive_until`. |
| **F4 + F4b** | `supabase/migrations/20261102040000_r39_stuck_orders_and_self_delivery.sql` | `supabase/rollback/20261102040000_r39_stuck_orders_and_self_delivery_rollback.sql` | RPCs `dispatch_open_order_to_app`, `dispatch_mark_stuck_alert_sent`, `dispatch_set_self_delivery`; atualização de `confirm_delivery_with_pin` e `create_order_settlements_on_receive` para `self_delivery = true`. |
| **F6 + F6b** | `supabase/migrations/20261102060000_r39_ratings_rpcs.sql` | `supabase/rollback/20261102060000_r39_ratings_rpcs_rollback.sql` | Colunas aditivas `ratings.flow`, `ratings.hidden_reason`, `ratings.hidden_by` e `rating_reports.status`; RPCs `rating_submit`, `rating_report_create`, `admin_rating_moderate`, `get_order_ratings_for_me`, `get_public_ratings_for_user`, `admin_get_ratings_moderation`. |

---

## 3. Testes Automatizados no CI

- `supabase/tests/40_r39_schema.test.sql`: valida schema, constraints, views, privacidade (`anon` bloqueado) e RLS de `partner_driver_referrals`, `ratings` e `rating_reports`.
- `supabase/tests/50_r39_visibility.test.sql`: valida convites SHA-256, vínculo de veículo por fluxo, modos `OPEN`, `PRIORITY_REFERRED` e `REFERRED_ONLY` no radar (`get_radar_orders`) e no aceite (`accept_order_safe`), incluindo fallback para `OPEN` quando `referrals_enabled = false`.
- `supabase/tests/60_r39_stuck_self_delivery.test.sql`: valida bloqueios com `referrals_enabled = false`, `dispatch_mode != 'REFERRED_ONLY'`, `status = 'PREPARING'`, `stuck_alert_sent_at IS NULL`, proibição em `COLETA`, conclusão por `confirm_delivery_with_pin` pelo vendedor e soma `SELLER + PLATFORM = valor total` em `settlements` com `0` linhas `DRIVER`.
- `supabase/tests/70_r39_ratings.test.sql`: valida `rating_submit` (chave desligada, pedido não concluído, janela expirada, bloqueio de telefone/e-mail/CPF, `self_delivery = true`, terceiros, edição na janela), `rating_report_create`, `admin_rating_moderate` (`HIDDEN` e `VISIBLE`), `get_order_ratings_for_me`, `get_public_ratings_for_user` e `admin_get_ratings_moderation`.
- `scripts/r39_pricing_test.mjs`: testa 486 combinações de `calculateOrderBreakdown` garantindo invariantes financeiras ao centavo com comissão padrão e reduzida.

---

## 4. Arquivos Principais de Frontend e Backend

- **Motor Financeiro e Liquidação:**
  - `apps/mobile/src/lib/pricingEngine.ts`
  - `apps/mobile/src/app/api/asaas/checkout/route.ts`
  - `apps/mobile/src/lib/orderSettlements.ts`
  - `apps/mobile/src/lib/partnerBalance.ts`
- **Componentes de Indicação e Pedido Parado:**
  - `apps/mobile/src/components/referrals/PartnerReferralsSection.tsx`
  - `apps/mobile/src/components/referrals/DriverReferralsSection.tsx`
  - `apps/mobile/src/components/referrals/StuckOrderModal.tsx`
  - `apps/mobile/src/app/convite/[token]/page.tsx`
- **Componentes de Avaliação:**
  - `apps/mobile/src/components/ratings/RatingBadge.tsx`
  - `apps/mobile/src/components/ratings/OrderRatingCard.tsx`
  - `apps/mobile/src/components/ratings/MyReceivedRatingsSection.tsx`
  - `apps/mobile/src/components/ratings/AdminRatingsSection.tsx`
- **Painéis Integrados:**
  - `apps/mobile/src/app/page.tsx` (Cliente)
  - `apps/mobile/src/app/parceiros/batedeira/page.tsx` (Loja B2C / Compradora B2B / Coleta)
  - `apps/mobile/src/app/parceiros/fornecedor/page.tsx` (Fornecedor B2B)
  - `apps/mobile/src/app/parceiros/motoboy/page.tsx` (Motoboy B2C)
  - `apps/mobile/src/app/parceiros/caminhao/page.tsx` (Caminhoneiro B2B / Caçamba Coleta)
  - `apps/mobile/src/app/admin/page.tsx` (Admin → Cidades / Expansão)
- **Termos (Rascunho) e Manuais:**
  - `docs/legal/TERMOS_DE_USO_R39_RASCUNHO.md`
  - `apps/mobile/src/components/PartnerManualModal.tsx`
  - `apps/mobile/src/components/AdminManualModal.tsx`
  - `docs/04_MANUAIS_DE_USO.md`
