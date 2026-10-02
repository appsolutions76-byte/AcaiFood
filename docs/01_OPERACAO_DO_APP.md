# AçaíFood — Como o app funciona (Atualizado Pós-R12 / Outubro 2026)

> **Documentação oficial de operação e fluxos de negócio da plataforma AçaíFood.**  
> **Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)  
> **Gateway Financeiro:** Asaas Gestão Financeira S.A. | **Tomadora:** Eletromecânica Baia Ltda (CNPJ: 19.540.550/0001-21)

---

## 1. O que é

Marketplace web/PWA da cadeia do açaí no Pará e regiões de expansão. Conecta quem consome açaí batido, batedeiras artesanais/industriais, fornecedores de frutos no atacado, motoboys urbanos e caminhoneiros/caçambeiros (logística pesada e coleta reversa de caroços). 

Todos os pagamentos são liquidados via **Pix Dinâmico do Asaas**, com custódia e divisão das parcelas da loja, entregador e plataforma.

---

## 2. Perfis (Roles) e Acessos

| Perfil no App | `role` no Banco | Painel | Responsabilidades |
|---|---|---|---|
| **Cliente** | `cliente` | `/` | Escolhe açaí e adicionais, paga via Pix Asaas, recebe o código PIN de 4 dígitos e informa ao motoboy na entrega. |
| **Loja / Batedeira** | `loja` (compatível com `partner`, `batedeira`) | `/parceiros/batedeira` | Vendas B2C, aceita pedidos, imprime comandas térmicas, chama motoboy, compra frutos no B2B e solicita coleta de caroço. |
| **Fornecedor** | `fornecedor` (`supplier`) | `/parceiros/fornecedor` | Vende lotes/latas de frutos no atacado (B2B) para batedeiras e despacha cargas pesadas para caminhoneiros. |
| **Motoboy** | `motorista` (`courier`, `motoboy`) | `/parceiros/motoboy` | Visualiza entregas liberadas no Radar Urbano, retira na loja e valida a entrega mediante digitação do PIN do cliente. |
| **Caminhoneiro / Caçamba** | `motorista` (`caminhao`) | `/parceiros/caminhao` | Realiza fretes pesados B2B (porto/produtor → batedeiras) e coletas de resíduos (batedeiras → ecopontos). |
| **Administrador Master** | `admin` (`is_admin = true`) | `/admin` | Gestão de cidades, tarifas, esteira de saques, auditoria administrativa (`admin_audit_log`), conciliação e suporte. |

---

## 3. Páginas Públicas e Cadastro

- `/apresentacao`: Landing comercial com vídeo institucional.
- `/parceiros`: Portal central de acesso e direcionamento dos parceiros.
- `/cadastro`: Fluxo de cadastro estruturado com coleta de dados reais (KYC) e registro de aceite dos termos de uso e privacidade (`terms_acceptances`).
- `/login`: Autenticação segura via Supabase Auth (JWT).
- `/politica-de-privacidade`: Termos de uso, privacidade, LGPD e informações de conformidade BaaS Asaas.

---

## 4. Ativação e Homologação de Parceiros

1. Ao criar a conta, o parceiro é direcionado para ativação.
2. Os primeiros 50 parceiros cadastrados são contemplados como **Fundadores** (isenção de taxa).
3. Para os demais parceiros, é gerada a cobrança Pix de homologação (R$ 12,90) via Asaas.
4. É criada a subconta Asaas do parceiro para custódia e repasse das operações.

---

## 5. Fluxos Operacionais de Pedidos

### 5.1 Pedido B2C (Cliente → Loja → Motoboy)
1. **Carrinho:** Cliente seleciona loja, consistência do açaí (Popular, Médio, Grosso, Branco) e complementos.
2. **Frete:** Calculado dinamicamente com base na distância ou tarifa fixa da cidade, aplicando eventual subsídio oferecido pela loja.
3. **Checkout Pix Asaas:** Servidor revalida os preços contra o banco e gera o QR Code Pix dinâmico oficial do Asaas.
4. **Confirmação:** Webhook oficial do Asaas confirma o recebimento (`PAID`) e aciona a geração isolada do **PIN de 4 dígitos** na tabela segura `order_pins`.
5. **Preparo e Despacho:** A loja aceita o pedido (`PREPARING`), imprime a comanda térmica e clica em "Chamar Motoboy" (`READY`).
6. **Radar e Entrega:** O motoboy visualiza a entrega no Radar (com coordenadas aproximadas para privacidade), aceita a corrida e desloca-se até o cliente.
7. **Validação do PIN:** O cliente informa os 4 dígitos ao motoboy. A RPC segura `check_delivery_pin` confere a identidade do motorista e o código. Com o PIN validado, o pedido vai para `RECEIVED` e os saldos são liberados.

### 5.2 Pedido B2B (Loja → Fornecedor → Caminhão)
- A batedeira compra latas/sacas de frutos direto do fornecedor, paga via Pix Asaas e a entrega é validada pelo PIN fornecido pela batedeira ao caminhoneiro.

### 5.3 Coleta de Caroço (Loja → Caçamba / Ecoponto)
- A batedeira solicita o recolhimento de caroços. O motorista de caçamba aceita no Radar Pesado e finaliza o serviço com a validação do PIN da loja.

---

## 6. Governança Financeira e Segurança

- **Segurança de PINs:** PINs residem na tabela isolada `order_pins` protegida por RLS. Nem motoristas nem usuários anônimos conseguem ler PINs diretamente.
- **Avanço de Status Seguro:** Todas as transições de status são intermediadas pela RPC `advance_order_status` ou `check_delivery_pin`, impedindo alterações arbitrárias pelo navegador.
- **Baixa Forçada Auditada:** Admins podem dar baixa de contingência apenas em pedidos em rota ou travados por excesso de tentativas, exigindo justificativa obrigatória registrada em `admin_audit_log`.
- **Prevenção de Pagamento em Duplicidade:** O split é mantido sob controle centralizado e liquidado com validação estrita de titularidade bancária.
