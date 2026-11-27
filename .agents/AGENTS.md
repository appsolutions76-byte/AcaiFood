# Workspace Rules & Context for AçaíFood

- **Documentação de Memória Mestre:** Consulte sempre [PROJECT_MEMORY.md](file:///c:/Users/Administrator/Documents/AppSolutions76/açaifoodV1/PROJECT_MEMORY.md) e [GEMINI.md](file:///c:/Users/Administrator/Documents/AppSolutions76/açaifoodV1/GEMINI.md) para regras de negócio e fluxos detalhados.
- **Official Production Link:** Always use `https://www.acaifood.app.br/` (and `https://acai-food-mobile.vercel.app/`) when referencing or displaying the deployed production web app to the user.
- **Project Architecture:** Monorepo using Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand 5 (state management), Lucide Icons, and Supabase (PostgreSQL 15+, Auth, Realtime, Storage).
- **Gateway Financeiro & BaaS:** Asaas API v3 com Split de pagamento na origem (`SELLER_SPLIT`), repasse de frete pós-validação de PIN de 4 dígitos e saques estritos com mesma titularidade (Resoluções BCB nº 1/2020 e 80/2021).
- **Code Quality Standards:**
  - TypeScript strict typing (avoid `any` where possible).
  - Modern Next.js server/client components separation with explicit `'use client'` where hooks or browser APIs are used.
  - Carregamento sob demanda (`next/dynamic` com `ssr: false`) para componentes pesados como mapas Leaflet e modais.
  - Responsive, mobile-first design prioritizing smooth UI/UX on mobile devices and desktop views.
  - Safe Supabase queries with proper error handling and optimistic UI updates where applicable.
  - Não expor dados residenciais de clientes no mapa operacional (`/api/admin/live-map`), respeitando a LGPD.
  - Isolamento estrito de PINs de entrega (`order_pins`) via RPCs autenticadas (`SECURITY DEFINER`).
- **Idioma de Comunicação:** Responder sempre em Português do Brasil (PT-BR).
