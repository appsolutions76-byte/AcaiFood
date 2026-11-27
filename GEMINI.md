# AçaíFood - Memória do Projeto & Diretrizes do Sistema

> Este arquivo fornece a memória e contexto permanente do projeto **AçaíFood** neste computador para o Gemini e Antigravity.

Consulte o arquivo oficial e detalhado de regras e memória em:
👉 [`.agents/AGENTS.md`](file:///c:/Users/Administrator/Documents/AppSolutions76/açaifoodV1/.agents/AGENTS.md)

### Resumo das Diretrizes Principais:
1. **Identificação:** Monorepo AçaíFood (`apps/mobile` em Next.js 15, React 19, Tailwind CSS v4, Supabase, Asaas BaaS).
2. **Ambientes Oficiais:** `https://www.acaifood.app.br/` e `https://acai-food-mobile.vercel.app/`.
3. **Repositório Git:** `https://github.com/appsolutions76-byte/AcaiFood.git` (branch `main`).
4. **Regras de Negócio e Segurança:**
   - Validação física de entregas por PIN de 4 dígitos via RPCs Supabase (`check_pickup_pin` e `check_delivery_pin`).
   - Motor de preços autoritativo no servidor (`apps/mobile/src/lib/pricingEngine.ts`).
   - Saques restritos a subcontas Asaas `APPROVED` via `/api/admin/payout/pay-partner`.
   - Dados sensíveis em `partner_secrets` e RLS restrito.
5. **Idioma:** Respostas e mensagens sempre em Português do Brasil (PT-BR).
