# AçaíFood — Manuais de Uso Oficiais e Guia Operacional (Versão Pós-R12 / Outubro 2026)

> **Documentação oficial de operação e fluxos de usuários para a plataforma AçaíFood.**  
> **Site Oficial de Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)  
> **Razão Social da Tomadora:** Eletromecânica Baia Ltda (CNPJ: 19.540.550/0001-21)  
> **Instituição de Pagamento / Gateway BaaS:** Asaas Gestão Financeira Instituição de Pagamento S.A.  

---

## 1. Cliente (Consumidor Final)

### 1.1 Cadastro & Localização
1. Acesse o app pelo navegador do celular ou computador em [acaifood.app.br](https://www.acaifood.app.br).
2. Faça o cadastro em `/cadastro` informando Nome Completo, E-mail, Telefone/WhatsApp (com DDD), CPF válido e Cidade/Bairro.
3. No momento do cadastro, há o registro formal de aceite dos **Termos de Uso e Política de Privacidade** da plataforma e do provedor de liquidação financeira (Asaas).

### 1.2 Escolha do Açaí e Montagem da Sacola
1. Selecione a **Batedeira/Loja** de sua preferência no catálogo da sua cidade.
2. Escolha o tipo/consistência do litro de açaí:
   - **Popular**
   - **Médio**
   - **Grosso**
   - **Branco**
3. Adicione complementos opcionais (farinha d'água, tapioca, açúcar, frutas, leite em pó, churrascos, bebidas) e revise a sacola de compras.

### 1.3 Opções de Endereço e Entrega
- **Endereço do Cadastro:** Entrega na sua residência habitual.
- **GPS em Tempo Real:** Localização exata atual via satélite.
- **Ponto de Encontro com Referência:** Ideal para feiras, portos, trapiches, praças e barcos.

### 1.4 Pagamento Seguro via Pix Asaas
1. Ao finalizar, é gerado um **QR Code Pix Dinâmico e Copia e Cola Oficial do Asaas**.
2. O valor cobrado é exatamente o total validado pelo servidor (produtos + frete com eventuais subsídios da loja).
3. A compensação é automática em poucos segundos.

### 1.5 🔐 Regra de Ouro do PIN de Entrega (4 Dígitos)
- Assim que o pagamento é aprovado, um **código PIN de 4 dígitos** exclusivo é gerado e exibido **apenas na tela do cliente** (armazenado de forma isolada e segura).
- **ATENÇÃO:** Só informe este código de 4 dígitos ao motoboy **no momento em que o açaí for entregue em suas mãos**.
- A digitação correta do PIN pelo motoboy é a confirmação irrevogável de que o pedido foi entregue e libera o repasse à loja e ao entregador.

### 1.6 Cancelamento e Estorno
- Se o estabelecimento não puder atender ou o pedido for cancelado antes da saída para entrega, o estorno do Pix é solicitado diretamente via sistema para a conta de origem.

---

## 2. Loja / Batedeira de Açaí (Parceiro B2C)

### 2.1 Cadastro, KYC e Ativação
1. Acesse `/cadastro` e selecione o perfil **Batedeira/Loja**.
2. Preencha os dados cadastrais (Razão Social/Nome, CNPJ/CPF, data de nascimento/abertura, faturamento mensal estimado, endereço completo com CEP e dados de contato).
3. **Subconta Asaas:** É gerada a subconta bancária vinculada no Asaas para custódia e repasse das vendas.
4. Parceiros fundadores (vagas promocionais iniciais liberadas pelo Admin) têm isenção de adesão. Demais parceiros quitam a taxa de homologação de R$ 12,90 via Pix dinâmico.

### 2.2 Gestão de Cardápio e Vitrine
- Configure os preços dos 4 tipos de açaí (Popular, Médio, Grosso, Branco), fotos, descrições e status de disponibilidade (Ativo / Esgotado).
- Cadastre complementos, porções, acompanhamentos e bebidas com preços individuais.
- **Subsídio de Frete (%):** Defina se a loja deseja pagar uma porcentagem do frete para baratear a entrega para seus clientes.

### 2.3 Recepção e Produção do Pedido B2C
1. Ao receber novo pedido pago, o painel emite alerta sonoro.
2. Clique em **"Aceitar e Preparar"** (o status vai para `PREPARING`).
3. **Impressão de Comanda:** O sistema suporta impressão térmica (58mm e 80mm) contendo os itens, endereço, observações e comprovante Asaas.
4. Quando o produto estiver batido e embalado, clique em **"Chamar Motoboy"** (o status vai para `READY`, tornando o pedido visível no radar dos entregadores).

### 2.4 PIN de Retirada (Balcão)
- Para segurança da batedeira, quando o motoboy chegar para retirar o pacote, a loja pode exigir a validação do **PIN de Retirada** exibido no painel da loja.

### 2.5 Abastecimento B2B (Compra de Frutos Atacado)
- A batedeira pode comprar latas, paneiros ou sacas de açaí diretamente de fornecedores cadastrados através da aba B2B.
- O pagamento é feito via Pix Asaas e a liberação para o motorista do caminhão ocorre mediante o PIN B2B da batedeira.

### 2.6 Logística Reversa de Caroço (ESG)
- Solicite a coleta de caroços de açaí diretamente pelo painel. Um motorista de caçamba/caminhão recolhe o volume para destinação correta (ecopontos, olarias, queima de caldeiras ou compostagem).

### 2.7 Financeiro e Saques
- O saldo das vendas é mantido em segurança e liberado após a conclusão das entregas confirmadas com PIN.
- Solicite a transferência do saldo disponível para a conta bancária da mesma titularidade do CNPJ/CPF cadastrado.

---

## 3. Fornecedor de Frutos (Atacado B2B)

1. **Catálogo de Frutos:** Cadastre o lote disponível de frutos (por lata, paneiro ou saca), tipo do fruto, origem e preço unitário.
2. **Recepção de Pedido B2B:** Ao ser notificado de compra por uma batedeira, separe o lote no porto, feira ou armazém.
3. **Chamar Caminhão:** Acione o frete pesado para que os caminhoneiros vejam a carga no radar.
4. **Romaneio:** Emita o comprovante de saída do lote com identificação da transação.
5. **Conclusão:** O caminhoneiro realiza o transporte e entrega na batedeira, que valida o recebimento pelo PIN.

---

## 4. Motoboy / Entregador Urbano (Logística B2C)

### 4.1 Cadastro e Validação
1. Cadastre-se em `/cadastro` selecionando o perfil **Motoboy**.
2. Preencha CPF, dados do veículo e chave Pix vinculada ao próprio CPF.
3. Conceda permissão de GPS para telemetria em tempo real.

### 4.2 Radar de Pedidos Prontos
- O radar exibe pedidos liberados pelas batedeiras da sua região com:
  - Bairro de retirada e distância aproximada;
  - Valor líquido do ganho da corrida de forma 100% transparente.
- Ao clicar em **"Aceitar Corrida"**, a corrida é atribuída exclusivamente a você.

### 4.3 Rota e Retirada
1. Siga o traçado GPS até a batedeira.
2. Ao receber o pacote, informe a retirada no aplicativo.
3. Inicie o deslocamento até o cliente (via mapa interativo ou atalho para Google Maps / Waze).

### 4.4 ⚠️ Validação Obrigatória do PIN do Cliente
- Ao chegar no destino e encontrar o cliente, solicite o **PIN de 4 dígitos** que está na tela do celular dele.
- Digite os 4 dígitos no seu app e clique em **"Confirmar Entrega"**.
- O sistema valida o código instantaneamente e credita o valor do frete no seu saldo.
- **Importante:** São permitidas no máximo 5 tentativas antes do bloqueio por segurança. Nunca entregue o açaí sem digitar o PIN correto.

### 4.5 Saque de Ganhos
- Acompanhe seus ganhos acumulados e solicite a transferência Pix para sua conta de mesma titularidade.

---

## 5. Caminhoneiro / Motorista de Carga Pesada

1. **Radar de Cargas:** Visualize chamados de transporte de frutos B2B (Porto/Produtor → Batedeiras) e coletas de caroço (Batedeiras → Ecopontos).
2. **Rotas e Pesagem:** Trajetos otimizados para veículos de transporte de carga.
3. **Confirmação com PIN:** Na entrega da carga no destino, o encarregado fornece o PIN de recebimento para confirmação imediata do frete.

---

## 6. Painel Administrativo Master (`/admin`)

O acesso ao `/admin` é restrito a administradores com credenciais verificadas diretamente no banco de dados (`is_admin = true` / `role = 'admin'`) e auditado em `admin_audit_log`.

| Módulo / Aba | Principais Ações e Controles |
|---|---|
| **Visão Geral** | Volume bruto transacionado (GMV), faturamento líquido da plataforma, quantidade de pedidos ativos e balanços. |
| **Saques** | Esteira de autorização de saques solicitados pelos parceiros, conferindo CPF/CNPJ de destino e saldo em subcontas. |
| **Usuários** | Listagem com filtros por perfil e cidade, ativação de novos cadastros, bloqueio/desbloqueio e exclusão de contas. |
| **Pedidos** | Torre de controle de todos os pedidos em andamento, inspeção de comprovantes oficiais Asaas e auditoria de status. |
| **Baixa Forçada (Contingência)** | Permite ao admin dar baixa em pedidos travados por PIN incorreto, **exigindo justificativa formal obrigatória de no mínimo 10 caracteres**, registrada com auditoria completa de IP e usuário. |
| **Cidades / Tarifas** | Parametrização independente por município: valor por KM, frete mínimo, comissões de venda e frete. |
| **Ativações** | Gestão da taxa de homologação de parceiros e número de vagas de fundadores isentos. |
| **Suporte ao Vivo** | Atendimento em tempo real com clientes e parceiros via WebSocket/Realtime e atalho para o canal de ouvidoria Asaas. |
| **Termos & LGPD** | Monitoramento dos registros de aceite de termos e conformidade com o contrato BaaS. |

---

## 7. Conformidade, Segurança e Suporte

- **Instituição de Pagamento Parceira:** Asaas Gestão Financeira S.A.
- **Canal de Atendimento Oficial:** Suporte integrado no app e e-mail de atendimento da plataforma.
- **Reclamações Financeiras / Ouvidoria Asaas:** Questões relativas a transações financeiras BaaS podem ser direcionadas através do canal oficial de ouvidoria do Asaas conforme previsto no contrato de prestação de serviços.
- **Proteção de Dados (LGPD):** Dados pessoais e PINs são criptografados e acessíveis exclusivamente aos envolvidos diretos na transação.
