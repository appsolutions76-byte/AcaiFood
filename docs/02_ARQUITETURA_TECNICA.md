# AçaíFood — Arquitetura Técnica (Atualizado — Novembro de 2026)

> **Documentação de Engenharia e Arquitetura do Sistema AçaíFood.**  
> **Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|---|---|---|
| **Frontend & API Routes** | Next.js 16.2.11 (App Router, Turbopack), React 19.2, TypeScript 5, Tailwind CSS 4, Zustand 5, Lucide Icons | PWA responsiva com SSR, dynamic imports (R40/R41) e Client Components otimizados |
| **Banco de Dados & Auth** | Supabase (PostgreSQL 15+, Row Level Security - RLS, Supabase Auth JWT, Realtime) | Regras estritas de segurança, isolamento de PINs e auditoria |
| **Gateway & BaaS** | Asaas API v3 (Cobranças Pix Dinâmicas, Subcontas BaaS, Split Automático, Webhooks com validação) | Instituição de pagamento homologada |
| **Logística & Geolocalização** | Leaflet + OpenStreetMap + Roteamento OSRM + Haversine | Radar com privacidade aproximada e atualização com debounce de GPS |
| **Contabilidade & Relatórios** | Módulo Fiscal (`/api/admin/fiscal-close`), Motor Financeiro (`lib/orderFinance.ts`) | Fechamento mensal de competência, notas fiscais e conciliação |
| **Hospedagem & CI/CD** | Vercel (Production) + GitHub Actions | Deploy contínuo com builds estritos e testes de integridade |

---

## 2. Estrutura do Projeto

```
açaifoodV1/
├── apps/mobile/                     ← Monorepo Next.js Web/PWA
│   ├── src/app/                     ← Rotas de páginas e API
│   │   ├── page.tsx                 (Página Inicial do Cliente / Catálogo)
│   │   ├── admin/page.tsx           (Painel Administrativo Master)
│   │   ├── parceiros/               (Painéis Batedeira, Fornecedor, Motoboy, Caminhão)
│   │   ├── cadastro, login, apresentacao, politica-de-privacidade
│   │   └── api/                     ← Endpoints de backend
│   │       ├── admin/               (dashboard-stats, live-map, fiscal-close, withdrawals, clear-data, etc.)
│   │       ├── asaas/               (checkout, status, webhook, subaccount, transfer, refund)
│   │       ├── settlements/         (processamento de repasses pós-PIN)
│   │       └── user/                (location com location_updated_at, status)
│   ├── src/components/              ← Componentes UI, modais sob demanda, mapas Leaflet
│   │   ├── admin/                   (AdminFiscalCloseSection, AdminLiveMapSection, AdminWithdrawalsSection, etc.)
│   │   └── ratings/                 (avaliações e indicações de motoristas)
│   ├── src/lib/                     ← Lógica central de negócio e finanças
│   │   ├── orderFinance.ts          (cálculo unificado de valores reais, tarifas Asaas e receita líquida)
│   │   ├── serverOrderPricing.ts    (revalidação de preços no servidor)
│   │   ├── apiAuth.ts               (autenticação JWT, service role e MFA/TOTP)
│   │   └── asaasConfig.ts           (comunicação com a API Asaas)
│   ├── src/store/useAppStore.ts     ← Gerenciador de estado global do cliente (Zustand)
│   └── public/                      ← Manifest PWA, ícones e assets estáticos
├── supabase/
│   ├── migrations/                  ← Migrações SQL versionadas
│   └── rollback/                    ← Scripts de contingência e rollback
└── docs/                            ← Manuais de uso, auditorias e documentação técnica
```

---

## 3. Segurança e Controle de Acesso

- **Autenticação Segura & MFA:** Autenticação baseada em JWT do Supabase. A checagem de perfil de administrador é realizada consultando diretamente as colunas confiáveis `users.role` e `users.is_admin` no banco, exigindo sessão com segundo fator (TOTP) para acesso a rotas administrativas.
- **Isolamento de PINs (`order_pins`):** Os códigos de confirmação de entrega e retirada são armazenados em tabela separada da tabela `orders`, acessíveis apenas pelo comprador (entrega), loja (retirada) e administradores via RPC autenticada `get_my_order_pins`. Motoristas e terceiros não têm acesso de leitura aos PINs.
- **RPCs Seguras (`advance_order_status` & `check_delivery_pin`):** Transições de status de pedidos são executadas por funções `SECURITY DEFINER` que validam estritamente o papel do ator (comprador, loja, motorista atribuído ou admin), impedindo manipulação direta via cliente.
- **Trilha de Auditoria (`admin_audit_log`):** Todas as ações críticas de administração (baixa forçada com justificativa obrigatória, alterações tarifárias, conciliações, estornos e saques) são registradas com data, hora, IP, ator e estado anterior/posterior.
- **Proteção Anti-Destrutiva:** Rotas de limpeza ou alteração em massa (ex: `/api/admin/clear-data`) possuem trava rígida no servidor, sendo desabilitadas por padrão e exigindo `ALLOW_DESTRUCTIVE_ADMIN_RESET=true` em ambiente de contingência.
- **LGPD & Privacidade no Mapa ao Vivo:** A rota `/api/admin/live-map` e o componente do mapa exibem apenas posições operacionais de estabelecimentos e entregadores em serviço. Endereços residenciais de clientes e coordenadas privadas de consumidores não são exibidos no mapa, em estrito cumprimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

---

## 4. Otimizações de Desempenho (R40 & R41)

1. **GPS do Motoboy Debounced:** Transmissão de coordenadas do entregador otimizada com debounce e limitação de taxa (evitando requisições em excesso ao banco de dados).
2. **Carregamento sob Demanda (Dynamic Imports):** Modais pesados (como mapas Leaflet, visualizador de comprovantes Asaas, PixModal, chat de suporte e fechamento fiscal) utilizam `next/dynamic` com `ssr: false`, carregando os bundles JavaScript exclusivamente no momento em que o usuário aciona o modal.
3. **Catálogo Resiliente:** Eliminação de polling em massa no catálogo de produtos e lojas, passando a utilizar sincronização inteligente por eventos e requisições focadas na praça selecionada.
