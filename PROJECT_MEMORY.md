# PROJECT_MEMORY.md — Memória Completa do Projeto AçaíFood

> **Documento Oficial de Memória Técnica e Operacional**  
> **Última Atualização:** 26 de Novembro de 2026  
> **Localização no PC:** `C:\Users\Administrator\Documents\AppSolutions76\açaifoodV1\PROJECT_MEMORY.md`

---

## 1. Visão Geral do Produto e Negócio

O **AçaíFood** é a primeira plataforma integrada de marketplace e logística sob demanda desenvolvida especificamente para a cadeia de valor do açaí (do fruto ao consumo final).

- **URLs Oficiais de Produção:**
  - Domínio Principal: [https://www.acaifood.app.br](https://www.acaifood.app.br)
  - Espelho de Contingência / Deploy Vercel: [https://acai-food-mobile.vercel.app](https://acai-food-mobile.vercel.app)
- **Google Play Store:** https://play.google.com/store/apps/details?id=br.app.acaifood
- **Empresa Proprietária:** Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)
- **BaaS Financeiro Integrado:** Asaas Gestão Financeira Instituição de Pagamento S.A. (CNPJ 19.540.550/0001-21)
- **Instagram:** @acaifoodapp | **E-mail:** appsolutions76@gmail.com

---

## 2. Atores do Ecossistema (Roles)

1. **Cliente B2C (`cliente`):**
   - Acesso pela raiz `/`.
   - Compra dos 5 tipos de açaí (Tradicional, Médio, Grosso, Especial, Congelado para viagem), refeições executivas/churrascos com acompanhamentos selecionáveis, bebidas e adicionais.
   - Paga exclusivamente via Pix Dinâmico Asaas com Split embutido.
   - Possui o PIN de Entrega de 4 dígitos para liberação do pedido ao motoboy.

2. **Batedeira Artesanal / Loja (`loja` / `batedeira`):**
   - Acesso por `/parceiros/batedeira`.
   - Painel de controle de pedidos em tempo real com alerta sonoro.
   - Impressão térmica de comandas de produção (formatos 58mm e 80mm).
   - Aciona motoboys sob demanda no botão "Chamar Motoboy".
   - Compra frutos no atacado B2B diretamente dos fornecedores.
   - Solicita caçambas para descarte sustentável de caroço (Logística Reversa / ESG).
   - Solicita saques Pix para sua conta de mesma titularidade.

3. **Motoboy Urbano (`motorista` / tipo `motoboy`):**
   - Acesso por `/parceiros/motoboy`.
   - Radar Urbano que exibe pedidos disponíveis por proximidade geográfica (Haversine/OSRM).
   - Transição assistida por GPS: ao aceitar, abre automaticamente o roteamento até a batedeira; ao confirmar a retirada com o PIN de Balcão, redireciona automaticamente para o endereço do cliente.
   - Conclusão da entrega via PIN de 4 dígitos digitado na tela do motoboy.
   - Recebimento imediato do valor líquido do frete na sua subconta Asaas.

4. **Fornecedor Atacadista (`fornecedor`):**
   - Acesso por `/parceiros/fornecedor`.
   - Cadastramento de lotes de frutos (sacas, paneiros, latas) e cotação do dia.
   - Acionamento de fretes pesados via caminhoneiros cadastrados.

5. **Caminhoneiro / Caçambeiro (`motorista` / tipo `caminhao`):**
   - Acesso por `/parceiros/caminhao`.
   - Execução de fretes pesados B2B e transporte de resíduos (caroços de açaí) para usinas de biomassa e compostagem.

6. **Administrador Master (`admin` / `is_admin = true`):**
   - Acesso por `/admin`.
   - Painel consolidado com métricas financeiras reais (GMV, receita bruta e receita líquida pós-taxas Asaas).
   - Mapa ao Vivo com visualização operacional respeitando rigorosamente a LGPD.
   - Fechamento mensal contábil e módulo de Notas Fiscais (NF-e de intermediação).
   - Esteira de aprovação e conciliação de saques.
   - Trilha de auditoria imutável (`admin_audit_log`).

---

## 3. Modelo Financeiro & Engenharia de Pagamentos (Asaas BaaS)

### 3.1. Split de Pagamento na Origem (`SELLER_SPLIT`)
- No momento do checkout, o Pix é gerado tendo a **loja vendedora** como recebedora principal.
- O split da comissão percentual ou fixa da plataforma AçaíFood é retido no próprio ato do pagamento pelo Asaas.
- Os cálculos oficiais de repasse e taxas são centralizados na biblioteca `apps/mobile/src/lib/orderFinance.ts`.

### 3.2. Trava de Liquidez e Liberação Pós-PIN
- O valor da corrida do motoboy fica retido na subconta da loja enquanto o pedido está a caminho.
- Assim que o motoboy valida o **PIN de 4 dígitos** com sucesso (chamada à RPC `check_delivery_pin`), o sistema dispara o repasse automatizado (`/api/settlements/process` ou transferência Asaas interna) do frete para a subconta do motoboy.
- O valor restante dos itens é desbloqueado para saque imediato da batedeira.

### 3.3. Conformidade Regulatória (Banco Central do Brasil)
- Em cumprimento às Resoluções BCB nº 1/2020 e nº 80/2021, saques só são permitidos para contas bancárias sob a **mesma titularidade** (mesmo CPF ou CNPJ) da subconta cadastrada.

### 3.4. Comissões
- Comissão da plataforma sobre venda e frete: **5% a 12%**, definida por cidade no painel admin.

---

## 4. Arquitetura de Software e Estrutura de Pastas

```
açaifoodV1/
├── apps/
│   └── mobile/                          # Frontend Web e PWA (Next.js 16)
│       ├── src/
│       │   ├── app/                     # Next.js App Router (Páginas e APIs)
│       │   │   ├── page.tsx             # Catálogo Principal B2C
│       │   │   ├── admin/               # Módulo do Painel Administrativo
│       │   │   ├── parceiros/           # Painéis de Batedeira, Motoboy, etc.
│       │   │   └── api/                 # Endpoints REST e Webhooks
│       │   │       ├── admin/           # APIs de gestão, fechamento fiscal, mapa
│       │   │       ├── asaas/           # Integração Asaas (webhook, checkout, etc.)
│       │   │       ├── settlements/     # Repasse financeiro pós-entrega
│       │   │       └── user/            # Posição GPS e status de usuários
│       │   ├── components/              # Componentes de interface (UI e Modais)
│       │   ├── lib/                     # Regras de negócio, finanças e clientes API
│       │   │   ├── orderFinance.ts      # Cálculo unificado de valores e taxas
│       │   │   ├── serverOrderPricing.ts# Validação de preços no servidor
│       │   │   ├── apiAuth.ts           # Verificação de tokens JWT e MFA
│       │   │   └── asaasConfig.ts       # Configurações e chamadas à API Asaas
│       │   └── store/
│       │       └── useAppStore.ts       # Estado global da aplicação com Zustand
│       └── public/                      # Assets estáticos, Service Worker (PWA), manifest
├── supabase/
│   ├── migrations/                      # Migrações PostgreSQL versionadas
│   └── rollback/                        # Scripts de contingência
├── docs/                                # Manuais, auditorias e documentação detalhada
├── .agents/
│   └── AGENTS.md                        # Diretrizes para agentes autônomos
├── GEMINI.md                            # Contexto mestre para agentes Gemini/Antigravity
└── PROJECT_MEMORY.md                    # Esta documentação mestre de memória
```

---

## 5. Regras de Segurança e Banco de Dados

1. **Proteção de PINs (`order_pins`):**
   - Os PINs de confirmação não residem na tabela pública de `orders`.
   - São acessíveis exclusivamente via RPC protegida `get_my_order_pins` com verificação de JWT do usuário logado.
2. **Transições de Estado Auditadas:**
   - Transições de status de pedidos (`PENDING` → `PAID` → `PREPARING` → `READY` → `IN_TRANSIT` → `RECEIVED`) são coordenadas por RPCs `SECURITY DEFINER` (`advance_order_status` e `check_delivery_pin`).
3. **MFA Administrativo:**
   - Rotas sob `/admin` exigem segundo fator de autenticação (TOTP) e checagem rígida das colunas `users.role` e `users.is_admin`.
4. **Proteção Anti-Destrutiva:**
   - Bloqueio rígido em rotas como `/api/admin/clear-data`, permitidas apenas em ambiente isolado com `ALLOW_DESTRUCTIVE_ADMIN_RESET=true`.
5. **LGPD no Mapa ao Vivo:**
   - A API `/api/admin/live-map` nunca expõe as coordenadas geográficas de residências de clientes para administradores ou terceiros.

---

## 6. Procedimentos de Build e Validação

- **Desenvolvimento local:** `npm run dev` (executado a partir da raiz).
- **Validação de Build:** `npm run build` (compilação completa do Next.js via Turbopack).
- **Verificação de Lint:** `npm run lint --prefix apps/mobile`.
- **Deploy:** Vercel via push ao branch `main` do GitHub. Sempre confirmar que o projeto destino é **acai-food-mobile** (conta appsolutions76-5778s).

---

## 7. Histórico de Versões e Marcos Principais

- **R36–R39:** Implementação de cálculo de frete por km mínimo, reformulação do sistema de avaliações e indicações de motoristas, isolamento de segredos de cidades e desbloqueio de pedidos retidos.
- **R40–R45:** Otimização de GPS do motoboy com debounce de alta eficiência, carregamento sob demanda via `next/dynamic` de modais pesados, módulo de Fechamento Fiscal / Notas Fiscais e Mapa ao Vivo protegido por LGPD.
- **R47–R58:** Sistema de contas compartilhadas, aprimoramento do sistema de parceiros e afiliados, migração de banners de anúncios para configuração centralizada na plataforma e remoção de wallet IDs em endpoints públicos de lojas para máxima segurança.

---

## 8. Status Operacional — 26/11/2026

### 8.1 Lojas Parceiras (PARTNER) — Total: 9

| # | Nome | Cidade | Asaas | Split | Situação |
|---|---|---|---|---|---|
| 1 | Loja TESTE AçaíFood | Tapanã/Belém | APPROVED | ✅ | 🧪 Teste — ignorar |
| 2 | CHURRASCO DO B10 | Tapanã/Belém | PENDING_DOCUMENTS | ❌ | ⚠️ Docs pendentes |
| 3 | Açaí do Ricardo | Tapanã/Belém | Não configurado | ❌ | 🔴 Sem subconta |
| 4 | Sr&Sra Açaí Portel | Centro/Portel | Não configurado | ❌ | 🔴 Sem subconta |
| 5 | Gênesis açaí | Pratinha/Icoaraci | APPROVED | ✅ | ✅ Operacional |
| 6 | Açaí do Magno | Centro/Afuá | Não configurado | ❌ | 🔴 Sem subconta |
| 7 | Valderlana Dos Santos Oliveira | Capim marinho/Afuá | PENDING_DOCUMENTS | ❌ | ⚠️ Docs pendentes |
| 8 | Deus Proverá | Tapanã/Belém | PENDING_DOCUMENTS | ❌ | ⚠️ Docs pendentes |
| 9 | Kildere Ramon | Tapanã/Belém | Não configurado | ❌ | 🔴 Sem subconta |

> **Única loja 100% operacional:** Gênesis açaí (Icoaraci).
> Ver `docs/56_STATUS_LOJAS_PARTNER_2026-11-26.md` para mensagens WhatsApp prontas por loja.

---

### 8.2 Motoboys Entregadores (COURIER) — Total: 39

| Status | Qtd | Situação |
|---|---|---|
| ✅ APPROVED (split ativo) | 7 | Operacionais |
| ⏳ PENDING_DOCUMENTS | 2 | Julia, Ruan Farias |
| ❌ NAO_CONFIG (sem subconta) | 30 | Urgente — completar cadastro no app |

> Ver `docs/57_STATUS_MOTOBOYS_COURIER_2026-11-26.md` para lista completa e mensagens WhatsApp por status.

---

### 8.3 Próxima Implementação — R56

**Alerta de localização do estabelecimento** (`LocationAlertModal`):
- Modal one-time controlado por `localStorage` (chave: `location_alert_shown_v1`)
- Exibir apenas para roles: `LOJA`, `BATEDEIRA`, `FORNECEDOR`
- Componente a criar: `apps/mobile/src/components/LocationAlertModal.tsx`
- Incluir no layout: `apps/mobile/src/app/parceiros/layout.tsx`
- Spec completa: `docs/55_R56_ALERTA_LOCALIZACAO_ESTABELECIMENTO_2026-11-26.md`

---

### 8.4 Datas e Marcos de Lançamento

| Data | Marco |
|---|---|
| 14/11/2026 | AçaíFood publicado na Google Play Store |
| 26/11/2026 | Fase ativa de cadastro de lojas, motoboys e clientes |
| 10/12/2026 | Lançamento oficial — Belém |
| 15/12/2026 | Lançamento — Nova Timboteua |
