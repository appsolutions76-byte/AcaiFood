# AçaíFood — Manuais de Uso Oficiais (Versão Atualizada 2026)

> Documentação oficial de operação e fluxos de usuários para a plataforma **AçaíFood**.
> Site Oficial: https://www.acaifood.app.br
> Razão Social e Gateway: **Eletromecânica Baia Ltda** & **Asaas Gestão Financeira Instituição de Pagamento S.A.** (CNPJ: 19.540.550/0001-21)

---

## 1. Cliente (Consumidor Final)

1. **Cadastro & Cidade:** Acesse `/cadastro` (nome, e-mail, senha, telefone com DDD, cidade, bairro e endereço) ou entre diretamente na página inicial com geolocalização ativa.
2. **Escolha do Açaí:** Selecione a batedeira de sua preferência. Escolha a textura/consistência do açaí (*Popular, Médio, Grosso ou Branco*), adicione complementos (farinhas, frutas, leite em pó, churrascos, bebidas) e revise a sacola.
3. **Opções Flexíveis de Entrega:**
   - *Endereço do Cadastro:* Entrega na sua residência cadastrada.
   - *GPS ao Vivo:* Localização exata em tempo real com precisão métrica.
   - *Ponto de Encontro com Referência:* Ideal para portos, trapiches, praças e feiras.
4. **Pagamento Pix Asaas:** QR Code dinâmico e código Pix Copia e Cola gerados instantaneamente. A compensação ocorre em segundos via Webhook oficial.
5. **📄 Comprovante Oficial Asaas:** Após o pagamento ou no histórico de pedidos, toque em **"📄 Comprovante Asaas"** para abrir o recibo com selo oficial Asaas, ID da transação e opção de impressão em PDF A4 ou cupom térmico.
6. **Acompanhamento & Chat:** Acompanhe o motoboy em tempo real pelo mapa interativo (traçado OSRM) e converse pelo Chat interno com atalhos de ligação/WhatsApp.
7. **🔐 Regra de Ouro do PIN (4 dígitos):** O PIN aparece em destaque no card do pedido. **Somente forneça o PIN ao motoboy após receber o açaí em mãos.**
8. **Estorno Pix Automático (Refund):** Caso a batedeira recuse o pedido ou haja cancelamento antes do preparo, 100% do valor é estornado automaticamente para a conta do cliente.
9. **🎧 Suporte ao Vivo:** Atendimento direto com analistas pelo botão flutuante de chat na tela.

---

## 2. Loja / Batedeira de Açaí

1. **Ativação & Homologação:** Acesso conforme vagas de fundadores liberadas pelo Admin ou quitação de taxa de homologação Asaas. Subconta bancária vinculada automaticamente para split.
2. **Gestão de Vitrine & Cardápio:**
   - Configuração de preços (Popular, Médio, Grosso, Branco), fotos e descrições.
   - Adição e precificação de produtos extras (carnes, porções, bebidas, farinhas).
   - **Subsídio de Frete (%):** Definição opcional de percentual de frete que a loja cobre para incentivar as vendas.
3. **Fluxo de Vendas B2C:**
   - Notificação sonoro-visual ao receber pedido com Pix confirmado.
   - Clique em **"Aceitar e Preparar"** (status passa para `preparo`).
   - Impressão térmica automática ou manual de comandas (58mm/80mm) com vias de Cozinha e Entrega contendo o **PIN de Balcão** e selo Asaas.
   - Quando o pedido estiver embalado, clique em **"Chamar Moto"** para liberar a rota no radar dos motoboys.
4. **Abastecimento B2B (Compra de Frutos):**
   - Compras atacadistas de latas/paneiros/sacas de frutos direto dos produtores credenciados.
   - Fornecimento do PIN B2B ao motorista do caminhão no ato do descarregamento.
5. **Logística Reversa ESG (Coleta de Caroço):**
   - Solicitação de caçamba para recolhimento sustentável de caroços destinados a Ecopontos e usinas de biomassa/adubo.
6. **Financeiro & Esteira de Saques:**
   - Repasses líquidos calculados por divisão automática (*Triple Split*).
   - Solicitação de saque do saldo disponível (mínimo padrão de R$ 20,00) via esteira de aprovação com liquidação em conta bancária de mesma titularidade (CPF/CNPJ).

---

## 3. Fornecedor de Frutos (Atacado B2B)

1. **Catálogo Atacadista:** Definição de valores por lata, paneiro ou saca e disponibilidade de estoque.
2. **Separação de Carga:** Ao receber pedido com Pix aprovado pela batedeira, separe o lote no armazém ou porto.
3. **Despacho via "Chamar Caminhão":** Acionamento sob demanda que projeta a carga pesada no radar dos caminhoneiros da região.
4. **Romaneio de Expedição:** Impressão de comprovante/romaneio com dados completos de entrega e identificação Asaas.
5. **Conclusão com PIN:** O caminhoneiro valida a entrega com o PIN da batedeira compradora, liberando o repasse financeiro.
6. **Saques:** Solicitação direta no painel financeiro para conta de mesma titularidade (Resolução BCB / Asaas).

---

## 4. Motoboy (Logística Urbana B2C)

1. **Status Online & GPS:** Transmissão de telemetria em tempo real para recebimento de chamados na sua praça.
2. **Radar de Prontos:** Visualização de corridas liberadas pelas batedeiras após clique em "Chamar Moto", exibindo distância, mapa e ganho líquido transparente.
3. **Navegação GPS:**
   - *🚀 GPS p/ Retirada:* Navegação curva-a-curva até a loja e botão de confirmação de chegada.
   - *🏁 GPS p/ Cliente:* Navegação até a residência ou ponto de encontro do cliente.
4. **Validação do PIN do Cliente:** Digitação do código PIN de 4 dígitos informado pelo cliente no ato do recebimento para conclusão da corrida.
5. **Ganhos & Saques:** Saldo acumulado por entregas com PIN, com solicitação de transferência Pix para a conta bancária do seu CPF cadastrado.

---

## 5. Caminhoneiro / Motorista de Caçamba

1. **Radar Pesado:** Chamados de frete **B2B** (frutos do fornecedor para batedeiras) e **Coleta de Caroço** (batedeiras para ecopontos).
2. **Rotas e Navegação:** Traçado OSRM por vias compatíveis com veículos de carga e atalhos para Google Maps.
3. **Validação de PIN:** Solicitação do PIN ao responsável no destino para homologação do frete.
4. **Repasses:** Saldo líquido com suporte a esteira de saques auditada.

---

## 6. Painel do Administrador Master (`/admin`)

| Módulo / Aba | Funcionalidades Principais |
| :--- | :--- |
| **Visão Geral** | Métricas globais de GMV (volume bruto), receita líquida da plataforma, balanços e gráficos operacionais. |
| **Saques** | Esteira de auditoria, aprovação e rejeição de saques solicitados pelos parceiros com validação de chaves Pix e saldo em subcontas Asaas. |
| **Usuários** | Gestão de contas (Ativar, Pausar, Bloquear, Excluir) e liquidações manuais (*"💸 Pagar e Zerar"* e *"⚡ Pagar Todos"*). |
| **Pedidos** | Auditoria completa de status, inspeção de rotas no mapa, comprovantes fiscais e botão de contingência *"Forçar Baixa"*. |
| **Cidades / Expansão** | Parametrização tarifária independente por município (KM rodado vs. Taxa Fixa, comissões percentuais e horário de varredura). |
| **Ativações** | Configuração da taxa de homologação/adesão de parceiros e controle de vagas promocionais de fundadores. |
| **Suporte ao Vivo** | Central de atendimento em tempo real por chat com clientes e parceiros, com histórico e alertas sonoros. |
| **Anúncios & Stories** | Cadastro e moderação de banners de marketing e stories patrocinados na vitrine inicial. |
| **Ocorrências & Auditoria** | Registro e acompanhamento de incidentes (cancelamentos, disputas, erros de PIN e contestações) com exportação em PDF A4 e CSV. |
