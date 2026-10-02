# Inventário de Fornecedores e Terceiros Críticos

**Data de Atualização:** 2026-10-02  
**Titular da Plataforma:** Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)  
**Sistema:** AçaíFood (V1)  

---

## 1. Parceiro de Banking as a Service (BaaS) & Pagamentos
- **Razão Social:** ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A.
- **CNPJ:** 19.540.550/0001-21
- **Regulação:** Instituição de Pagamento autorizada a funcionar pelo Banco Central do Brasil (BACEN).
- **Serviços Prestados:**
  - Abertura e manutenção de contas de pagamento (subcontas) para lojistas e entregadores;
  - Emissão de cobranças Pix e conciliação bancária em tempo real via Webhook;
  - Processamento de transferências e liquidações de saldo Pix sob demanda e programadas;
  - Validação de KYC (Conheça Seu Cliente) e Prevenção à Lavagem de Dinheiro (PLD/CFT).
- **Contatos de Suporte & Ouvidoria:**
  - Telefone: 0800 007 0070
  - Suporte: suporte@asaas.com.br
  - Ouvidoria: ouvidoria@asaas.com.br

---

## 2. Infraestrutura de Banco de Dados & Autenticação
- **Fornecedor:** Supabase Inc.
- **Serviços:**
  - Banco de dados PostgreSQL 15 com extensão PostGIS;
  - Autenticação e Gestão de Sessões (Supabase Auth com suporte a MFA/TOTP aal2);
  - Row Level Security (RLS) e Políticas de Controle de Acesso;
  - Armazenamento de Arquivos e Mídia (Supabase Storage);
  - Mensageria e sincronização em tempo real (Supabase Realtime).
- **Localização dos Dados:** AWS us-east-1 (com conexões seguras criptografadas via TLS 1.3).

---

## 3. Hospedagem de Frontend & Execução Serverless
- **Fornecedor:** Vercel Inc.
- **Serviços:**
  - Build e distribuição de borda (Edge Network / CDN global);
  - Roteamento e Server-Side Rendering (Next.js App Router);
  - Cron Jobs programados (/api/settlements/process).
- **Domínios Oficiais:**
  - `https://www.acaifood.app.br/` (Produção Principal)
  - `https://acai-food-mobile.vercel.app/` (Mirror de Produção Vercel)

---

## 4. Comunicação e Suporte
- **WhatsApp Cloud API / Mensageria:** Suporte ao vivo e notificações operacionais via WhatsApp oficial.
