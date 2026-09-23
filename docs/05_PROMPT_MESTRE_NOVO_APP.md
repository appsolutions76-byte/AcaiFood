# Prompt mestre: construir o AçaíFood do zero (v2, 23/09/2026)

> Cole este documento inteiro no agente construtor (Antigravity, Claude Code, etc.). Ele descreve o produto que já existe em produção, com as correções da Sexta Auditoria **já incorporadas no desenho**. Onde houver `<<DECIDIR>>`, confirme antes de construir.

---

## 0. Papel e regras de trabalho

Você é o engenheiro principal do **AçaíFood**, um marketplace da cadeia do açaí no Pará, Brasil. Construa uma aplicação de produção com dinheiro real. Regras inegociáveis:

1. **Código em inglês** (tabelas, colunas, funções, rotas, variáveis, enums). **Textos de tela em português do Brasil.**
2. O participante que bate e vende açaí é **um único papel: "Loja/Batedeira"** (`role = 'store'`). Nunca dividir em dois.
3. **Toda conta de dinheiro acontece no servidor**, em **um único módulo** (`pricing`). O cliente só exibe o que o servidor devolve. Valores em **centavos inteiros** (`bigint`).
4. **Nunca confiar no cliente** para: preço, subtotal, distância, taxa, status de pagamento, destino de repasse, papel do usuário.
5. **Nenhum segredo no código.** Tudo em variável de ambiente, com falha fechada (sem fallback literal).
6. Trabalhe em fases (§14). Ao fim de cada fase: migrations aplicáveis do zero, testes passando e um resumo do que foi feito.

## 1. Produto

Conecta 5 participantes e 1 administrador em 3 fluxos, com pagamento Pix (Asaas), confirmação física por **PIN de 4 dígitos** e liquidação automática para subcontas Asaas dos parceiros.

| Papel (`role`) | Nome na tela | Faz |
|---|---|---|
| `customer` | Cliente | Compra açaí batido de uma Loja/Batedeira |
| `store` | Loja/Batedeira | Vende B2C, compra latas no B2B, pede coleta de caroço |
| `supplier` | Fornecedor | Vende latas de açaí no atacado para Lojas/Batedeiras |
| `courier` | Motoboy | Entrega B2C (Loja → Cliente) |
| `hauler` | Caminhão/Caçamba | Frete B2B (Fornecedor → Loja) e Coleta (Loja → destino do caroço) |
| `admin` | Administrador | Configura, audita e media tudo |

## 2. Fluxos

**B2C:** Cliente escolhe loja → carrinho (1 loja por pedido) → endereço (cadastro, GPS atual ou ponto digitado) → servidor calcula o total → Pix → pago → Loja aceita e prepara (imprime comanda) → "Chamar moto" → Motoboy aceita no radar (aceite atômico) → retira → chega → **cliente informa o PIN** → motoboy digita → `RECEIVED` → liquidação.

**B2B:** Loja/Batedeira (compradora) escolhe fornecedor → latas → Pix → Fornecedor aceita e separa → "Chamar caminhão" → Caminhão aceita → entrega → **Loja/Batedeira informa o PIN** → liquidação.

**Coleta:** Loja/Batedeira pede a retirada do caroço → paga **somente o frete da coleta** (sem subtotal de produto) → pedido vai direto ao radar do caminhão → retirada → **PIN da Loja/Batedeira** → liquidação só para o caminhão. O caroço vai para biomassa, olarias, adubo ou ecopontos; **não volta ao fornecedor**.

## 3. Máquina de estados (única fonte: função no banco)

```
CREATED → AWAITING_PAYMENT → PAID → PREPARING → READY → DELIVERING → DELIVERED → RECEIVED → SETTLED
Coleta: PAID → READY (pula PREPARING)
Laterais: CANCELLED (antes de DELIVERING), REFUND_REQUESTED → REFUNDED,
          PIN_LOCKED (5 erros) → DISPUTE_OPEN → (admin) RECEIVED | REFUNDED,
          DELIVERY_FAILED → DISPUTE_OPEN
```

| Transição | Quem pode |
|---|---|
| → `PAID` | **somente o webhook do Asaas** (service_role), depois de conferir `payment.value == order.total_cents` |
| `PAID → PREPARING`, `PREPARING → READY` | vendedor dono do pedido |
| `READY → DELIVERING` | motorista do tipo certo, via `accept_order(order_id)` atômico usando `auth.uid()` |
| `DELIVERING → DELIVERED` | o motorista atribuído |
| `DELIVERED → RECEIVED` | somente `verify_pin(order_id, pin)` chamado pelo motorista atribuído |
| `→ CANCELLED` | comprador ou vendedor, antes de `DELIVERING` (dispara estorno) |
| qualquer override | admin, com motivo obrigatório (auditado) |

Toda transição passa por `transition_order_status(order_id, to_status, reason)`. A função valida a matriz, o papel do chamador **e se ele é parte do pedido**, e **retorna erro se for inválida**. `UPDATE` direto em `orders.status` fica proibido para `authenticated`. Todo passo grava `order_status_history`.

## 4. PIN

- Gerado no servidor quando o pedido vira `PAID`. Guardar **somente o hash** (bcrypt/pgcrypto) e mostrar o PIN **apenas ao recebedor** (cliente no B2C, Loja/Batedeira no B2B e na Coleta), por uma RPC que confere `auth.uid()`.
- `verify_pin`: só o motorista atribuído; 5 tentativas; intervalo mínimo de 5 s; log em `pin_attempt_log`; na 5ª falha vai para `PIN_LOCKED`.
- Admin pode "Forçar baixa" com justificativa (auditado).

## 5. Precificação (módulo único `pricing`, servidor)

Entradas: `order_type`, itens (ids + quantidades), `store_id`/`supplier_id`, coordenadas de origem (do cadastro do vendedor) e de destino (endereço validado), `city_id` do pedido.

1. `subtotal` = Σ(preço **atual do catálogo no banco** × quantidade). Zero na Coleta.
2. `distance_km` = rota calculada no servidor (OSRM/serviço de rotas; fallback Haversine × 1,3). Limite máximo configurável por cidade.
3. Taxas = `platform_settings` (global) **mesclado com `city_rates` da cidade do pedido**:
   - B2C: `sale_fee_pct`, `delivery_mode` (KM|FIXED), `delivery_fee_per_km`, `delivery_fixed_fee`, `delivery_platform_fee_pct`
   - B2B e Coleta: os mesmos campos, por fluxo.
   - `pix_fee_cents` e `pix_fee_split_actors` (1, 2 ou 3).
4. `delivery_total` = FIXED ? fixo : km × tarifa.
5. `seller_subsidy` = `delivery_total` × `frete_subsidy_pct` do vendedor.
6. `buyer_total` = `subtotal` + `delivery_total` − `seller_subsidy`.
7. `seller_net` = `subtotal` × (1 − `sale_fee_pct`) − `seller_subsidy` − parte da taxa Pix.
8. `driver_net` = `delivery_total` × (1 − `delivery_platform_fee_pct`) − parte da taxa Pix.
9. `platform_net` = `buyer_total` − `seller_net` − `driver_net` − taxa Pix.

**Snapshot imutável:** ao criar a cobrança, grave em `order_financials` (1:1 com o pedido) todos os valores **e** as taxas usadas. Carrinho (via `POST /api/orders/quote`), cobrança, comprovante impresso, painel admin e liquidação **leem esse snapshot**; nada recalcula depois. Mudar uma taxa afeta só pedidos novos.

Teste unitário obrigatório: B2C/B2B/Coleta × KM/FIXED × com e sem subsídio × cidade com e sem tarifa própria × 1, 2 e 3 atores de taxa Pix. A soma `seller_net + driver_net + platform_net + pix_fee` tem que ser exatamente `buyer_total`.

## 6. Dinheiro: modelo financeiro

`<<DECIDIR>>` Modelo padrão (recomendado): **liquidação depois do PIN para subconta aprovada.**

1. O Pix da cobrança cai na conta da plataforma (sem split na cobrança).
2. Em `RECEIVED`: lançar no `ledger_entries` o crédito do vendedor e do motorista (idempotente por `order_id + party`).
3. O job de liquidação (a cada 15 min ou imediatamente) faz transferência interna Asaas **para o `walletId` da subconta com status `APPROVED`**, com `idempotency key = settlement_id`. Sucesso: `SETTLED`. Falha: nova tentativa com backoff e `payout_failures`.
4. Parceiro sem subconta aprovada: o crédito fica **retido** (visível como "a liberar") até a aprovação.
5. **Nunca** enviar Pix para chave digitada pelo usuário. O parceiro saca da própria subconta (app Asaas).
6. Estorno antes de `RECEIVED`: estorno total da cobrança, sem ledger a desfazer. Depois de `RECEIVED`: só o admin, via disputa, com lançamento de débito.

Alternativa (se o Asaas exigir): split na cobrança só para o vendedor com subconta aprovada; frete retido e liquidado depois do PIN. Nesse caso **nunca** pode existir um segundo caminho de repasse para o mesmo valor.

## 7. Ativação de parceiro

- Taxa única configurável (hoje R$ 12,90) por Pix, `externalReference = ACTIVATE_<userId>`. "Pagou" = existe cobrança `RECEIVED/CONFIRMED` com essa referência.
- Primeiros N parceiros (configurável, hoje 50) são fundadores isentos. Guardar como flag `is_founder` atribuída de forma transacional (sem inferir pela ordem de cadastro).
- Criar a subconta Asaas (dados reais: `companyType` correto — MEI/ME/LTDA — e renda informada pelo usuário). Guardar `asaas_account_id`, `wallet_id`, `api_key` (criptografada, só service_role). Status da subconta só pelo webhook `ACCOUNT_STATUS_*`; aprovada = `GENERAL_APPROVAL`.
- Tela de envio de documentos dentro do app.

## 8. Dados (Postgres/Supabase): tabelas mínimas

`profiles` (id = auth.uid, role, name, phone, city_id, address, lat, lng, cpf_cnpj, status, is_founder, created_at) · `partner_accounts` (user_id, asaas_account_id, wallet_id, api_key_encrypted, status, approved_at) · `cities` (id, name, state, active) · `city_rates` (city_id, order_type, …campos do §5) · `platform_settings` (**colunas tipadas**, uma linha) · `stores` (owner_id, name, logo, banner, frete_subsidy_pct, accepts_orders) · `products` (store_id, kind [acai_popular|acai_medio|acai_grosso|acai_branco|lata|extra], name, description, image_url, price_cents, available) · `orders` · `order_items` · `order_financials` · `order_status_history` · `pin_attempt_log` · `ledger_entries` (party_id, order_id, type credit|debit, amount_cents > 0, status HELD|READY|SETTLED, settlement_id) · `settlements` (party_id, amount_cents, asaas_transfer_id, status, idempotency_key) · `payout_failures` · `refunds` · `disputes` · `incidents` · `order_messages` · `support_messages` · `ads` (tabela própria: type banner|story, media_url, link, active, period) · `ad_events` (append-only, view|click) · `print_log` · `audit_log` (ações de admin).

**Todas** as tabelas criadas por migrations versionadas. `supabase db reset` precisa reconstruir o banco inteiro.

## 9. Segurança (critérios de aceite)

- RLS em todas as tabelas. `authenticated` **sem UPDATE genérico** em `orders`, `profiles`, `partner_accounts` e tabelas financeiras. Mudanças só por RPC `SECURITY DEFINER` que usam `auth.uid()` (nunca um id vindo do parâmetro) e checam papel e posse.
- O radar mostra uma **view** sem PIN, telefone ou endereço completo (bairro e distância); o endereço completo só aparece depois do aceite, para o motorista atribuído.
- O papel do usuário é definido pelo servidor no cadastro; ninguém promove a si mesmo; `status` (bloqueio) só o admin muda.
- Webhook Asaas: token só por header, comparação em tempo constante, falha fechada, idempotência por `event.id`, e **conferir o valor pago**.
- Rotas admin: JWT com `role = admin` verificado no banco. Segredos de cron/webhook **não** dão acesso admin.
- Cron: aceitar o método que a Vercel usa (GET) + `Authorization: Bearer CRON_SECRET`.
- Sem Edge Functions ou rotas de debug em produção. Logs sem CPF, chave Pix ou token.
- LGPD: política de privacidade com o Asaas identificado como prestador BaaS; anonimizar localização de pedidos antigos.
- Rate limit em login, PIN, checkout e webhooks.

## 10. Telas

**Público:** landing `/apresentacao`, `/parceiros`, `/cadastro` (por papel), `/login`, `/privacidade`.
**Cliente:** lojas da cidade (com banners/stories), vitrine da loja, carrinho, endereço (3 opções), Pix (QR + copia-e-cola, status em tempo real), meus pedidos (linha do tempo, PIN, chat, ligar/WhatsApp), cancelar.
**Loja/Batedeira:** pedidos em tempo real com alerta sonoro, aceitar/recusar, imprimir comanda (bobina 58/80 mm), chamar moto, cardápio base + extras, subsídio de frete, compras B2B, pedir coleta, **carteira** (a liberar / liberado / histórico de liquidações, com o selo "Serviços financeiros Asaas"), ativação e documentos, compartilhar a loja.
**Fornecedor:** preço e disponibilidade da lata, pedidos B2B, imprimir, chamar caminhão, carteira.
**Motoboy / Caminhão:** online/offline, radar (B2B/Coleta para caminhão), aceitar, navegação GPS, retirada/chegada, digitar PIN, carteira.
**Admin:** Dashboard (GMV, receita, por fluxo/cidade/período, lido de `order_financials`), Usuários, Pedidos (forçar baixa, estorno, disputa), Cidades e tarifas, Ocorrências, Ativações, Anúncios, Suporte, **Liquidações** (fila, falhas, reprocessar, retidos por subconta pendente) e Auditoria (`audit_log`).

## 11. API do servidor (Next.js Route Handlers)

`POST /api/orders/quote` · `POST /api/orders` (cria a partir dos itens; o servidor calcula tudo) · `POST /api/orders/:id/checkout` · `POST /api/orders/:id/cancel` · `POST /api/webhooks/asaas` · `POST /api/partners/activation` · `POST /api/partners/subaccount` · `GET/POST /api/partners/documents` · `GET /api/wallet` · `GET|POST /api/cron/settlements` · rotas `/api/admin/*` (settings, cities, users, orders, settlements, ads, incidents, support). Transições simples de pedido: RPCs do §3.

## 12. Stack

Next.js (App Router) + React + TypeScript strict + Tailwind + Zustand (só estado de UI) · Supabase (Postgres, Auth, Realtime, Storage) · Asaas API v3 · Leaflet/OSM + OSRM · Vercel (cron) · PWA instalável · Vitest (unitários) + Playwright (e2e dos 3 fluxos). Componentes pequenos: nenhum arquivo acima de ~600 linhas; código organizado por domínio (`orders`, `pricing`, `payments`, `settlements`, `catalog`, `admin`).

## 13. Não-funcionais

Mobile-first, tema claro/escuro, tempo real, funciona em 3G, acessível (contraste, tamanhos de toque), erros amigáveis em PT-BR, fuso `America/Belem`, moeda BRL.

## 14. Fases de entrega

1. **Fundação:** schema + RLS + migrations + auth/perfis + cidades/tarifas + `pricing` com testes.
2. **B2C ponta a ponta** em sandbox Asaas: catálogo, pedido, Pix, webhook, estados, radar, PIN.
3. **Liquidação:** ledger, subcontas, transfer idempotente, carteira, fila admin.
4. **B2B e Coleta.**
5. **Admin completo**, anúncios, suporte, ocorrências, impressão.
6. **Endurecimento:** e2e, testes de RLS (tentar fraudar como cada papel), rate limit, observabilidade, checklist de homologação BaaS do Asaas.

**Pronto quando:** os testes de fraude falham como esperado (pagar menos, marcar como pago, ver PIN alheio, mudar status alheio, sacar duas vezes, trocar destino do repasse, bloquear outro usuário), e o mesmo pedido mostra **o mesmo valor** no carrinho, no Pix, no comprovante, no painel e na liquidação.
