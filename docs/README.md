# Documentação Oficial do AçaíFood (Atualizado em Novembro de 2026)

Esta pasta `docs/` é a **fonte oficial de verdade** sobre o app e a arquitetura técnica da plataforma AçaíFood.

---

## 📚 Documentos Centrais e Manuais Atualizados

| Arquivo | Descrição e Finalidade |
|---|---|
| [`01_OPERACAO_DO_APP.md`](01_OPERACAO_DO_APP.md) | **Como o app funciona:** Perfis de usuário, fluxos B2C, B2B e Coleta ESG, modelo financeiro `SELLER_SPLIT` via Asaas, GPS inteligente de entregas e regras de contingência. |
| [`02_ARQUITETURA_TECNICA.md`](02_ARQUITETURA_TECNICA.md) | **Arquitetura técnica:** Stack Next.js 16 / Supabase / Asaas, organização de pastas, rotas de API, segurança RLS, isolamento de PINs, otimizações R40/R41 e módulo fiscal. |
| [`04_MANUAIS_DE_USO.md`](04_MANUAIS_DE_USO.md) | **Manuais de uso detalhados por perfil:** Cliente, Batedeira/Loja, Fornecedor B2B, Motoboy, Caminhoneiro, Administrador Master (`/admin`) e orientações para subcontas Asaas. |

---

## 🚀 Rodadas Recentes de Engenharia (R38 a R46)

| Rodada | Documento de Referência | Resumo da Entrega |
|---|---|---|
| **R38** | [`36_R38_SIMULADOR_ADMIN_2026-11-01.md`](36_R38_SIMULADOR_ADMIN_2026-11-01.md) | Simulador econômico no painel `/admin` para cálculo de viabilidade, taxas e projeção de receita. |
| **R39** | [`37_R39_INDICACOES_AVALIACOES_2026-11-02.md`](37_R39_INDICACOES_AVALIACOES_2026-11-02.md) | Módulo de motoristas e caminhoneiros indicados, entrega própria e avaliações de 1 a 5 estrelas. |
| **R40** | [`38_R40_DESEMPENHO_E_GPS_MOTOBOY_2026-11-04.md`](38_R40_DESEMPENHO_E_GPS_MOTOBOY_2026-11-04.md) | Desempenho e GPS do motoboy: debounce de coordenadas, redução de requisições, modais dinâmicos sob demanda (`next/dynamic`). |
| **R41** | [`39_R41_DESEMPENHO_CATALOGO_E_PAINEIS_2026-11-04.md`](39_R41_DESEMPENHO_CATALOGO_E_PAINEIS_2026-11-04.md) | Otimização do catálogo de produtos e lojas, eliminação de polling agressivo e modo leve para entregadores. |
| **R42** | [`40_R42_ADMIN_VALORES_REAIS_TARIFA_ASAAS_2026-11-04.md`](40_R42_ADMIN_VALORES_REAIS_TARIFA_ASAAS_2026-11-04.md) | Painel admin com valores financeiros reais, dedução de tarifa Pix Asaas e receita líquida precisa. |
| **R43** | [`41_R43_FECHAMENTO_MENSAL_NOTAS_FISCAIS_2026-11-04.md`](41_R43_FECHAMENTO_MENSAL_NOTAS_FISCAIS_2026-11-04.md) | Módulo Fechamento Mensal / Notas Fiscais no `/admin` (`/api/admin/fiscal-close`) para apuração fiscal de ISS e exportação contábil. |
| **R44** | [`42_R44_ADMIN_SEGURANCA_LEGADO_VISAO_GERAL_2026-11-04.md`](42_R44_ADMIN_SEGURANCA_LEGADO_VISAO_GERAL_2026-11-04.md) | Trava no servidor para limpeza de dados (`ALLOW_DESTRUCTIVE_ADMIN_RESET`), motor `lib/orderFinance.ts` e visão geral calculada no backend. |
| **R45** | [`43_R45_MAPA_AO_VIVO_ADMIN_2026-11-04.md`](43_R45_MAPA_AO_VIVO_ADMIN_2026-11-04.md) | Aba Mapa ao Vivo no `/admin` (`/api/admin/live-map`) com geolocalização de parceiros operacionais, contadores de status e privacidade LGPD para clientes. |
| **R46** | [`44_R46_RECEITA_BRUTA_E_LIQUIDA_2026-11-04.md`](44_R46_RECEITA_BRUTA_E_LIQUIDA_2026-11-04.md) | Discriminação transparente de Receita Bruta da Plataforma e Receita Líquida pós-tarifas Pix Asaas. |

---

## 🛡️ Segurança & Conformidade Bancária Asaas

- [`docs/legal/TERMOS_DE_USO_ACAI_FOOD.md`](legal/TERMOS_DE_USO_ACAI_FOOD.md): Termos de Uso oficiais da plataforma AçaíFood (Eletromecânica Baia Ltda - CNPJ 42.035.623/0001-40).
- [`docs/legal/POLITICA_DE_PRIVACIDADE_ACAI_FOOD.md`](legal/POLITICA_DE_PRIVACIDADE_ACAI_FOOD.md): Política de Privacidade e Proteção de Dados (LGPD).
- [`docs/legal/TERMOS_E_POLITICAS_ASAAS.md`](legal/TERMOS_E_POLITICAS_ASAAS.md): Referências oficiais aos termos do Asaas Gestão Financeira Instituição de Pagamento S.A. (BACEN).
- [`docs/legal/MANDATO_SUBCONTA_ASAAS.md`](legal/MANDATO_SUBCONTA_ASAAS.md): Instrumento de mandato para abertura e movimentação de subcontas Asaas.
- [`docs/legal/CONSENTIMENTO_PIX_ALEATORIO.md`](legal/CONSENTIMENTO_PIX_ALEATORIO.md): Consentimento para criação e uso de chave Pix aleatória (EVP).
- [`docs/seguranca/PROCESSO_DE_INCIDENTES.md`](seguranca/PROCESSO_DE_INCIDENTES.md): Protocolo de resposta a incidentes de segurança e operacionais.
- [`docs/seguranca/REGISTRO_DE_VULNERABILIDADES.md`](seguranca/REGISTRO_DE_VULNERABILIDADES.md): Registro e matriz de mitigação de vulnerabilidades.
- [`docs/seguranca/BACKUP_E_RESTAURACAO.md`](seguranca/BACKUP_E_RESTAURACAO.md): Políticas de backup contínuo (PITR) e recuperação de desastres.
- [`docs/seguranca/INVENTARIO_DE_TERCEIROS.md`](seguranca/INVENTARIO_DE_TERCEIROS.md): Inventário de terceiros críticos (Asaas, Supabase, Vercel).
