# 🥑 AçaíFood — Manuais de Uso Completos para Todos os Usuários

**Ambiente Oficial de Produção:** [https://www.acaifood.app.br/](https://www.acaifood.app.br/)  
*Versão Atualizada: 2026 (Com Radar sob Demanda, Validação de PIN de 4 dígitos, Chat Integrado, Estornos Pix e Divisão Asaas)*

---

## 📑 Índice dos Manuais
1. [🛒 Manual do Cliente (Consumidor Final)](#1--manual-do-cliente-consumidor-final)
2. [🏪 Manual da Batedeira / Loja de Açaí (Varejo B2C)](#2--manual-da-batedeira--loja-de-açaí)
3. [🏭 Manual do Fornecedor de Frutos (Atacado B2B)](#3--manual-do-fornecedor-de-frutos-atacado-b2b)
4. [🛵 Manual do Motoboy Urbano (Entregador B2C)](#4--manual-do-motoboy-urbano-entregador-b2c)
5. [🚛 Manual do Caminhoneiro (Frete Pesado B2B & Coleta ESG de Caroços)](#5--manual-do-caminhoneiro-frete-pesado-b2b--coleta-esg)
6. [👑 Manual do Administrador Geral (Painel Master)](#6--manual-do-administrador-geral-painel-master)

---

## 1. 🛒 Manual do Cliente (Consumidor Final)

### 1.1. Como Fazer um Pedido
1. **Confirmação de Cidade:** Acesse o app oficial e confirme sua cidade no seletor do topo para carregar o catálogo de batedeiras da sua região.
2. **Escolha da Batedeira:** Toque na loja para abrir o cardápio de açaí fresco e adicionais.
3. **Personalização do Açaí:**
   - **Consistência:** *Popular* (mais leve/líquido), *Médio* ou *Grosso* (mais espesso/puro).
   - **Quantidade:** Escolha em litros ou recipientes disponíveis.
   - **Adicionais:** Tapioca, farinha d’água, banana, morango, leite condensado, leite em pó, etc.
4. **Revisão na Sacola:** Confira itens, subtotal dos produtos e o valor do frete (verifique se a loja oferece frete com subsídio promocional).

### 1.2. 3 Opções de Endereço de Entrega
- 🏠 **Endereço do Perfil:** Envia para o endereço cadastrado na sua conta.
- 🛰️ **GPS ao Vivo (Localização Atual):** O app captura suas coordenadas geográficas com precisão métrica.
- 📍 **Ponto de Encontro com Referência:** Ideal para entregas em praças, feiras, trapiches ou portos ribeirinhos. Digite uma referência (ex: *"Porto do Açaí, próximo ao quiosque azul"*).

### 1.3. Pagamento Pix Instantâneo & Estorno Automático
- O app exibe o **QR Code Pix** e o código **Pix Copia e Cola**.
- Copie o código, abra o aplicativo do seu banco e efetue o pagamento.
- **Não precisa enviar comprovante:** A confirmação é instantânea e o pedido muda automaticamente para *Pagamento Confirmado*.
- ↩️ **Estorno Automático (Refund):** Caso você cancele o pedido antes que a loja inicie o preparo, o valor de 100% é estornado automaticamente pelo Asaas diretamente para a sua conta bancária em poucos segundos.

### 1.4. Rastreamento, Chat e a Regra de Ouro do PIN
- 🗺️ **Rastreamento no Mapa:** Veja o traçado real pelas ruas da sua cidade (OSRM) e o ícone da moto se deslocando ao vivo.
- 💬 **Chat Integrado:** Converse com a batedeira ou motoboy diretamente pelo chat do pedido, com atalho para discagem telefônica ou WhatsApp.
- 🔐 **REGRA DE OURO DO PIN (4 DÍGITOS):**
  > **IMPORTANTE:** O seu código PIN de 4 dígitos aparece no card do seu pedido. **Somente informe o PIN ao motoboy após estar com o seu açaí em mãos!** A validação do PIN comprova a conclusão da entrega.

---

## 2. 🏪 Manual da Batedeira / Loja de Açaí

### 2.1. Recebimento e Aceite de Pedidos B2C
1. O pedido entra com alerta sonoro assim que o Pix é pago pelo cliente (status `pendente`).
2. Clique em **"Aceitar e Preparar"**. O pedido passa para o status `preparo`.
3. Imprima as comandas na impressora térmica configurada.

### 2.2. Impressão Térmica de Comandas
- Compatível com impressoras térmicas padrão de 58mm ou 80mm.
- **VIA 1 (Cozinha/Preparo):** Itens, litragem, tipo do açaí e adicionais.
- **VIA 2 (Entrega/Motoboy):** Nome do cliente, telefone com DDD, endereço completo e ponto de referência.

### 2.3. 🏍️ NOVO — Acionamento sob Demanda ("Chamar Moto")
- **Como funciona:** O pedido **NÃO** vai para o radar dos motoboys antes da hora!
- Somente quando o açaí estiver devidamente embalado, lacrado e pronto para saída, clique no botão **"Chamar Moto"** (status `pronto`).
- A partir desse clique, a corrida aparece no radar dos motoboys locais, evitando que o entregador chegue antes da batedeira finalizar o preparo.

### 2.4. Abastecimento B2B & Coleta ESG de Caroços
- **Abastecimento B2B:** Na aba B2B, visualize produtores atacadistas, compre lotes (latas, sacas, paneiros) e pague com Pix dinâmico. O fornecedor envia via caminhão pesado.
- **Coleta de Caroço (Caçamba ESG):** Solicite caçambas de remoção para descarte ecológico dos caroços de açaí em Ecopontos autorizados.

### 2.5. Gestão Financeira e Repasses
- O sistema calcula seu saldo líquido: `Subtotal dos Produtos − Comissão da Plataforma (%) − Subsídio de Frete`.
- Vincule sua chave Pix ou carteira Asaas para recebimento.
- A liquidação é feita pelo Admin via botão *"💸 Pagar e Zerar"* ou pela varredura programada diária às 22:00.

---

## 3. 🏭 Manual do Fornecedor de Frutos (Atacado B2B)

### 3.1. Gestão do Catálogo Atacadista
- Cadastre lotes em grande volume: sacas de frutos de safra, latas de 14kg ou 28kg, paneiros e insumos industriais complementares.
- Configure preços no atacado e subsídio de frete B2B para atrair mais batedeiras da região.

### 3.2. Separação de Lotes e Despacho ("Chamar Caminhão")
1. Ao receber a notificação de compra paga via Pix por uma batedeira, separe e prepare o lote no armazém ou porto.
2. 🚛 **NOVO — Chamar Caminhão:** Clique em **"Chamar Caminhão"** para disponibilizar a carga no radar dos caminhoneiros.
3. Imprima o romaneio/comanda de saída B2B com dados da loja de destino e quantitativos.
4. No destino, o caminhoneiro colhe o PIN de 4 dígitos da batedeira para finalizar o frete.
5. O repasse líquido das vendas atacadistas entra automaticamente em sua conta bancária cadastrada.

---

## 4. 🛵 Manual do Motoboy Urbano (Entregador B2C)

### 4.1. Ficar Online & Radar de Corridas
1. Toque no interruptor de status para ficar **Online** (transmite GPS ao vivo).
2. O radar de corridas lista os pedidos que as batedeiras já aprontaram e clicaram em **"Chamar Moto"**.
3. **Informações Prévias:** Veja o valor líquido a receber, distância em km e traçado da rota pelas ruas antes de aceitar.

### 4.2. Navegação com GPS Nativo & Botões de Chegada
- Toque em **"GPS p/ Loja"**: Abre o Google Maps com navegação curva-a-curva até a batedeira.
- Ao chegar na loja, clique em **"Confirmar Chegada na Loja"** (botão persistente na tela).
- Retire a encomenda e toque em **"GPS p/ Cliente"** para navegar até o endereço final.
- Ao chegar no cliente, clique em **"Confirmar Chegada no Cliente"**.

### 4.3. 🔐 Validação Obrigatória do PIN (4 Dígitos)
- Solicite o PIN de 4 dígitos ao cliente no momento da entrega presencial.
- Digite o PIN no aplicativo e toque em **"Validar e Finalizar"**.
- **Segurança:** O sistema bloqueia após tentativas inválidas consecutivas. Sem o PIN correto, a entrega não é homologada e o valor do frete não é creditado.

### 4.4. Saque Instantâneo Pix
- Acompanhe seus ganhos acumulados no painel e use o botão **"💸 Saque Instantâneo Pix"** para transferir para seu banco a qualquer momento.

---

## 5. 🚛 Manual do Caminhoneiro (Frete Pesado B2B & Coleta ESG)

### 5.1. Modalidades de Carga no Radar
- 🏭 **Fretes B2B:** Transporte de paneiros, sacas e latas de açaí do fornecedor até a batedeira compradora.
- 🚛 **Coleta de Resíduos (Caçamba ESG):** Remoção de caroços da batedeira até os Ecopontos credenciados para reciclagem ecológica.

### 5.2. Execução da Carga
1. Fique **Online** para receber os chamados de carga pesada na sua praça.
2. Analise a distância, remuneração líquida (por KM rodado ou valor fixo) e pontos de carga e descarga.
3. Aceite o frete e utilize a navegação por rotas adequadas a caminhões.
4. No destino, solicite o **PIN de 4 dígitos** ao encarregado do recebimento para confirmar a entrega e liberar o pagamento via Pix.

---

## 6. 👑 Manual do Administrador Geral (Painel Master)

### 6.1. Visão Geral, Métricas & Balanços
- Acompanhe em tempo real o volume total transacionado, receita líquida da plataforma (comissões de vendas + comissões de frete) e gráficos de pedidos por status.
- Fechamento e zeramento seguro de balanços diários, mensais e históricos.

### 6.2. Liquidação em Lote ("💸 Pagar e Zerar")
- Na aba **👥 Usuários**, o sistema agrupa os saldos líquidos acumulados *A Pagar* para cada loja, fornecedor ou entregador.
- Ao clicar em **"💸 Pagar e Zerar"**, o sistema dispara a API `POST /api/asaas/transfer`, enviando o Pix instantâneo e marcando os pedidos como quitados (`payout_seller_done` / `payout_driver_done`).
- **Varredura Automática (Payout Sweep):** Executa no horário configurado (padrão: 22:00) para processar repasses pendentes.

### 6.3. Expansão Municipal & Gestão Tarifária
- Cadastre novas cidades na aba **🌍 Cidades / Expansão**.
- Configure comissões da plataforma (%) e modalidades de frete independentes por cidade:
  - **KM:** Cobrança por km rodado via ruas reais.
  - **FIXED:** Valor fixo de frete para entregas municipais.
- As tarifas por cidade sobrepõem automaticamente as tarifas globais.

### 6.4. Gestão de Usuários e Contingência
- **Controle de Contas:** Ativar, pausar, bloquear ou excluir contas com encerramento de subcontas Asaas.
- **Forçar Baixa de Contingência:** No histórico de pedidos, o botão *"Forçar Baixa"* permite homologar a entrega manualmente em casos excepcionais (ex: o celular do cliente descarregou e a loja confirmou a entrega física), com auditoria administrativa registrada.

---

*AçaíFood © 2026 • Tecnologia, Logística e Sustentabilidade da Cadeia do Açaí no Brasil.*
