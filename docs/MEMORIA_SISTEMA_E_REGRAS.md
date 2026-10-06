# 📖 GUIA DEFINITIVO, MEMÓRIA TÉCNICA & REGRAS DO AÇAÍFOOD

> **DOCUMENTO AUTORITATIVO DA ARQUITETURA, FLUXOS OPERACIONAIS E CONTRATO BAAS ASAAS**
> **Ambiente Oficial de Produção:** `https://www.acaifood.app.br/` (e `https://acai-food-mobile.vercel.app/`)
> **Razão Social da Plataforma:** Eletromecânica Baia Ltda (CNPJ: 42.035.623/0001-40) | Divisão AppSolutions76
> **Parceiro Bancário Oficial:** Asaas Gestão Financeira Instituição de Pagamento S.A. (Contrato BaaS Ativo e Assinado)

---

## 📑 ÍNDICE DE REGRAS E ARQUITETURA

1. [Matriz de Perfis, Responsabilidades e Cadeia de Valor](#1-matriz-de-perfis-responsabilidades-e-cadeia-de-valor)
2. [Motor Único de Cálculo Financeiro no Servidor (pricingEngine.ts & Checkout C8)](#2-motor-único-de-cálculo-financeiro-no-servidor)
3. [Mecanismo Anti-Fraude Universal de Segurança por PIN (4 Dígitos & RPCs)](#3-mecanismo-anti-fraude-universal-de-segurança-por-pin)
4. [Conformidade Regulatória BaaS Asaas, Subcontas e KYC](#4-conformidade-regulatória-baas-asaas-subcontas-e-kyc)
5. [Privacidade de Dados e Segurança RLS (partner_secrets)](#5-privacidade-de-dados-e-segurança-rls)
6. [Fluxo Logístico Urbano, Frete Pesado B2B e EcoPoint](#6-fluxo-logístico-urbano-frete-pesado-b2b-e-ecopoint)
7. [Governança, Painel Administrativo, Auditoria e Papel do Admin no Financeiro](#7-governança-painel-administrativo-auditoria-e-papel-do-admin-no-financeiro)

---

## 1. MATRIZ DE PERFIS, RESPONSABILIDADES E CADEIA DE VALOR

O AçaíFood possui **7 papéis de acesso (perfis)** com interfaces, formulários e regras estritas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PERFIS DE ACESSO                                │
├──────────────────┬──────────────────────────────────────────────────────────┤
│ 1. Cliente (B2C) │ Consumidor final residencial (`/`)                       │
│ 2. Batedeira     │ Loja B2C de açaí batido / Compradora B2B (`/parceiros/batedeira`) │
│ 3. Fornecedor    │ Produtor rural B2B que vende latas de fruto (`/parceiros/fornecedor`) │
│ 4. Motoboy       │ Entregador urbano de motos para rotas B2C (`/parceiros/motoboy`) │
│ 5. Caminhão      │ Motorista de carga pesada B2B e EcoPoint (`/parceiros/caminhao`) │
│ 6. Ecoponto      │ Coletor / Reciclador de resíduos de caroço (Biomassa)    │
│ 7. Admin Geral   │ Controle total, taxas, aprovação de saques (`/admin`)     │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

### 🌴 Regra Fundamental da Cadeia de Valor:
* O **Fornecedor/Produtor** é exclusivamente o vendedor do fruto fresco colhido e **NÃO recebe o caroço de volta**.
* O caroço processado pela batedeira é recolhido por caminhões caçamba no módulo **EcoPoint** e encaminhado diretamente a usinas de biomassa, olarias/cerâmicas e adubagem.

---

## 2. MOTOR ÚNICO DE CÁLCULO FINANCEIRO NO SERVIDOR

Toda a matemática financeira do sistema é **autoritativa no servidor** e centralizada em `apps/mobile/src/lib/pricingEngine.ts`:

$$\text{Total Cobrado do Comprador} = \text{Subtotal dos Produtos} + (\text{Frete Total} - \text{Subsídio da Loja})$$

* **Carrinho ao Saque:** A mesma fórmula calcula subtotal, frete por km ou tarifa fixa municipal (`cities.rates`), taxa de plataforma sobre venda (`b2c_plat`), taxa de plataforma sobre entrega (`b2c_mot_plat`), subsídio de loja (`frete_subsidy_pct`) e divisão da tarifa Pix Asaas por 1, 2 ou 3 atores.
* **Checkout C8:** A API `/api/asaas/checkout` lê os preços dos produtos no banco (`products`) e calcula a distância no servidor, impedindo que o aplicativo envie totais adulterados.
* **Custódia Pós-PIN:** O saldo líquido do vendedor (`netSellerPayout`) e do entregador (`netDriverPayout`) permanece bloqueado até a confirmação física presencial da entrega (`status = RECEIVED`).

---

## 3. MECANISMO ANTI-FRAUDE UNIVERSAL DE SEGURANÇA POR PIN

| Atuação | Quem gera o PIN? | Quem digita e valida? | RPC PostgreSQL | Efeito após validação |
| :--- | :--- | :--- | :--- | :--- |
| **B2C Retirada** | 🏪 Batedeira (Loja) | 🛵 Motoboy | `check_pickup_pin` | Status muda para `DELIVERING` (`em_rota`). |
| **B2C Entrega** | 👤 Cliente Residencial | 🛵 Motoboy | `check_delivery_pin` | Status muda para `RECEIVED` e credita os saldos nos cofres. |
| **B2B Lote Frutos** | 🏭 Fornecedor | 🚚 Caminhoneiro | `check_pickup_pin` | Libera embarque das latas no transporte pesado. |
| **EcoPoint Caroço** | 🏪 Batedeira | 🚛 Motorista Caçamba | `check_delivery_pin` | Confirma a coleta física e liquida o frete da caçamba. |

* **Hardening R15:** Bloqueio após 5 tentativas erradas (`PIN_LOCKED`), sem PINs mestres legados, sem permissão para chamadas anônimas (`anon`), e com triggers no PostgreSQL travando alterações manuais diretas de status na tabela `orders`.

---

## 4. CONFORMIDADE REGULATÓRIA BAAS ASAAS, SUBCONTAS E KYC

O AçaíFood opera em conformidade com o Contrato BaaS do Asaas (Tomadora: **Eletromecânica Baia Ltda**):

1. **Aceites de Termos:** Exigência de confirmação dos 6 documentos regulatórios na versão atual (`2026-10-06`) via `/api/terms/accept` antes de permitir a abertura da subconta.
2. **Subcontas de Parceiros (`/api/asaas/subaccount`):** Exige CPF/CNPJ, CEP válido, endereço completo, data de nascimento real e faturamento/renda mensal real (`incomeValue`).
3. **Status Inicial:** As subcontas nascem com `asaas_account_status = 'PENDING_DOCUMENTS'` e `split_enabled = false`.
4. **Envio de Documentos (`/api/asaas/documents`):** O parceiro acessa o link oficial de onboarding do Asaas (`onboardingUrl`) via componente `AsaasAccountStatusCard` para foto de documento e selfie biométrica.
5. **Webhook de Status (`/api/asaas/account-webhook`):** Recebe o evento `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` do Asaas, alterando o status para `APPROVED` e ativando `split_enabled = true`.
6. **Saques Exclusivos:** A aprovação de saques em `/api/admin/payout/pay-partner` e `withdrawalApproval.ts` exige que a subconta esteja com status `APPROVED`, transferindo exclusivamente para a `walletId` da subconta.

---

## 5. PRIVACIDADE DE DADOS E SEGURANÇA RLS

* **Tabela Segura `partner_secrets`:** As chaves de API individuais das subcontas Asaas (`asaas_account_api_key`) são isoladas na tabela `partner_secrets`, sem políticas de acesso público, acessíveis unicamente pelo servidor via `service_role`.
* **Proteção da Tabela `users`:** Revogado o `SELECT *` para usuários `anon` e `authenticated`. A leitura pública de lojas e vitrine retorna apenas colunas essenciais (`id, name, role, bairro, cidade, status, is_online, icon`).
* **Consulta de Perfil:** O usuário logado consulta seu próprio perfil completo através da RPC `get_my_profile()` (`SECURITY DEFINER`, `WHERE id = auth.uid()`).

---

## 6. FLUXO LOGÍSTICO URBANO, FRETE PESADO B2B E ECOPOINT

* **Radar em Tempo Real:** Motoboys e Caminhoneiros visualizam corridas próximas agrupadas por raio/bairro (~1 km) sem expor nome, telefone ou endereço exato do cliente até o aceite oficial.
* **Aceite Atômico (`accept_order_atomic`):** Impede que dois entregadores aceitem a mesma corrida simultaneamente.
* **Impressão Térmica (`ThermalPrinterModal`):** As batedeiras e fornecedores imprimem comandas com detalhes do pedido e PIN de retirada em impressoras térmicas ESC/POS via Bluetooth.

---

## 7. GOVERNANÇA, PAINEL ADMINISTRATIVO, AUDITORIA E PAPEL DO ADMIN NO FINANCEIRO

O Administrador detém o **controle autoritativo e a governança financeira absoluta** sobre a plataforma, operando sob 4 pilares de proteção:

### 7.1 Liquidação Autoritativa de Saques (`/api/admin/payout/pay-partner`)
* No painel `/admin` (aba **💳 Saques & Repasses**), o Admin liquida repasses com 1 clique.
* O servidor calcula o saldo líquido autoritativo (`getPartnerAvailableBalance`), valida se a subconta Asaas do parceiro possui status **`APPROVED`** e transfere o valor estritamente para a `walletId` da subconta.

### 7.2 Proteção Anti-Erro (HTTP 410 em `/api/asaas/transfer`)
* A rota de envio genérico/livre de PIX foi **desativada com HTTP 410 (Gone)**, impedindo transferências acidentais ou desvinculadas de vendas validadas por PIN.

### 7.3 Gestão de Taxas, Tarifas e Rateios Pix
O Admin define no painel `/admin`:
* Percentuais de intermediação sobre a venda (`b2c_plat`, `b2b_plat`, `col_plat`).
* Taxas sobre o frete urbano e pesado.
* Tarifação por município (`cities.rates` — taxa por km ou tarifa fixa por cidade/veículo).
* Rateio da taxa fixa Pix do Asaas (R$ 0,99) entre 1, 2 ou 3 atores (Plataforma, Vendedor e Entregador).
* Ativação ou desativação da taxa de adesão/configuração da plataforma.

### 7.4 Auditoria Imutável (`admin_audit_log`) e Segurança MFA (`aal2`)
* Todas as ações financeiras (aprovação de saques, estornos, conciliação e alteração de taxas) são gravadas imutavelmente em `admin_audit_log` contendo: ID do Admin, Data/Hora, IP, User-Agent e estados antes/depois.
* Todas as rotas de API em `/api/admin/*` exigem autenticação segura em dois fatores (`aal2`).
