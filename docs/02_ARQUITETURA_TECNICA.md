# AçaíFood — Arquitetura Técnica (Atualizado Pós-R16 / 06 de outubro de 2026)

> **Documentação de Engenharia e Arquitetura do Sistema AçaíFood.**  
> **Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|---|---|---|
| **Frontend & API Routes** | Next.js 16.2.11 (App Router), React 19.2, TypeScript 5, Tailwind CSS 4, Zustand 5, Lucide Icons | PWA responsiva com SSR e Client Components otimizados |
| **Banco de Dados & Auth** | Supabase (PostgreSQL 15+, Row Level Security - RLS, Supabase Auth JWT, Realtime) | Regras estritas de segurança, isolamento de PINs e auditoria |
| **Gateway & BaaS** | Asaas API v3 (Cobranças Pix Dinâmicas, Subcontas BaaS, Webhooks com validação de payload/tokens) | Instituição de pagamento homologada |
| **Logística & Geolocalização** | Leaflet + OpenStreetMap + Roteamento OSRM + Cálculo Haversine | Radar com privacidade aproximada |
| **Hospedagem & CI/CD** | Vercel (Production) + GitHub Actions | Deploy contínuo com builds validados |

---

## 2. Estrutura do Repositório

```
açaifoodV1/
├── apps/mobile/                     ← Monorepo Next.js Web/PWA
│   ├── src/app/                     ← Rotas de páginas e API
│   │   ├── page.tsx                 (Painel do Cliente)
│   │   ├── admin/page.tsx           (Painel Administrativo Master)
│   │   ├── parceiros/               (Painéis Batedeira, Fornecedor, Motoboy, Caminhão)
│   │   ├── cadastro, login, apresentacao, politica-de-privacidade
│   │   └── api/                     ← Endpoints de backend (asaas, admin, settlements, terms, support)
│   ├── src/components/              ← Componentes UI, modais (PixModal, comanda, radar)
│   ├── src/lib/                     ← Lógica de backend (pricingEngine, apiAuth, asaasConfig, withdrawalApproval)
│   ├── src/store/useAppStore.ts     ← Gerenciador de estado global do cliente
│   ├── public/                      ← Manifest PWA, ícones e comprovantes
│   └── vercel.json                  ← Configurações de deploy e cron jobs
├── supabase/
│   ├── migrations/                  ← Migrações versionadas do banco (incluindo R12)
│   └── rollback/                    ← Scripts de reversão e contingência
└── docs/                            ← Manuais de uso, auditorias e documentação técnica
```

---

## 3. Segurança e Controle de Acesso

- **Autenticação Segura:** Autenticação baseada em JWT do Supabase. A checagem de perfil de administrador é realizada consultando diretamente as colunas confiáveis `users.role` e `users.is_admin` no banco, sem confiar em metadados editáveis pelo cliente.
- **Isolamento de PINs (`order_pins`):** Os códigos de confirmação de entrega e retirada são armazenados em tabela separada da tabela `orders`, acessíveis apenas pelo comprador (entrega), loja (retirada) e administradores via RPC autenticada `get_my_order_pins`. Motoristas e terceiros não têm acesso de leitura aos PINs.
- **RPCs Seguras (`advance_order_status` & `check_delivery_pin`):** Transições de status de pedidos são executadas por funções `SECURITY DEFINER` que validam estritamente o papel do ator (comprador, loja, motorista atribuído ou admin), impedindo manipulação direta via cliente.
- **Trilha de Auditoria (`admin_audit_log`):** Todas as ações críticas de administração (como baixa forçada com justificativa obrigatória, exclusões e conciliações) são registradas com data, hora, IP, ator e estado anterior/posterior.
- **Registro de Aceite de Termos (`terms_acceptances`):** Registro de consentimento de termos de uso, privacidade e mandato BaaS do Asaas. A versão vem só do servidor (`lib/legalVersions.ts`).

### 3.1 Mudanças do R15/R16 (outubro de 2026)

| Tema | Como funciona |
|---|---|
| **MFA do admin** | Toda conta admin precisa de sessão `aal2` (TOTP) nas rotas de admin (`lib/apiAuth.ts`). Cron só com `Authorization: Bearer CRON_SECRET`. |
| **Privacidade de `users`** | `SELECT` por coluna: usuários logados não leem CPF/CNPJ, chave Pix, data de nascimento, renda, e-mail, endereço fiscal nem dados da subconta de outras pessoas; `anon` não lê `users`. O próprio perfil vem da RPC `get_my_profile_json()`. O admin lê pela rota `/api/admin/users`. |
| **Campos financeiros** | Trigger `protect_users_financial_fields`: só `service_role` ou admin mudam `asaas_account_status`, `asaas_wallet_id`, `asaas_account_id`, `split_enabled` e o detalhe da conta. |
| **Chaves das subcontas** | Em `partner_secrets` (só `service_role`). |
| **Situação da subconta** | `users.asaas_account_status` + `asaas_account_status_detail` (commercialInfo, bankAccountInfo, documentation, general). Atualizada por `/api/asaas/account-webhook` (token obrigatório), `/api/asaas/account-status-sync` (cron diário e botão) e `/api/asaas/documents`. |
| **Preço no servidor** | `lib/serverOrderPricing.ts` recalcula itens e distância; o checkout ignora valores do navegador. |
| **Saque** | `lib/withdrawalApproval.ts`: só para `walletId` de subconta `APPROVED`, valor limitado ao saldo do servidor, idempotência por `transfer_attempt_id`/`externalReference`, resposta incerta do Asaas → `PROCESSING`. |
| **PIN** | Migration `20261006010000`: sem PIN mestre; só o motorista atribuído valida; `anon` sem `EXECUTE`. Webhook só gera PIN quando muda o pedido para `PAID`. |
| **Radar** | `get_driver_radar()` usa `store_name` e coordenadas com 2 casas (~1 km), sem dados do cliente. |
| **Log de admin** | `admin_audit_log` só aceita inclusão (trigger). Tela "Conformidade → Log de auditoria" no admin. |
| **Configuração** | `platform_config` (key/value JSON) para ativação e suporte; `monthly_sla` para a disponibilidade mensal. |

### 3.2 Testes automáticos (CI)

`.github/workflows/deploy.yml` roda:

- `tsc` e `npm run build`;
- `scripts/ci_guards.sh` (segredo em `NEXT_PUBLIC_`, PIN com `Math.random`, e-mail inventado, token na URL, contador de saque no navegador);
- `supabase/tests/run_ci.sh`: Postgres 16 limpo + stub do Supabase + migrations R15/R16 + testes de PIN (12 casos), privacidade de `users`, radar, log de admin e `platform_config`/`monthly_sla`.

Os testes de API com Asaas sandbox (checkout com valor adulterado, saque sem conta aprovada, webhook sem token) ainda são manuais; ver `20_PROMPT_CORRECOES_R16.md`.
