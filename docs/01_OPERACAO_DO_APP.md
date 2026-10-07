# AçaíFood — Como o app funciona (Atualizado Pós-R16 / 06 de outubro de 2026)

> **Documentação oficial de operação e fluxos de negócio da plataforma AçaíFood.**  
> **Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)  
> **Instituição de pagamento (BaaS):** Asaas Gestão Financeira Instituição de Pagamento S.A. (CNPJ 19.540.550/0001-21) | **Tomadora e titular da marca AçaíFood:** Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)

---

## 1. O que é

Marketplace web/PWA da cadeia do açaí no Pará e regiões de expansão. Conecta quem consome açaí batido, batedeiras artesanais/industriais, fornecedores de frutos no atacado, motoboys urbanos e caminhoneiros/caçambeiros (logística pesada e coleta reversa de caroços). 

Todos os pagamentos são feitos por **Pix dinâmico da cobrança Asaas**, que cai na conta da Tomadora no Asaas. Os parceiros recebem hoje pelo **saque aprovado pelo admin**, transferido para a **subconta Asaas aprovada** do parceiro. O repasse automático depois do PIN (`settlements`) está construído, mas **desligado** (`settlements_enabled = false`) até a aprovação escrita do Asaas (ver `13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md`). Não há split na cobrança nem custódia.

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

## 4. Cadastro, Subconta Asaas e Ativação de Parceiros

A ordem é sempre esta:

1. **Aceites:** o parceiro aceita Termos de Uso, Política de Privacidade e os documentos do Asaas da versão atual (`CURRENT_TERMS_VERSION`). Se a versão mudar, o app pede o aceite de novo no próximo login.
2. **Subconta Asaas (KYC real):** o servidor cria a subconta com os dados que o parceiro digitou (nome, e-mail, CPF/CNPJ, celular, renda/faturamento, endereço com CEP, número e bairro). Nada é preenchido por padrão. Se o Asaas já tiver uma subconta com o mesmo CPF/CNPJ, o cadastro fica como **"Precisa do admin"**.
3. **Documentos:** no cartão **"Minha conta Asaas"** o parceiro envia os documentos que o Asaas pedir (link do Asaas ou envio pelo app).
4. **Aprovação:** a subconta só conta como aprovada quando o Asaas informa `general = APPROVED` (webhook de situação da conta, consulta diária às 11h30 UTC e botão "Reconsultar").
5. **Ativação:** fundadores (cota definida pelo admin) não pagam. Os demais pagam a taxa de ativação definida pelo admin, por Pix Asaas, com os dados do próprio cadastro.

Enquanto a subconta não está aprovada, o parceiro usa o painel normalmente, mas **não consegue pedir saque**.

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

- **Segurança de PINs:** os PINs ficam só em `order_pins` (a tabela `orders` não guarda PIN nem hash). A leitura é feita pela função `get_my_order_pins_bulk`: o comprador recebe só o PIN de entrega, a loja só o de retirada, o motorista nenhum. Só o motorista atribuído consegue validar o PIN (`check_delivery_pin` / `check_pickup_pin`).
- **Avanço de Status Seguro:** Todas as transições de status são intermediadas pela RPC `advance_order_status` ou `check_delivery_pin`, impedindo alterações arbitrárias pelo navegador.
- **Baixa Forçada Auditada:** Admins podem dar baixa de contingência apenas em pedidos em rota ou travados por excesso de tentativas, exigindo justificativa obrigatória registrada em `admin_audit_log`.
- **Saque:** o parceiro pede o saque do saldo calculado no servidor; o admin aprova; o valor vai **só para o `walletId` da subconta Asaas aprovada** do parceiro (nunca para chave Pix, CPF ou e-mail digitado). Não existe mais limite de "2 saques por dia" nem contador no navegador: só pode haver um saque em aberto por vez.
- **Ações do admin com registro:** pagar parceiro, aprovar/recusar saque, regerar PIN, conciliar ou estornar pagamento, bloquear/desbloquear, excluir usuário, zerar balanços, mudar configurações de saque, ativação e suporte ficam em `admin_audit_log` (só inclusão).
- **Exclusão e limpeza:** usuário com pedido pago ou saque não pode ser excluído (bloqueie a conta). A limpeza geral de pedidos só funciona com `ALLOW_DESTRUCTIVE_ADMIN_RESET=true` (ambiente de teste).
- **Prevenção de Pagamento em Duplicidade:** não há split no checkout. Enquanto o repasse automático estiver desligado, o único caminho é o saque aprovado pelo admin; ao ligar, o pedido que gera repasse é marcado como pago (`payout_*_done`) e sai do saldo de saque.

---

## 7. Configurações que valem hoje

| Item | Onde fica | Valor/regra |
|---|---|---|
| Repasse automático (`settlements_enabled`) | `platform_settings` | desligado |
| Saque automático (`auto_payout_enabled`) | `platform_settings` | desligado; o servidor recusa ligar sem `ALLOW_AUTO_PAYOUT=true` |
| Taxa de ativação e cota de fundadores | `platform_config` (`activation`) + coluna `activation_fee_enabled` | definidas no admin |
| Horário e WhatsApp do suporte | `platform_config` (`support`) | definidos no admin |
| Disponibilidade mensal (SLA) | `monthly_sla` | informada no admin (aba Conformidade); sem valor, o relatório diz "não medido" |

