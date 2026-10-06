# 📄 MEMORIAL DESCRITIVO OFICIAL — PLATAFORMA AÇAÍFOOD

---

## 🏛️ 1. IDENTIFICAÇÃO DO EMPREENDIMENTO E PARTES

* **Denominação Comercial da Plataforma:** AçaíFood
* **Razão Social da Empresa Operadora:** Eletromecânica Baia Ltda
* **CNPJ:** `42.035.623/0001-40`
* **Divisão Responsável pelo Desenvolvimento e Tecnologia:** AppSolutions76
* **Links Oficiais em Produção:** 
  - `https://www.acaifood.app.br/` (Domínio Principal)
  - `https://acai-food-mobile.vercel.app/` (Instância de Produção Vercel)
* **Instituição Parceira de Serviços Financeiros e Banking as a Service (BaaS):** 
  - Asaas Gestão Financeira Instituição de Pagamento S.A.
* **Data do Documento:** Outubro de 2026
* **Versão:** 1.0 (Consolidada)

---

## 🎯 2. OBJETO E ESCOPO DO SISTEMA

O **AçaíFood** é uma plataforma tecnológica de intermediação comercial, logística sob demanda e gestão financeira projetada para digitalizar, integrar e potencializar toda a cadeia de valor do açaí, abrangendo:

1. **Segmento B2C (Business to Consumer):** Venda e entrega expressa de açaí pronto e complementos entre batedeiras artesanais/lojas e o consumidor final.
2. **Segmento B2B (Business to Business):** Compra e venda de matéria-prima (frutos em sacas/latas e polpa industrial) entre produtores/ribeirinhos/fornecedores e as batedeiras de açaí, com suporte a transporte rodoviário e frete pesado (Caminhão).
3. **Segmento de Sustentabilidade e Economia Circular (Coleta de Resíduos):** Logística reversa para recolhimento e destinação ecológica dos caroços de açaí resultantes do despolpamento para indústrias de biomassa, cerâmicas e compostagem.
4. **Infraestrutura Bancária Integrada (BaaS):** Liquidação de recebíveis, custódia de transações, gestão de carteiras digitais e transferências instantâneas via Pix operadas pelo Asaas IP S.A.

---

## 💻 3. ARQUITETURA TECNOLÓGICA E INFRAESTRUTURA

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CAMADAS DE ARQUITETURA                                │
├───────────────────┬─────────────────────────────────────────────────────────────┤
│ Frontend          │ Next.js (App Router), React 19, Tailwind CSS v4, Zustand    │
│ Backend Server    │ Next.js Server Components, API Route Handlers (Edge/NodeJS) │
│ Banco de Dados    │ Supabase PostgreSQL 15+, Row Level Security (RLS)           │
│ Tempo Real        │ Supabase Realtime (WebSockets para Radar e Notificações)    │
│ Armazenamento S3  │ Supabase Storage (Fotos de cardápio, comprovantes e mídia)  │
│ Gateway Financeiro│ Asaas API v3 (Cobranças Pix Dinâmicas, BaaS e Transfer)     │
│ Hospedagem & CDN  │ Vercel Serverless Platform com proteção SSL/TLS 1.3         │
└───────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 4. MEMORIAL OPERACIONAL: OS 7 PAPÉIS DO ECOSSISTEMA

### 4.1 Consumidor Final (Cliente B2C)
* **Acesso:** Sem necessidade obrigatória de download em lojas de apps (PWA / Web Responsivo).
* **Jornada:**
  1. Acessa a Home e visualiza batedeiras abertas por geolocalização e proximidade.
  2. Escolhe o tipo de açaí (Popular, Médio, Grosso, Branco) e complementos (farinha de tapioca, farinha d'água, açúcar, frutas).
  3. Informa o endereço cadastrado ou compartilha a **Localização GPS em Tempo Real**.
  4. Realiza o pagamento via **Pix Dinâmico com QR Code e Pix Copia e Cola**.
  5. Recebe o **PIN de Entrega de 4 dígitos** exclusivo para liberação do pedido.
  6. Acompanha a rota do motoboy em tempo real no mapa integrado.

### 4.2 Batedeiras / Lojas de Açaí
* **Jornada:**
  1. Painel gerencial com controle de abertura/fechamento da loja.
  2. Definição de preços por litragem, fotos e controle de estoque de complementos.
  3. Configuração de **Subsídio de Frete** (0% a 100% pago pela loja para atrair clientes).
  4. Recebimento de pedidos com alerta sonoro instantâneo.
  5. Transição de status: *Aceitar Pedido ➔ Iniciar Preparo ➔ Pronto para Entrega*.
  6. Validação do **PIN de Balcão (Pickup PIN)** na entrega física ao motoboy.
  7. Acompanhamento de extrato de vendas e saldo líquido na Carteira Digital.

### 4.3 Fornecedores / Produtores de Fruto (B2B)
* **Jornada:**
  1. Cadastro de lotes de fruto (latas de 14kg / paneiros / sacas) com especificação de safra e rendimento.
  2. Venda direta para batedeiras com emissão de cobrança B2B.
  3. Solicitação de frete pesado rodoviário para motoristas de caminhão.
  4. Recebimento do valor na carteira com validação de recebimento pelo comprador.

### 4.4 Entregadores Motoboys (Logística Urbana B2C)
* **Jornada:**
  1. Alternância de status entre **Online** e **Pausado (Fora de Serviço)**.
  2. Radar de Entregas em tempo real com pooling a cada 3.5 segundos e alerta sonoro.
  3. Exibição transparente do **Valor Líquido do Frete** antes do aceite.
  4. Aceite atômico de corrida com trava contra concorrência (`accept_order_atomic`).
  5. Traçado de rota GPS no mapa até a batedeira.
  6. Coleta no balcão com validação de saída pela loja.
  7. Deslocamento até o cliente com traçado de rota.
  8. Finalização da corrida mediante inserção do PIN de Entrega ditado pelo cliente.
  9. Saldo de frete creditado imediatamente na Carteira Digital.

### 4.5 Motoristas de Caminhão (Frete Pesado B2B)
* Atendimento a corridas de transporte de cargas de açaí em grande volume entre portos, entrepostos e batedeiras.
* Cálculo de frete customizado para veículos pesados (valor por KM ou taxa fixa de carga).

### 4.6 Ecopontos e Coleta de Caroço
* Interface para agendamento de recolhimento de resíduos de despolpamento.
* Destinação ecológica dos caroços para olarias, fábricas de ração e geradores de biomassa.

### 4.7 Administrador Geral da Plataforma (Admin)
* Acesso restrito com Segundo Fator de Autenticação (MFA TOTP).
* Parametrização de taxas por município (taxa de intermediação, frete por KM ou fixo).
* Monitoramento de métricas operacionais e financeiras (GMV, volume de pedidos, repasses pendentes).
* Aprovação e rejeição de solicitações de saque Pix com trava de segurança.
* Conciliação bancária oficial e atendimento a chamados de suporte.

---

## 💵 5. MEMORIAL FINANCEIRO, MONETIZAÇÃO E REGRAS DE LIQUIDAÇÃO

### 5.1 Motor de Precificação (`pricingEngine.ts`)
O sistema possui cálculo de taxas dinâmico e auditado executado no servidor:

$$\text{Total do Pedido (B2C)} = \text{Subtotal dos Produtos} + \text{Frete do Cliente}$$

* **Subtotal dos Produtos:** Somatório dos litros e complementos adicionados.
* **Frete Total:** Calculado pela regra da cidade (Taxa Fixa do Motoboy ou valor por KM rodado).
* **Subsídio de Frete:** Parte do frete assumida voluntariamente pela batedeira:
  $$\text{Frete Cliente} = \text{Frete Total} \times (1 - \text{Percentual de Subsídio})$$
  $$\text{Frete Loja} = \text{Frete Total} \times \text{Percentual de Subsídio}$$

### 5.2 Divisão dos Recebíveis (Repasses Líquidos)

| Beneficiário | Parcela Recebida | Momento do Crédito |
|---|---|---|
| **Batedeira / Loja** | $(\text{Subtotal Produtos} - \text{Comissão Plataforma}) - \text{Subsídio Frete}$ | No segundo da validação do PIN de Entrega |
| **Motoboy** | $\text{Frete Total} - \text{Taxa Administrativa de Entrega}$ | No segundo da validação do PIN de Entrega |
| **Plataforma AçaíFood** | $\text{Comissão sobre Venda} + \text{Taxa sobre Entrega}$ | Retido na conta da plataforma |

### 5.3 Modelo de Custódia (Escrow) e Gestão de Saques
1. **Entrada de Recursos:** 100% dos pagamentos dos clientes são liquidados na conta corrente da operadora da plataforma (**Eletromecânica Baia Ltda**) mantida no Asaas IP S.A.
2. **Custódia Transitória:** O valor permanece retido em garantia até a conclusão física da entrega.
3. **Solicitação de Saque:** O parceiro solicita a transferência de seus créditos pelo app (limite máximo de **2 saques diários** por operador para controle de custos de tarifa bancária).
4. **Aprovação pelo Administrador:**
   - O Administrador confere os dados no painel e clica em **"Aprovar Saque"**.
   - O servidor executa a chamada `POST /v3/transfers` na API Asaas via chave secreta.
   - O valor é transferido instantaneamente via Pix para o CPF/CNPJ de mesma titularidade do parceiro.
5. **Varredura Diária Automática (Sweep às 22h):** Rotina programável por município que liquida os saldos acumulados do dia automaticamente.

### 5.4 Política de Cancelamento e Estorno
* **Cancelamento Pré-Preparo (Status `PAID` / `PENDING`):** O cliente possui o direito de cancelar o pedido diretamente no app. O sistema dispara a rota `/api/asaas/refund`, estornando o Pix integralmente e de forma imediata para a conta bancária do cliente.
* **Cancelamento Pós-Preparo (Status `PREPARING`, `READY`, `IN_TRANSIT`):** O cancelamento direto pelo cliente é **bloqueado**, uma vez que o açaí é produto artesanal perecível preparado sob demanda. Disputas são tratadas individualmente pela Central de Atendimento/Admin.

---

## 🔒 6. SEGURANÇA DA INFORMAÇÃO, ANTIFRAUDE E LGPD

### 6.1 Mecanismo de Duplo PIN Criptográfico
* **PIN de Balcão (`pickup_pin`):** Gerado aleatoriamente e exposto unicamente para a Batedeira. O motoboy só retira o pedido após a loja digitar/confirmar esse código.
* **PIN de Entrega (`delivery_pin`):** Gerado aleatoriamente e exposto unicamente para o Cliente. O motoboy só finaliza a entrega ao digitar esse código no app.
* **Segurança de Armazenamento:** Os PINs são gravados na tabela isolada `order_pins` protegida por RLS (Row Level Security). O entregador nunca tem acesso aos PINs via código-fonte ou requisições de rede.

### 6.2 Governança de Acesso e Autenticação Multifator (MFA)
* Acesso ao Painel Administrativo condicionado ao uso de segundo fator de autenticação via aplicativo autenticador TOTP (Google Authenticator / Authy) através do componente `AdminMfaGuard`.
* Chaves de API do Asaas e credenciais de banco protegidas exclusivamente no ambiente do servidor (`.env.local` / Supabase Vault), nunca expostas no bundle JavaScript do navegador.

### 6.3 Auditoria e Rastreabilidade
* Todas as ações críticas de administração (aprovações de saque, estornos forçados, alterações de taxas e exclusões) geram registros imutáveis na tabela `admin_audit_logs`, contendo IP, ID do administrador, timestamp e estado anterior/posterior da entidade.

---

## 📑 7. CONFORMIDADE COM O CONTRATO ASAAS BAAS

A plataforma está rigorosamente adaptada às cláusulas do **Contrato de Banking as a Service** firmado com o Asaas Gestão Financeira Instituição de Pagamento S.A.:

1. **Cláusula 2.1 & 6.3 (Estrutura de Pagamento e Custódia):** O modelo adota recebimento centralizado com distribuição posterior pós-validação de serviço, atendendo às normas de marketplace e intermediação comercial.
2. **Cláusula 3.1–3.3 (Transparência de Marca):** Presença ostensiva do selo *"Operado por Asaas Instituição de Pagamento"* em todas as interfaces de login, cadastro, checkout Pix, comprovantes térmicos e rodapés institucionais.
3. **Cláusula 6.1 (Proibição de Cobrança por Serviço Financeiro):** A taxa cobrada de parceiros refere-se estritamente à taxa de adesão, tecnologia e suporte da plataforma AçaíFood.
4. **Cláusula 8.2.3 (Veracidade dos Dados Cadastrais - KYC):** Validação matemática de CPFs e CNPJs junto às regras da Receita Federal e Banco Central, sem inserção de dados fictícios.
5. **Anexo I (Segurança da Informação):** Conformidade integral em criptografia de tráfego (HTTPS/TLS), segregação de ambientes e gestão de incidentes documentada.

---

## 🏆 8. DECLARAÇÃO DE CONFORMIDADE E INTEGRIDADE

Este Memorial Descritivo atesta que a plataforma **AçaíFood** encontra-se tecnicamente íntegra, com compilação de produção verificada com zero erros, banco de dados normalizado e fluxos operacionais, financeiros e jurídicos totalmente operacionais.
