# AçaíFood — Contexto & Memória do Projeto

Consulte a memória mestre em [PROJECT_MEMORY.md](file:///c:/Users/Administrator/Documents/AppSolutions76/açaifoodV1/PROJECT_MEMORY.md) e [GEMINI.md](file:///c:/Users/Administrator/Documents/AppSolutions76/açaifoodV1/GEMINI.md).

## Produção Oficial
- Produção: https://www.acaifood.app.br/
- Espelho Vercel: https://acai-food-mobile.vercel.app/

## Comandos Principais
- Iniciar ambiente de desenvolvimento: `npm run dev`
- Gerar build de produção: `npm run build`
- Validação de tipagem e lint: `npm run lint --prefix apps/mobile`

## Stack
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Zustand 5, Supabase (PostgreSQL 15+, Auth JWT, Realtime), Asaas API v3 (BaaS Pix com Split).

## Regras Críticas
1. Split Asaas na origem (`SELLER_SPLIT`); repasse do frete para motoboy somente após validação bem-sucedida do PIN de 4 dígitos.
2. Saques de batedeiras e motoristas somente sob mesma titularidade (CPF/CNPJ) conforme Resoluções BCB 1/2020 e 80/2021.
3. Isolamento estrito de PINs na tabela `order_pins` acessível apenas via RPC autenticada `get_my_order_pins`.
4. Transições de status de pedidos via RPCs `SECURITY DEFINER` (`advance_order_status`, `check_delivery_pin`).
5. Proteção anti-destrutiva e respeito à LGPD no Mapa ao Vivo.
6. Sempre responder em Português do Brasil (PT-BR).
