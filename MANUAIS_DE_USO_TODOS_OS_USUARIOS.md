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
  - 🔑 **PIN B2B da Loja:** Na entrega das latas, a batedeira confere a carga na porta e fornece seu **PIN de 4 dígitos** ao caminhoneiro para concluir a transação.
- **Coleta de Caroço (Caçamba ESG):** Solicite caçambas de remoção para descarte ecológico dos caroços de açaí.
  - 🔑 **PIN de Coleta:** A batedeira possui um PIN exclusivo que é entregue ao motorista da caçamba somente após o carregamento dos resíduos.
  - 📌 **Destinação:** O caroço recolhido é encaminhado para **Usinas de Biomassa, Cerâmicas e Ecopontos de Reciclagem**. O fornecedor de frutos **NÃO** recebe e não precisa receber o caroço de volta.

### 2.5. Gestão Financeira e Repasses
- O sistema calcula seu saldo líquido: `Subtotal dos Produtos − Comissão da Plataforma (%) − Subsídio de Frete`.
- Vincule sua chave Pix ou carteira Asaas para recebimento.
- **Saque Instantâneo Pix:** Realize até **2 saques instantâneos por dia** diretamente para sua conta bancária pelo app, além da varredura programada diária às 22:00.

---

## 3. 🏭 Manual do Fornecedor de Frutos (Atacado B2B)

### 3.1. Gestão do Catálogo Atacadista
- Cadastre lotes em grande volume: sacas de frutos de safra, latas, paneiros e insumos industriais complementares.
- Configure preços no atacado e subsídio de frete B2B para atrair mais batedeiras da região.
- 📌 **Escopo do Fornecedor:** O fornecedor é exclusivamente o produtor/vendedor dos frutos frescos e **NÃO recebe nem tem obrigação de receber caroços de volta**.

### 3.2. Separação de Lotes e Despacho ("Chamar Caminhão")
1. Ao receber a notificação de compra paga via Pix por uma batedeira, separe e prepare o lote no armazém ou porto.
2. 🚛 **NOVO — Chamar Caminhão:** Clique em **"Chamar Caminhão"** para disponibilizar a carga no radar dos caminhoneiros.
3. Imprima o romaneio/comanda de saída B2B com dados da loja de destino e quantitativos.
4. No destino, o caminhoneiro colhe o PIN de 4 dígitos da batedeira para finalizar o frete.
5. O repasse líquido das vendas atacadistas entra automaticamente em sua conta bancária cadastrada (com suporte a até 2 saques instantâneos diários via Pix).

---

## 4. 🛵 Manual do Motoboy Urbano (Entregador B2C)

### 4.1. Ficar Online & Radar de Corridas
1. Toque no interruptor de status para ficar **Online** (transmite GPS ao vivo).
2. O radar de corridas lista os pedidos que as batedeiras já aprontaram e clicaram em **"Chamar Moto"**.
3. **Informações Prévias:** Veja o valor líquido a receber, distância em km e traçado da rota pelas ruas antes de aceitar.

### 4.2. Navegação com GPS Nativo & Botões de Chegada
- Toque em **"GPS p/ Retirada"**: Abre o Google Maps/Waze com navegação curva-a-curva até a batedeira.
- Ao chegar na loja, clique em **"Confirmar Chegada na Loja"** (registra a retirada).
- Retire a encomenda e toque em **"GPS p/ Cliente"** para navegar até o endereço final.
- Ao chegar no cliente, clique em **"Confirmar Chegada no Cliente"**.

### 4.3. 🔐 Validação Obrigatória do PIN (4 Dígitos)
- Solicite o PIN de 4 dígitos ao cliente no momento da entrega presencial.
- Digite o PIN no aplicativo e toque em **"Validar e Finalizar"**.
- **Segurança:** O sistema bloqueia após tentativas inválidas consecutivas. Sem o PIN correto, a entrega não é homologada e o valor do frete não é creditado.

### 4.4. Saque Instantâneo Pix
- Acompanhe seus ganhos acumulados no painel e use o botão **"💸 Saque Instantâneo Pix"** para transferir para seu banco a qualquer momento (até 2 saques por dia).

---

## 5. 🚛 Manual do Caminhoneiro (Frete Pesado B2B & Coleta ESG)

### 5.1. Modalidades de Carga no Radar
- 🏭 **Fretes B2B:** Transporte de paneiros, sacas e latas de açaí do fornecedor até a batedeira compradora.
- 🚛 **Coleta de Resíduos (Caçamba ESG):** Remoção de caroços da batedeira até os Ecopontos e Usinas credenciadas para reciclagem ecológica (não retorna ao fornecedor de frutos).

### 5.2. Execução da Carga & Validação por PIN
1. Fique **Online** para receber os chamados de carga pesada na sua praça.
2. Analise a distância, remuneração líquida (por KM rodado ou valor fixo) e pontos de carga e descarga.
3. Utilize os botões **"🚀 GPS p/ Retirada"** e **"🏁 GPS p/ Destino"** para navegação ponto a ponto.
4. No destino (batedeira ou ponto de coleta), solicite o **PIN de 4 dígitos** ao responsável para confirmar a entrega/coleta e liberar o pagamento líquido via Pix.
5. Realize saques dos seus fretes a qualquer momento pelo botão de Saque Instantâneo Pix (até 2 saques diários).

---

## 6. 👑 Manual do Administrador Geral (Painel Master `/admin`)

O painel administrativo do AçaíFood é o centro nervoso da governança, auditoria e liquidações financeiras da plataforma, estruturado em **9 abas operacionais** com sincronização em tempo real e o **Banco de Dados PostgreSQL (Supabase)** como **Fonte Única da Verdade**.

### 6.1. As 9 Abas do Painel Administrativo

| Aba | Finalidade Operacional |
| :--- | :--- |
| **📊 1. Dashboard** | Monitoramento de GMV, Volume Transacionado Bruto, Receita Retida do AçaíFood, Faturamento por Personagem e totalizadores Histórico, Mensal e Diário com reset de fechamento. |
| **👥 2. Usuários & Parceiros** | Gestão de clientes, batedeiras, fornecedores, motoboys, caminhões e admins. Controle de bloqueio/desbloqueio, exclusão definitiva e botão individual de **`💸 Pagar e Zerar`**. |
| **📦 3. Pedidos & Auditoria** | Filtros avançados por status, tipo de transação (B2C/B2B/Coleta), período e busca por PIN/Asaas. Acesso ao Mapa de Rotas e à **Ficha Completa de Auditoria** com divisão de taxas em centavos. |
| **🌍 4. Cidades & Expansão** | Cadastro de novas cidades, pausa/ativação de praças, configuração de horário do Pix Automático (`payout_time`), ajuste de taxas por KM/Fixas e botão **`⚡ Liquidar`** por praça. |
| **💸 5. Saques & Central Financeira** | Gestão de solicitações de saque de parceiros, ajuste do valor mínimo para saque Pix (R$), liquidação em lote geral/por cidade e aprovação/rejeição com 1-clique. |
| **🎁 6. Ativações & Vagas Fundador** | Gestão da cota gratuita de 50 vagas de Membros Fundadores, cobrança da taxa de ativação Pix (R$ 12,90), proteção anti-curiosos e concessão manual de isenção. |
| **📢 7. Comerciais & Propaganda** | Gestão de banners e stories publicitários no app, upload direto de mídias para CDN/Storage, segmentação por cidade e controle de vigência. |
| **🚨 8. Ocorrências** | Registro, mediação e auditoria de disputas, cancelamentos de pedidos, problemas de endereço e contestações entre clientes, lojas e entregadores. |
| **🎧 9. Suporte ao Vivo** | Chat integrado em tempo real para atendimento e suporte a usuários e parceiros da plataforma. |

---

### 6.2. Sincronização em Tempo Real das 3 Telas de Pagamento e Carteiras Asaas

Existem 3 áreas no painel que visualizam e autorizam repasses financeiros. **Todas as 3 telas e a carteira dos parceiros utilizam exatamente a mesma base matemática e o mesmo banco de dados (estritamente pedidos concluídos com PIN validado):**

1. **Aba Usuários (`activeTab === 'usuarios'`):** 
   - Banner superior com totalizador geral/por praça e botão **`⚡ Pagar Todos`**.
   - Na tabela de cada parceiro, exibe a Chave Pix cadastrada e o botão individual **`💸 Pagar e Zerar`**.
2. **Aba Cidades (`activeTab === 'cidades'`):** 
   - Tabela de praças com a coluna *Repasses Pendentes* e o botão **`⚡ Liquidar`** para pagar todos os parceiros daquela cidade de uma só vez.
3. **Aba Saques (`activeTab === 'saques'` / Central Financeira):** 
   - Resumo do Volume, Receita, Pendente de Repasse e Saques Solicitados, além da tabela de solicitações com botão **`✅ Aprovar Saque`**.

---

### 6.3. Fluxo de Saque Pix e Interligação entre as Telas

#### 🔄 Cenário 1: O Parceiro solicita o saque em seu painel
1. O parceiro (Loja, Fornecedor, Motoboy ou Caminhão) acumula saldo disponível proveniente **exclusivamente de pedidos entregues pós-PIN**.
2. Ao atingir o valor mínimo configurado (ex: $\ge$ R$ 20,00), clica em *"Solicitar Saque Pix"*.
3. O sistema grava o pedido na tabela `withdrawal_requests` com status **`PENDENTE`**.
4. No Admin, na **Aba Saques**, a solicitação surge na fila.
5. O Admin clica em **`✅ Aprovar Saque`**. O sistema aciona uma **trava atômica no banco** e dispara o Pix pelo Asaas (`POST /transfers`).
6. Com a confirmação do Asaas, o sistema:
   - Marca a solicitação como **`PAGO`** (`withdrawal_requests`).
   - Marca todos os pedidos do parceiro como **`payout_seller_done = true`** / **`payout_driver_done = true`** (`orders`).
   - Registra o débito no extrato (`partner_ledger`).
   - Atualiza e zera o saldo instantaneamente em todas as 3 telas e na carteira do parceiro.

#### ⚡ Cenário 2: O Admin paga pela Aba Usuários ou Aba Cidades
* Se o Admin clicar em **`💸 Pagar e Zerar`** na Aba Usuários ou em **`⚡ Liquidar`** na Aba Cidades:
* O sistema envia o Pix via Asaas e aciona a sincronização automática (`markPayoutDone`):
  * Quita os pedidos no banco de dados.
  * **Atualiza imediatamente a solicitação de saque pendente na Central de Saques para `PAGO`**.
  * A solicitação **some da lista de pendências da Aba Saques**, migra para o histórico de "Pagos" e o saldo zera na hora em todas as visões.

---

### 6.4. Gestão Tarifária, Expansão e Contingência
- **Tarifas Dinâmicas por Praça:** As taxas municipais (comissão % de venda, comissão % de frete e valor por KM) configuradas na aba *Cidades* sobrepõem as regras globais e são calculadas em centavos no momento do checkout e do repasse.
- **Forçar Baixa de Contingência:** Em casos excepcionais (ex: o celular do cliente descarregou e a loja confirmou a entrega física), o botão *"Forçar Baixa"* no relatório de pedidos homologa o pedido mediante auditoria administrativa registrada.

---

## 7. 🚀 Página de Apresentação e Divulgação do App (`/apresentacao`)

O **AçaíFood** conta com uma Landing Page comercial interativa projetada para vender a ideia da plataforma, atrair novos clientes, cadastrar batedeiras parceiras e fornecedores de fruto:

- **Link Oficial da Landing Page:** `https://www.acaifood.app.br/apresentacao`
- **Vídeos Curtos de Operação:**
  - 🏪 *Na Batedeira:* Como o pedido entra com som e é impresso na impressora térmica em segundos.
  - 📱 *Do Celular ao Portão:* Como o cliente escolhe a consistência do açaí, paga via PIX e recebe com PIN.
  - 🚛 *Mercado B2B e Frete Pesado:* Conexão direta entre produtores de fruto e batedeiras.
- **Botão "Divulgar App" em Todas as Abas:**
  - Presente no cabeçalho da loja do cliente, painel da batedeira, fornecedor, motoboy, caminhão e admin.
  - Abre modal instantâneo com atalho de compartilhamento no WhatsApp, cópia de link e QR Code para panfletos e redes sociais.

---

*AçaíFood © 2026 • Tecnologia, Logística e Sustentabilidade da Cadeia do Açaí no Brasil.*

