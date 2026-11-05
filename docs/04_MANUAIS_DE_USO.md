# AçaíFood — Manuais de Uso Oficiais (versão consolidada — 04/11/2026, R51 — modelo "cliente paga a loja")

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
3. **Você paga direto à loja:** no seu banco, o recebedor aparece com o **nome do titular da conta Asaas da loja** que vendeu (normalmente o nome da loja; em contas vinculadas, o nome do titular do CPF/CNPJ). No mesmo Pix, o Asaas separa automaticamente a comissão do AçaíFood.
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

### 4.3 Navegação GPS (Google Maps)
1. **Aceitar corrida:** toque em *"Aceitar Corrida & Abrir GPS"*. O app abre o Google Maps com a rota até a batedeira.
2. **Se o mapa não abrir sozinho** (alguns celulares bloqueiam a abertura automática): aparece um **botão roxo grande** no rodapé, *"Abrir GPS até a batedeira"*. Toque nele.
3. **Chegada na loja:** retire o pedido, digite o **PIN de Balcão** e toque em *"Validar e Abrir GPS do Cliente"*. O app abre a rota até o cliente (ou mostra o botão *"Abrir GPS até o cliente"*).
4. **Atalhos:** os botões *"GPS p/ Retirada"* e *"GPS p/ Cliente"* no card da corrida reabrem a rota no Google Maps quando você quiser.
5. **Sem endereço cadastrado:** o app avisa; use o **Chat & Voz** da corrida para combinar o local.
6. **No cliente:** toque em *"🏁 Cheguei ao Endereço do Cliente"* e siga para o PIN.

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
3. **GPS:** os botões *"📍 Google Maps (Retirada)"* e *"📍 Google Maps (Destino)"* no card do frete abrem a rota no Google Maps.
4. **PIN de descarga:** no destino, o responsável confere a carga e informa o PIN de 4 dígitos.
5. **Quem me indica e avaliações:** gerencie convites separados de Fornecedores e Lojas e avalie as partes envolvidas.

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
| Precisa do admin | CPF/CNPJ já cadastrado no Asaas em nome de outra pessoa; suporte resolve |
| Pedido de vínculo enviado | Você já tem outra conta no app com este CPF/CNPJ; aprove na conta principal (6.1) |

### 6.1 Mais de uma conta com o mesmo CPF/CNPJ (contas vinculadas)
O Asaas permite **uma conta de recebimento por CPF/CNPJ**. Quem tem mais de uma conta no app com outro e-mail (por exemplo, 2 ou 3 lojas, ou loja e motoboy, ou motoboy e fornecedor) usa a mesma conta de recebimento em todas:

1. A primeira conta que abriu a conta Asaas é a **conta principal**.
2. Na segunda conta, ao abrir a conta de recebimento, o app envia um **pedido de vínculo** à conta principal e mostra o e-mail dela (parcialmente oculto).
3. Na conta principal, abra o cartão **"🔗 Contas vinculadas"** no painel e toque em **Aprovar** (ou **Recusar**). O app confere que as duas contas têm o mesmo CPF/CNPJ.
4. Aprovada, a conta vinculada passa a receber vendas e corridas **na mesma conta de recebimento**. O saldo é um só para todas.
5. **Saque:** por padrão só a conta principal saca. A principal pode tocar em **"Liberar saque"** (ou "Bloquear saque") para cada vinculada. Só existe **um saque aberto por vez** em cada conta de recebimento, para evitar saque duplo.
6. **Desvincular:** a conta principal pode desfazer o vínculo quando não houver pedido, corrida ou saque em andamento.
7. No banco do cliente, o recebedor do Pix aparece com o nome do titular do CPF/CNPJ.

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
- A tarifa Pix do Asaas é descontada do valor transferido. Limite de um saque por vez em processamento em cada conta de recebimento (contas vinculadas dividem esse limite; veja 6.1).

---

## 8. Painel Administrativo (`/admin`)

Acesso restrito a administradores verificados (`is_admin = true` e MFA/TOTP obrigatório). Todas as ações sensíveis são auditadas em `admin_audit_log`. Desde a R50 o painel tem **7 abas**, cada uma com subabas:

| Aba | Subabas e funções |
|---|---|
| **📊 Visão Geral** | **Resumo:** pedidos do período (geral, mês, dia), bloco *Receita da AçaíFood* com **Taxas de vendas**, **Taxas de transporte**, Receita bruta (valor das notas), Tarifa Asaas da plataforma e Receita líquida; movimentação total; faturamento dos parceiros; cadastros. **Mapa ao vivo:** batedeiras, fornecedores, motoboys e caminhões (sem clientes, LGPD). |
| **🛒 Pedidos** | **Histórico de pedidos:** status, comandas, comprovantes, estornos, novo PIN para pedido bloqueado e baixa forçada com justificativa (mín. 10 caracteres). **Ocorrências:** casos com exportação PDF/CSV. |
| **👥 Parceiros** | **Usuários:** cadastros, bloqueio e liquidação. **Ativações:** fundadores e taxa de adesão. **Subcontas Asaas e contas vinculadas:** situação de cada subconta (em português), reconsulta, encerramento, e vínculos de contas com o mesmo CPF/CNPJ (aprovar, recusar, liberar saque, desvincular). |
| **💰 Financeiro** | **Saques:** aprovação, validação de titularidade, valor mínimo, modo de pagamento. **Notas do mês:** competência mensal, taxa de vendas, taxa de transporte e **Valor da nota** por parceiro, tarifa Asaas da plataforma, líquido, agrupar por CPF/CNPJ e CSV para o contador. **Repasses dos pedidos:** settlements. **Conta da plataforma:** saldo Asaas e aviso de mínimo. |
| **🎧 Suporte** | Atendimento ao vivo e relatório mensal de chamados. |
| **📢 Anúncios** | Banners e stories. |
| **⚙️ Configurações** | **Pagamentos:** modelo de cobrança, quem paga a tarifa nos estornos, validação de saques (anti-fraude). **Cidades e taxas:** valor por km, frete mínimo, comissões, divisão da tarifa Pix, indicações e avaliações. **Simulador:** viabilidade (não altera as taxas reais). **Auditoria:** log imutável, SLA mensal e *Requisições enviadas ao Asaas* com o botão *Copiar para o suporte*. |

### 8.1 Notas fiscais da plataforma
- A receita do AçaíFood é só a **comissão** (taxa de vendas + taxa de transporte). Venda e frete são dos parceiros.
- **Valor da nota** de cada parceiro = taxa de vendas + taxa de transporte cobradas dele no mês. O tomador é o parceiro (loja/fornecedor pela taxa de vendas; motoboy/caminhoneiro pela taxa de transporte).
- A tarifa Asaas da plataforma é despesa; não é descontada da nota.
- Optantes do Simples Nacional emitem a **NFS-e no padrão nacional** (Emissor Nacional). Código de serviço, alíquota e se a nota pode ser mensal por parceiro: **confirme com o contador**.

---

## 9. Conformidade, Segurança e Suporte

- **Instituição de Pagamento Homologada:** Asaas Gestão Financeira Instituição de Pagamento S.A.
- **Auditoria & LGPD:** Proteção de dados confidenciais e registros com rastreabilidade total.
- **Canais de Atendimento:** Suporte integrado no app e canais oficiais da plataforma AçaíFood.
