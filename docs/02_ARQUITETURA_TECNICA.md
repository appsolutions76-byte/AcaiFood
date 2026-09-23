# AçaíFood — Arquitetura técnica (estado atual)

> Espelho do código em 23/09/2026. Para o funcionamento do ponto de vista do usuário, veja `01_OPERACAO_DO_APP.md`.

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Front + API | Next.js 16.2.11 (App Router), React 19.2, TypeScript 5, Tailwind CSS 4, Zustand 5, lucide-react, next-themes |
| Banco/Auth/Realtime/Storage | Supabase (Postgres + RLS, Auth por e-mail/senha, Realtime, bucket de mídia) |
| Funções serverless | Rotas `app/api/*` na Vercel + Edge Functions Deno no Supabase |
| Pagamentos | Asaas API v3: Pix, split, subcontas (BaaS), transfers, estornos, webhooks |
| Mapas | Leaflet + OpenStreetMap, rota OSRM; distância de preço em Haversine |
| Hospedagem | Vercel (projeto `acai-food-mobile`, root `apps/mobile`, Node 24) + domínio `acaifood.app.br` |
| CI | GitHub Actions: publica as Edge Functions em todo push na `main` |

> O nome da pasta `apps/mobile` é histórico: **não existe app nativo**. O app é uma PWA web. O plano antigo (React Native/Expo, Mercado Pago, Pagar.me) foi abandonado.

## 2. Estrutura de pastas

```
açaifoodV1/
├─ apps/mobile/                 ← o app (Next.js)
│  ├─ src/app/                  ← páginas e rotas de API
│  │  ├─ page.tsx               (Cliente, 142 KB)
│  │  ├─ admin/page.tsx         (Admin, 264 KB)
│  │  ├─ parceiros/{batedeira,fornecedor,motoboy,caminhao}/page.tsx
│  │  ├─ cadastro, login, apresentacao, politica-de-privacidade, parceiros
│  │  └─ api/                   ← backend (ver §4)
│  ├─ src/components/           ← modais, seções do admin, guardas
│  ├─ src/lib/                  ← regras de negócio no servidor (pricing, saque, auth, Asaas)
│  ├─ src/store/useAppStore.ts  ← estado global + quase toda a lógica do cliente (158 KB)
│  ├─ public/                   ← ícones, banner, PWA manifest, PDFs/imagens de manual
│  └─ vercel.json               ← cron do sweep
├─ supabase/
│  ├─ migrations/               ← 24 migrations (não cobrem todo o banco, ver §5)
│  ├─ functions/                ← 8 Edge Functions
│  └─ config.toml
├─ .github/workflows/deploy.yml
└─ (raiz) documentos, scripts .sql soltos, imagens → ver docs/README.md
```

## 3. Lógica de negócio: onde está cada regra

| Arquivo | Responsabilidade |
|---|---|
| `lib/pricingEngine.ts` | **Fórmula oficial** (servidor): frete, comissões, subsídio, taxa Pix, líquidos, total |
| `lib/partnerBalance.ts` | Saldo disponível para saque de um parceiro |
| `lib/withdrawalApproval.ts` | Aprovar saque: trava atômica, Pix via `/transfers`, marcar pedidos, ledger |
| `lib/asaasTransferHelpers.ts` | Escolhe o destino do Pix (chave → CPF/CNPJ → e-mail → walletId) |
| `lib/founderQuota.ts` | Vagas de fundador e taxa de ativação |
| `lib/apiAuth.ts` | `authorizeRequest` (JWT Supabase + papéis), segredos internos, webhook |
| `lib/asaasConfig.ts` | Chave e URL do Asaas (env ou Vault `get_platform_asaas_key`) |
| `lib/payoutCalc.ts` | Fórmula antiga, usada só pela rota legada `transfer` |
| `lib/thermalPrinter.ts` | Comanda térmica (recalcula o frete sozinho ⚠️) |
| `store/useAppStore.ts` | Login/cadastro, carrinho, `criarPedido`, `acaoPedido` (transições), taxas do cliente, cidades, produtos, realtime, `admin_balances` |

## 4. API (rotas Next em `src/app/api`)

| Rota | Métodos | Quem pode | Função |
|---|---|---|---|
| `asaas/checkout` | POST | logado (dono do pedido) | Recalcula o total e cria a cobrança Pix com split |
| `asaas/status` | GET / POST | GET público / POST webhook | Consultar pagamento / **webhook de pagamento e estorno** |
| `asaas/refund` | POST | logado | Estorno pelo valor real do Asaas |
| `asaas/activation` | GET / POST | logado | Status e cobrança da taxa de ativação |
| `asaas/subaccount` | POST / DELETE | logado | Criar/encerrar subconta Asaas |
| `asaas/documents` | GET / POST | parceiro | Documentos da subconta (**não usado pela interface**) |
| `asaas/link-wallet` | POST | logado (próprio id) | Vincular um walletId manualmente ⚠️ |
| `asaas/withdrawals` | GET / POST | parceiro | Ver saldo / pedir saque |
| `asaas/sweep` | POST | cron, segredo ou admin | Pagamento automático dos saques pendentes |
| `asaas/transfer` | POST | admin | Repasse legado ("Pagar e Zerar") |
| `admin/withdrawals` (+ `[id]/approve`, `[id]/reject`) | GET / POST | admin | Fila de saques |
| `admin/payout-settings` | GET / POST | admin | Pagamento automático, horário, mínimo |
| `admin/activation-config` | GET / POST | admin | Taxa de ativação e vagas de fundador |
| `admin/ads`, `admin/media-upload` | GET / POST / DELETE | admin | Anúncios e mídia |
| `admin/delete-user`, `admin/clear-data`, `admin/reset-balances` | POST | admin | Operações destrutivas |
| `ads` | GET / POST | público | Listar anúncios / contar view e clique |
| `support` | GET / POST | logado/admin | Chat de suporte |
| `user/location` | POST | logado | Atualizar GPS |
| `user/status` | POST | **sem autenticação** ⚠️ | Pausar/ativar/bloquear usuário |

## 5. Banco de dados (Supabase/Postgres)

**Tabelas criadas pelas migrations:** `users`, `storefronts`, `products`, `orders`, `order_items`, `order_status_history`, `splits`, `pin_attempt_log`, `print_log`, `disputes`, `notification_queue`, `incident_logs`, `support_messages`, `partner_ledger`, `payout_failures`, `refund_history`, `account_status_history`, `withdrawal_requests`.

**Tabelas usadas pelo código mas SEM migration** (criadas à mão no painel): `platform_settings`, `cities`, `admin_balances`, `order_messages`, `order_tracking`, `commercial_ads`. Reconstruir o banco só a partir das migrations **não funciona**.

**Principais colunas de `orders`:** `buyer_id`, `seller_storefront_id`, `driver_id`, `order_type` (B2C/B2B/COLETA), `status`, `products_subtotal`, `delivery_distance_km`, `applied_*` (taxas), `delivery_pin`/`pin_hash`/`pin_attempts`, `asaas_payment_id`/`asaas_charge_status`, timestamps de cada etapa, `payout_seller_done`/`payout_driver_done`, endereço e coordenadas de entrega.

**Funções (RPC):** `transition_order_status`, `accept_order_atomic`, `generate_delivery_pin`, `check_delivery_pin`, `log_order_print`, `is_admin`, `get_platform_asaas_key` (só service_role), `reset_admin_system_data`, `anonymize_order_locations`, `increment_admin_balances_on_received`.

**Triggers:** `trg_validate_order_fees` (sobrescreve as taxas `applied_*` com as globais em todo INSERT/UPDATE), `check_delivery_pin` (exige PIN para ir a `RECEIVED`), `trg_prevent_role_escalation` (bloqueia autopromoção a admin e autorreativação), `trigger_increment_admin_balances`.

**Configurações guardadas fora do lugar:** a taxa de ativação, as vagas de fundador e **toda a lista de anúncios** ficam como JSON na coluna `platform_settings.asaas_platform_wallet_id`.

## 6. Edge Functions (`supabase/functions`)

| Função | Situação |
|---|---|
| `asaas-webhook` | Ativa. Recebe eventos do Asaas (valida o header `asaas-access-token`) |
| `asaas-checkout` | Chamada pelo `checkout` como 1ª opção. ⚠️ aceita valor e split do body |
| `asaas-status` | Fallback do `status` |
| `asaas-create-subaccount` | Chamada pelo cadastro (store) |
| `payout-sweep` | Desativada (só responde aviso) → **remover** |
| `remove-account`, `clear-orders` | Não usadas pelo app → **remover** |
| `debug-orders` | Pública (`verify_jwt=false`), expõe um pedido real → **remover já** |

## 7. Variáveis de ambiente

Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `ASAAS_WEBHOOK_TOKEN`, `INTERNAL_API_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_PLATFORM_PIX_KEY`.
Supabase Secrets: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
`.env*` e `.vercel` estão no `.gitignore` (correto).

## 8. Deploy

- **Front/API:** integração Git da Vercel (root `apps/mobile`).
- **Edge Functions:** `deploy.yml` roda `supabase functions deploy` (todas) em cada push na `main`.
- **Banco:** **manual** (SQL Editor + migrations aplicadas à mão). Duas migrations têm `\$\$` escapado (`20260901020000`, `20260901040000`) e falhariam num `supabase db push` limpo.
- **Testes automatizados:** nenhum.
