# AçaíFood — Manuais de Uso Oficiais (versão consolidada — novembro de 2026 — modelo "cliente paga a loja")

> **Documentação oficial de operação para clientes e parceiros da plataforma AçaíFood.**
> **Site oficial:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)
> **Plataforma operada por:** Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)
> **Serviços financeiros (Pix, contas de pagamento, transferências):** Asaas Gestão Financeira Instituição de Pagamento S.A.
>
> O AçaíFood é uma plataforma de tecnologia (marketplace). Não é banco nem instituição de pagamento: os serviços financeiros são prestados pelo Asaas.

---

## 0. Para todos os usuários

1. **Cadastro** em `/cadastro`: nome, e-mail, celular com DDD, CPF ou CNPJ, cidade, CEP, rua, número e bairro. Permita o GPS.
2. **Aceite dos termos:** você aceita os Termos de Uso (`/termos-de-uso`) e a Política de Privacidade do AçaíFood e os documentos do Asaas. Parceiros aceitam também o Mandato da subconta Asaas e o Consentimento da chave Pix aleatória. O app registra a data e a versão do aceite. Quando os termos mudam, o app pede um novo aceite no login.
3. **Dados verdadeiros:** os dados são usados pelo Asaas para abrir e verificar contas. Dados falsos ou de outra pessoa bloqueiam a conta.
4. **Selo "Serviços financeiros Asaas":** aparece nas telas de pagamento e de dinheiro para mostrar quem presta esse serviço.

---

## 1. Cliente (Consumidor Final)

### 1.1 Escolha do açaí, pratos e sacola
1. Selecione a **Batedeira/Loja** de sua preferência no catálogo da sua cidade (com filtros por mais próximas, abertas agora, frete promocional ou consistência).
2. Escolha o litro de açaí entre os **5 padrões oficiais**:
   - **Popular (1L):** Mais fluido, leve e acessível.
   - **Médio (1L):** O padrão clássico do açaí batido no dia.
   - **Grosso (1L):** Polpa densa, encorpada e viscosa.
   - **Branco (1L):** Fruto verde amazônico de sabor nobre e amanteigado.
   - **❄️ Congelado p/ Viagem (1L):** Ultra-congelado e selado para viagens de longa distância.
3. **Refeições, Pratos & Churrasco:** Nos itens com o selo *🍽️ Opções*, personalize na hora:
   - **Ponto da Carne:** Ao ponto, Bem assado ou Mal passado.
   - **Acompanhamentos:** Arroz branco, Baião de dois, Farofa, Maionese, Vinagrete (respeitando o limite configurado pela loja).
   - **Observações da Cozinha:** Instruções pontuais para a comanda (ex: *"sem cebola"*).
4. **Variedade de Marcas:** Em produtos com múltiplas marcas (cervejas, refrigerantes, águas, farinhas), escolha a sua marca de preferência no card do produto.
5. Adicione complementos e revise a sacola. A sacola aceita itens de **uma loja por vez**.

### 1.2 Endereço e entrega
- Escolha entre **Endereço do cadastro**, **GPS em tempo real** ou **ponto de encontro com referência** (feiras, portos, trapiches, praças e barcos).

### 1.3 Pagamento por Pix
1. Ao finalizar, aparece o **QR Code Pix e o Copia e Cola**, gerados pelo Asaas.
2. O valor cobrado é o total calculado pelo servidor (produtos + frete, já com o eventual subsídio da loja).
3. **Você paga direto à loja:** no seu banco, o recebedor aparece com o **nome da loja** que vendeu (conta Asaas da loja). No mesmo Pix, o Asaas separa automaticamente a comissão do AçaíFood.
4. O Pix vale por **60 minutos**. Sem pagamento nesse prazo, o pedido é cancelado.
5. A confirmação é automática em poucos segundos.

### 1.4 🔐 Regra de ouro do PIN de entrega (4 dígitos)
- Depois do pagamento, um **PIN de 4 dígitos** aparece **só na tela do cliente**.
- **Só diga o PIN ao entregador quando o pedido estiver nas suas mãos.**
- O PIN digitado pelo entregador confirma a entrega. É ele que faz o app pagar a corrida ao entregador.

### 1.5 Cancelamento e estorno
- **Você** pode cancelar até a loja iniciar o preparo. **A loja** pode recusar ou cancelar até o pedido ficar pronto. Com o pedido em rota ou entregue, só o suporte.
- O estorno é feito pelo Asaas, a partir da conta da loja, para a conta de onde saiu o Pix (estorno total; a comissão do app volta junto). Pix pago depois do cancelamento é estornado automaticamente.

### 1.6 Seus dados
- No radar, o entregador vê só a loja, o bairro e a distância aproximada. O endereço completo aparece para ele apenas depois que aceita a corrida.

### 1.7 Problemas com pagamento
- Abra o **Suporte** no app. Reclamações sobre o serviço financeiro (Pix, estorno) são encaminhadas ao Asaas.

---

## 2. Loja / Batedeira de Açaí (Parceiro B2C)

### 2.1 Cadastro e ativação
1. Acesse `/cadastro` e selecione o perfil **Batedeira/Loja**.
2. Preencha os dados reais (nome ou razão social, CPF/CNPJ, data de nascimento ou de abertura, faturamento mensal, endereço completo e contato).
3. Abra a sua **conta Asaas** (seção 6).
4. Parceiros fundadores (vagas definidas pelo admin) não pagam ativação. Quando houver taxa de ativação, ela é cobrada pelo **uso da plataforma AçaíFood** e aparece na tela antes do pagamento. Não é tarifa do Asaas.

### 2.2 Cardápio e vitrine
- Configure os preços dos 5 tipos de açaí (Popular, Médio, Grosso, Branco e Congelado), fotos e disponibilidade.
- Cadastre pratos executivos, churrascos e refeições utilizando o **Modelo Churrasco** ou criando grupos livres com acompanhamentos, pontos da carne e cobrança opcional de adicionais.
- Configure opções de **Variedade de Marcas** em produtos industrializados (bebidas, cervejas em lata, embalagens, farinhas).
- **Subsídio de frete (0% a 100%):** a loja pode pagar parte ou todo o frete no lugar do cliente. O valor sai da sua venda. O app recusa pedidos em que o seu valor não cubra a corrida e as taxas (pedido mínimo).

### 2.3 Recebendo e preparando o pedido
1. Pedido pago toca um alerta sonoro. O dinheiro já entrou na **sua conta Asaas** (reservado até a entrega).
2. Toque em **"Aceitar e Preparar"**.
3. **Comanda Térmica:** impressão térmica automática ou manual (58 mm e 80 mm) com itens, ponto da carne, acompanhamentos detalhados, observações e PIN de retirada (balcão).
4. Com o pedido embalado, toque em **"Chamar Motoboy"**. O pedido aparece no radar dos entregadores autônomos da cidade.
5. Depois que o cliente informa o PIN na entrega, o app transfere a corrida automaticamente da sua conta Asaas para a do motoboy.

### 2.4 PIN de retirada (balcão)
- Quando o motoboy chegar à loja, ele informa/digita o **PIN de Balcão** gerado no painel da loja. Essa validação destrava a saída do pacote e redireciona automaticamente o motoboy para a rota do cliente.

### 2.5 Abastecimento B2B (compra de frutos)
- Compre latas, paneiros ou sacas direto dos fornecedores na aba B2B e pague por Pix.
- Quando o caminhão chegar, informe o **seu PIN** ao caminhoneiro para confirmar o recebimento.

### 2.6 Coleta de caroço (ESG)
- Solicite a coleta pelo painel e pague o frete da caçamba. O motorista recolhe o caroço para ecopontos e usinas credenciadas e confirma com o seu PIN. O caroço não retorna ao produtor.

### 2.7 Dinheiro
- Você recebe na hora do Pix, na sua conta Asaas. Detalhes e exemplo na seção 7.

### 2.8 Motoristas indicados, entrega própria e avaliações (quando ativos na cidade)
- **Convite por link:** na aba **Motoristas indicados**, gere links de convite (validade de 7 dias) para motoboys (B2C) ou operadores de caçamba (Coleta) e escolha como chamar por fluxo: **Aberto a todos do app**, **Priorizar meus indicados** (janela inicial exclusiva, padrão 3 min) ou **Só meus indicados**.
- **Entrega por conta própria (B2C):** se um pedido em **Só meus indicados** aguardar aceite além do tempo de alerta da cidade (padrão 5 min), você pode abrir para todos do app, aguardar mais ou assumir a **entrega por conta própria** (confirmando a entrega com o PIN de 4 dígitos do cliente e mantendo o valor líquido do frete na sua conta).
- **Avaliações (1 a 5 estrelas):** após a conclusão do pedido, avalie o cliente e o entregador em até 7 dias.

---

## 3. Fornecedor de Frutos (Atacado B2B)

1. **Catálogo:** cadastre o lote (lata, paneiro ou saca), tipo do fruto, origem e preço.
2. **Pedido B2B pago:** separe o lote no porto, feira ou armazém.
3. **Chamar Caminhão:** os caminhoneiros veem a carga no radar. Quando ativo na cidade, você também pode convidar caminhoneiros na aba **Caminhoneiros indicados** (fluxo B2B), escolher o modo de chamada (**Aberto a todos**, **Priorizar meus indicados** ou **Só meus indicados**) e, caso o pedido em **Só meus indicados** aguarde além do tempo de alerta, abrir para todos do app ou assumir a entrega por conta própria.
4. **Romaneio:** emita o comprovante térmico de saída do lote.
5. **Conclusão e avaliação:** a batedeira confirma o recebimento pelo PIN. Logo depois, o app paga o frete do caminhoneiro a partir da sua conta Asaas. Avalie a loja compradora e o caminhoneiro com 1 a 5 estrelas.

---

## 4. Motoboy / Entregador (B2C)

### 4.1 Cadastro e Requisitos
1. Cadastre-se em `/cadastro` com o perfil **Motoboy**: CPF, celular, endereço completo e dados do veículo.
2. Abra e mantenha aprovada a sua conta Asaas (seção 6).
3. Permita o GPS do dispositivo móvel.

### 4.2 Radar Urbano sob Demanda
- Você é **autônomo**: atende qualquer loja da cidade, sem contrato de exclusividade.
- O radar mostra somente pedidos já preparados pelas lojas (sem tempo de espera no balcão), com valor líquido da corrida, distância em km e rota no mapa.

### 4.3 Navegação GPS Automatizada (Fluxo Inteligente)
1. **Aceitou a Corrida:** O app redireciona você **automaticamente para o mapa com a rota até a batedeira**, sem necessidade de cliques extras.
2. **Chegada na Loja:** Retire os produtos e digite o **PIN de Balcão** da loja.
3. **Retirada Confirmada:** Assim que o PIN de balcão é digitado, o app **redireciona você automaticamente para o mapa com a rota até o cliente**.
4. **Atalhos Manuais:** Os botões *"🚀 GPS p/ Retirada"* e *"🏁 GPS p/ Cliente"* continuam disponíveis para alternar ou abrir externamente no Google Maps ou Waze a qualquer momento.

### 4.4 ⚠️ PIN do cliente (obrigatório)
- No destino, peça o **PIN de 4 dígitos** que está no celular do cliente, digite e confirme.
- São no máximo **5 tentativas**. Depois disso o pedido bloqueia e só o suporte libera (o cliente recebe um PIN novo).
- **Nunca entregue o pedido sem o PIN correto digitado na tela.**

### 4.5 Ganhos e Saque
- Imediatamente após a validação do PIN, o app transfere o valor líquido da corrida da conta Asaas da loja para a **sua conta Asaas**.
- Saque por Pix para chave CPF do próprio titular na aba Financeiro.

### 4.6 Lojas que me indicam e avaliações (quando ativos na cidade)
- Na aba **Lojas que me indicam**, visualize convites recebidos com selo *"🤝 Te indicou"*.
- Avalie o cliente e a loja com 1 a 5 estrelas após cada entrega finalizada.

---

## 5. Caminhoneiro / Caçamba (Carga Pesada & ESG)

1. **Radar de Cargas:** fretes B2B (fornecedor → batedeira) e coletas de caroço (batedeira → ecoponto/usina).
2. O ganho é calculado por km ou taxa fixa da cidade. **Frete B2B:** pago após o PIN, da conta do fornecedor para a do caminhoneiro. **Coleta de caroço:** a loja paga à plataforma, que transfere ao motorista após o PIN no destino.
3. **PIN de descarga:** no destino, o responsável confere a carga e informa o PIN de 4 dígitos.
4. **Quem me indica e avaliações:** gerencie convites separados de Fornecedores e Lojas e avalie as partes envolvidas.

---

## 6. Como abrir sua conta Asaas (todos os parceiros)

Todo parceiro recebe por uma **subconta Asaas em seu nome**, aberta pelo AçaíFood com a sua autorização (Mandato), dada no aceite dos termos. Sem ela aprovada, a loja/fornecedor não recebe pedidos, o entregador não aceita corridas e ninguém saca.

1. **Aceite os termos** no cadastro.
2. **Preencha dados reais:** nome/razão social, e-mail, CPF/CNPJ, celular, renda/faturamento, endereço com CEP, número e bairro.
3. **Abra o cartão "Minha conta Asaas"** no topo do painel para acompanhar pendências.
4. **Envie os documentos** pedidos pelo Asaas (foto de documento com foto e selfie; para empresas, contrato/cartão CNPJ).
5. **Aguarde a aprovação do Asaas** (`APPROVED`).

| Situação no cartão | O que fazer |
|---|---|
| Aguardando documentos | Enviar os documentos pedidos |
| Em análise no Asaas | Aguardar |
| Aprovada | Vendas, corridas e saques liberados |
| Reprovada | Verificar motivo no cartão e contatar suporte |
| Precisa do admin | CPF/CNPJ já cadastrado no Asaas; suporte resolve |

---

## 7. Como você recebe e Regra de Mesma Titularidade

**Loja / Fornecedor:**
- O cliente paga o Pix direto na sua conta Asaas. O Asaas separa no mesmo momento a comissão do AçaíFood (split) e desconta a tarifa Pix do Asaas.
- O saldo da venda fica **reservado** durante a entrega. Após a digitação do PIN do cliente, o valor da corrida é transferido ao entregador e o restante vira **saldo livre** imediatamente.

**Entregador / Caminhoneiro:**
- Recebe a corrida líquida na sua subconta Asaas no segundo em que o PIN é validado.

**Saque Pix (Todos):**
- Solicite saque na aba Financeiro para chave Pix **CPF ou CNPJ do mesmo titular** (Resoluções BCB nº 1/2020 e nº 80/2021).
- Chaves de terceiros, e-mails ou celulares divergentes são bloqueadas pelo sistema.
- A tarifa Pix do Asaas é descontada do valor transferido. Limite de um saque por vez em processamento.

---

## 8. Painel Administrativo (`/admin`)

Acesso restrito a administradores verificados (`is_admin = true` e MFA/TOTP obrigatório). Todas as ações sensíveis são auditadas de forma imutável em `admin_audit_log`.

| Aba | Descrição e Funcionalidades Principais |
|---|---|
| **Visão Geral** | Cards consolidados calculados diretamente no servidor (`/api/admin/dashboard-stats`): GMV, **Receita Bruta da Plataforma**, **Receita Líquida (pós tarifas Asaas Pix)**, pedidos ativos, volume de transações e balanços. |
| **🗺️ Mapa ao Vivo** | Rastreamento geográfico em tempo real (`/api/admin/live-map`) de batedeiras (aberta/fechada), fornecedores, motoboys e caminhões (online / em corrida). Preserva total privacidade de clientes (LGPD). Mostra tempo da última coordenada (`location_updated_at`), filtros e botão centralizar. |
| **📑 Fechamento Mensal / Notas Fiscais** | Módulo fiscal e contábil (`/api/admin/fiscal-close`): consolidação por competência mensal (AAAA-MM) do faturamento total, comissões retidas, tarifas Asaas e base de cálculo de ISS / NF-e com exportação para contabilidade. |
| **Simulador** | Simulação de viabilidade econômica: comissões, split de tarifas Pix (R$ 0,99/R$ 1,99), ponto de equilíbrio e projeção de receita. Não afeta taxas em produção. |
| **Saques** | Fila de aprovação de saques com validação automática de titularidade contra o Asaas, sincronização de status e estorno de saques rejeitados. |
| **Usuários** | Gestão de contas, filtros por perfil/cidade, bloqueio e desbloqueio. Exclusão bloqueada se houver histórico de pedidos/saques (recomenda-se bloquear). |
| **Pedidos & Balcão** | Acompanhamento em tempo real de status, comandas térmicas, conciliação manual, estornos Asaas e **geração de novo PIN de segurança** para pedidos bloqueados por tentativas excedidas. |
| **Baixa Forçada** | Encerramento emergencial de pedidos travados com **justificativa obrigatória (mínimo 10 caracteres)** gravada em log de auditoria. |
| **Cidades / Tarifas** | Configuração de taxas por município: valor por km, frete mínimo, comissão do app na venda e no frete, divisão da tarifa Pix Asaas, motoristas indicados e módulos de avaliação 1 a 5 estrelas. |
| **Ativações** | Gestão do programa de fundadores (isenção de taxa) e controle da taxa de adesão da plataforma. |
| **Suporte** | Central de atendimento ao vivo, encaminhamento de demandas financeiras para a Ouvidoria Asaas e geração de relatório mensal de conformidade e SLA. |
| **Termos & LGPD** | Histórico imutável de aceites de termos de uso, políticas de privacidade e mandatos Asaas. |
| **🛡️ Conformidade & Segurança** | Auditoria de subcontas Asaas, logs imutáveis (`admin_audit_log`), monitoramento de SLA e proteção de integridade contra comandos destrutivos acidentais (`ALLOW_DESTRUCTIVE_ADMIN_RESET`). |

---

## 9. Conformidade, Segurança e Suporte

- **Instituição de Pagamento Homologada:** Asaas Gestão Financeira Instituição de Pagamento S.A.
- **Auditoria & LGPD:** Proteção de dados confidenciais e registros com rastreabilidade total.
- **Canais de Atendimento:** Suporte integrado no app e canais oficiais da plataforma AçaíFood.
