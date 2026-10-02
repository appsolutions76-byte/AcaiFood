# AçaíFood — Arquitetura Técnica (Atualizado Pós-R12 / Outubro 2026)

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
- **Registro de Aceite de Termos (`terms_acceptances`):** Registro de consentimento de termos de uso, privacidade e mandato BaaS do Asaas.
