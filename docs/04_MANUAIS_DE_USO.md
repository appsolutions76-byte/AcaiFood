# AçaíFood — Manuais de Uso Oficiais (versão de 24 de outubro de 2026 — modelo "cliente paga a loja")

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

### 1.1 Escolha do açaí e sacola
1. Selecione a **Batedeira/Loja** de sua preferência no catálogo da sua cidade.
2. Escolha o tipo do litro de açaí: **Popular**, **Médio**, **Grosso** ou **Branco**.
3. Adicione complementos (farinha d'água, tapioca, açúcar, frutas, leite em pó, churrascos, bebidas) e revise a sacola. A sacola aceita itens de **uma loja por vez**.

### 1.2 Endereço e entrega
- **Endereço do cadastro**, **GPS em tempo real** ou **ponto de encontro com referência** (feiras, portos, trapiches, praças e barcos).

### 1.3 Pagamento por Pix
1. Ao finalizar, aparece o **QR Code Pix e o Copia e Cola**, gerados pelo Asaas.
2. O valor cobrado é o total calculado pelo servidor (produtos + frete, já com o eventual subsídio da loja).
3. **Você paga direto à loja:** no seu banco, o recebedor aparece com o **nome da loja** que vendeu (conta Asaas da loja). No mesmo Pix, o Asaas separa automaticamente a comissão do AçaíFood.
4. O Pix vale por **60 minutos**. Sem pagamento nesse prazo, o pedido é cancelado.
5. A confirmação é automática em poucos segundos.

### 1.4 🔐 Regra de ouro do PIN de entrega (4 dígitos)
- Depois do pagamento, um **PIN de 4 dígitos** aparece **só na tela do cliente**.
- **Só diga o PIN ao entregador quando o açaí estiver nas suas mãos.**
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
- Configure os preços dos 4 tipos de açaí, fotos, descrições e disponibilidade (Ativo / Esgotado).
- Cadastre complementos, porções, acompanhamentos e bebidas.
- **Subsídio de frete (0% a 100%):** a loja pode pagar parte ou todo o frete no lugar do cliente. O valor sai da sua venda. O app recusa pedidos em que o seu valor não cubra a corrida e as taxas (pedido mínimo).

### 2.3 Recebendo e preparando o pedido
1. Pedido pago toca um alerta sonoro. O dinheiro já entrou na **sua conta Asaas** (reservado até a entrega).
2. Toque em **"Aceitar e Preparar"**.
3. **Comanda:** impressão térmica (58 mm e 80 mm) com itens, endereço, observações e os valores calculados pelo servidor.
4. Com o açaí embalado, toque em **"Chamar Motoboy"**. O pedido aparece no radar dos entregadores autônomos da cidade; qualquer um com conta Asaas aprovada pode aceitar. Você não contrata o motoboy.
5. Depois que o cliente informa o PIN, o app paga a corrida automaticamente da sua conta Asaas para a do motoboy.

### 2.4 PIN de retirada (balcão)
- Quando o motoboy chegar, a loja pode exigir o **PIN de Retirada** mostrado no painel.

### 2.5 Abastecimento B2B (compra de frutos)
- Compre latas, paneiros ou sacas direto dos fornecedores na aba B2B e pague por Pix.
- Quando o caminhão chegar, informe o **seu PIN** ao caminhoneiro para confirmar o recebimento.

### 2.6 Coleta de caroço (ESG)
- Solicite a coleta pelo painel e pague o frete da caçamba. O motorista recolhe o caroço para ecopontos, olarias, caldeiras ou compostagem e confirma com o seu PIN.

### 2.7 Dinheiro
- Você recebe na hora do Pix, na sua conta Asaas. Detalhes e exemplo na seção 7.

---

## 3. Fornecedor de Frutos (Atacado B2B)

1. **Catálogo:** cadastre o lote (lata, paneiro ou saca), tipo do fruto, origem e preço.
2. **Pedido B2B pago:** separe o lote no porto, feira ou armazém.
3. **Chamar Caminhão:** os caminhoneiros veem a carga no radar.
4. **Romaneio:** emita o comprovante de saída do lote.
5. **Conclusão:** a batedeira confirma o recebimento pelo PIN. Logo depois, o app paga o frete do caminhoneiro a partir da sua conta Asaas.
   O Pix da batedeira cai direto na **sua conta Asaas**, com a comissão do app separada no mesmo Pix (split).
6. Conta Asaas e saque: seções 6 e 7.

---

## 4. Motoboy / Entregador (B2C)

### 4.1 Cadastro
1. Cadastre-se em `/cadastro` com o perfil **Motoboy**: CPF, celular, endereço completo e dados do veículo.
2. Abra a sua conta Asaas (seção 6).
3. Permita o GPS.

### 4.2 Radar de pedidos
- Você é **autônomo**: atende qualquer loja da cidade, sem contrato com ela. Para aceitar corridas, sua conta Asaas precisa estar aprovada.
- Mostra os pedidos prontos da sua região com bairro de retirada, distância aproximada e **ganho líquido** da corrida.
- Ao tocar em **"Aceitar Corrida"**, ela fica só com você.

### 4.3 Retirada e rota
1. Siga o GPS até a batedeira e marque a retirada.
2. Vá até o cliente pelo mapa do app ou pelo Google Maps / Waze.

### 4.4 ⚠️ PIN do cliente (obrigatório)
- No destino, peça o **PIN de 4 dígitos** que está no celular do cliente, digite e toque em **"Confirmar Entrega"**.
- São no máximo **5 tentativas**. Depois disso o pedido bloqueia e só o suporte libera (o cliente recebe um PIN novo).
- **Nunca entregue o açaí sem o PIN correto.**

### 4.5 Ganhos e saque
- Logo após o PIN, o app transfere a corrida **da conta Asaas da loja para a sua conta Asaas**. Se houver troca de entregador, só quem finaliza recebe.
- Se a loja estiver sem saldo naquele momento, a corrida fica pendente e é paga automaticamente assim que entrar saldo (próxima venda ou rotina diária).
- Saque: seção 7.

---

## 5. Caminhoneiro / Caçamba (Carga)

1. **Radar de cargas:** fretes B2B (fornecedor → batedeira) e coletas de caroço (batedeira → destino).
2. O ganho é por km ou valor fixo, conforme a cidade. **Frete B2B:** pago após o PIN, da conta do fornecedor para a sua. **Coleta de caroço:** a loja paga o frete à plataforma, que paga você após o PIN no destino.
3. **PIN:** no destino, o responsável informa o PIN e você confirma. Mesma regra de 5 tentativas.
4. Conta Asaas e saque: seções 6 e 7.

---

## 6. Como abrir sua conta Asaas (todos os parceiros)

Todo parceiro (batedeira, fornecedor, motoboy, caminhoneiro) recebe por uma **subconta Asaas em seu nome**, aberta pelo AçaíFood com a sua autorização (Mandato), dada no aceite dos termos. Sem ela aprovada, a loja/fornecedor não recebe pedidos, o entregador não aceita corridas e ninguém saca. Na aprovação, o app cria a chave Pix aleatória e as notificações da conta (Consentimento Pix).

1. **Aceite os termos** no cadastro.
2. **Preencha os dados reais:** nome ou razão social, e-mail, CPF ou CNPJ, celular, renda ou faturamento mensal, CEP, rua, número e bairro (tipo de empresa e data de nascimento quando o Asaas pedir). O app não completa nada por você.
3. **Abra o cartão "Minha conta Asaas"** no topo do painel. Ele mostra a situação e os documentos pedidos (documento com foto e selfie; para CNPJ, também o documento da empresa).
4. **Envie os documentos** pelo link do Asaas (quando aparecer) ou pelo botão de envio do cartão.
5. **Aguarde a análise do Asaas.** A situação muda sozinha; se quiser, toque em **"Reconsultar"**.

| Situação no cartão | O que fazer |
|---|---|
| Aguardando documentos | Enviar os documentos pedidos |
| Em análise no Asaas | Aguardar |
| Aprovada | Pronto: vendas, corridas e saque liberados |
| Reprovada | Ver o motivo no cartão e falar com o suporte |
| Precisa do admin | Já existe conta no Asaas com seu CPF/CNPJ; o suporte resolve com você |

- **Não troque o CPF/CNPJ** depois de abrir a conta. Se precisar corrigir, fale com o suporte.
- **Quem tinha conta aberta antes de outubro/2026:** a conta antiga será encerrada pelo Asaas e o seu perfil ficará "sem subconta". Abra a nova em "Minha conta Asaas" e envie os documentos de novo.
- **Início da operação:** o Asaas limita o número de subcontas e o valor movimentado por subconta. Se o seu saque for recusado por limite, o suporte avisa.

---

## 7. Como você recebe (todos os parceiros)

**Loja / fornecedor (vendedor)**
- O cliente paga o Pix **direto na sua conta Asaas**. No mesmo Pix, o Asaas separa a **comissão do AçaíFood** (% sobre a venda + % sobre o frete, definidos por cidade pelo admin) e desconta a tarifa Pix (dividida entre loja, entregador e plataforma conforme a cidade, pelo valor de custo).
- Venda + frete ficam com você. O subsídio de frete que você escolheu sai daqui.
- Até a entrega, o valor fica **reservado** (para eventual estorno). Depois do PIN, o app paga a corrida ao entregador e o restante vira **saldo livre**.

**Exemplo (cidade com 10% na venda e 10% no frete):** pedido de R$ 42,00 = venda R$ 36,00 + frete R$ 6,00. Comissão do app: R$ 3,60 + R$ 0,60 = R$ 4,20, separada no Pix. Ficam na conta da loja R$ 37,80, menos a parte dela da tarifa Pix. Após o PIN, a corrida (frete menos a comissão do frete e a parte da tarifa do entregador) vai para o motoboy. O resto é saldo livre da loja.

**Entregador / caminhoneiro**
- Recebe a corrida na sua conta Asaas logo depois do PIN, transferida da conta do vendedor (ou da plataforma, na coleta).

**Saque (todos)**
- Toque em **"Solicitar Saque"** no Financeiro. O Pix sai **da sua própria conta Asaas** para uma chave **CPF ou CNPJ do mesmo titular** cadastrado. Outras chaves (e-mail, celular, aleatória ou de terceiros) são recusadas.
- O admin aprova (ou é automático, se ativado). O saque fica "em processamento" até o Asaas confirmar, e só então aparece como pago. A tarifa Pix do Asaas é descontada do valor enviado.
- Há valor mínimo de saque e **um saque em andamento por vez**. O botão só aparece com a conta Asaas **aprovada**. Valores reservados não podem ser sacados.
- Dúvidas: Suporte no app. Reclamações sobre o serviço financeiro são encaminhadas ao Asaas.

---

## 8. Painel Administrativo (`/admin`)

Acesso restrito a administradores verificados no banco (`is_admin = true` / `role = 'admin'`). **MFA obrigatório:** toda conta admin cadastra o autenticador (TOTP) no primeiro acesso; sem MFA as rotas de admin respondem "não autorizado". Toda ação sensível fica no `admin_audit_log`, que não pode ser alterado nem apagado.

| Aba | Principais ações |
|---|---|
| **Visão Geral** | GMV, receita da plataforma, pedidos ativos e balanços |
| **Saques** | Aprovar ou recusar saques. O Pix sai da conta Asaas do próprio parceiro para chave CPF/CNPJ do mesmo titular, com valor limitado ao saldo livre (descontadas as reservas); "Liquidar Pix / Sincronizar" consulta o Asaas sem duplicar |
| **Usuários** | Filtros por perfil e cidade, bloqueio/desbloqueio. **Excluir** é recusado se a conta tem pedido pago ou saque (use **Bloquear**); quando permitido, a subconta Asaas é encerrada antes e, se o Asaas recusar, o usuário não é excluído |
| **Pedidos** | Pedidos em andamento, comprovantes Asaas, histórico de status, **gerar novo PIN** (destrava o pedido bloqueado; o admin não vê o PIN), conciliação manual (só pedido aguardando pagamento e com valor recebido ≥ valor do pedido) e estornos (valor sempre informado pelo Asaas) |
| **Baixa Forçada** | Dar baixa em pedido travado, com **justificativa obrigatória de no mínimo 10 caracteres**, registrada com IP e usuário |
| **Cidades / Tarifas** | Valor por km, frete mínimo, **App na Venda (%)**, **App no Frete (%)**, valor da corrida e divisão da tarifa Pix por município. Cada pedido grava as taxas do momento (snapshot) |
| **Ativações** | Taxa de ativação da plataforma (liga/desliga, com log) e vagas de fundadores |
| **Suporte** | Atendimento em tempo real, **encaminhar ao Asaas** reclamações sobre serviço financeiro, marcar se a reclamação foi **procedente** e baixar o **Relatório mensal** (mês AAAA-MM: chamados, procedentes, encaminhados ao Asaas e disponibilidade) |
| **Termos & LGPD** | Registros de aceite dos termos |
| **🛡️ Conformidade** | **Subcontas Asaas** (situação, CPF/CNPJ mascarado, "Reconsultar", filtro "Só com problema", **Encerrar no Asaas**, **Desvincular (já encerrada no Asaas)**); **Repasses** (corridas pagas após o PIN, comissões; aprovar `REVIEW` com valor recalculado ou cancelar); **Modelo de pagamento** (`SELLER_SPLIT` = cobrança na loja, padrão; `ROOT` = cobrança na conta raiz, só contingência); **Log de auditoria**; **SLA mensal** |

> **Ciclo do dinheiro (modelo SELLER_SPLIT):** Pix emitido na conta Asaas da loja → split da comissão para a conta raiz → valor reservado até a entrega → PIN do cliente → app transfere a corrida da conta da loja para a do entregador (repasse `DRIVER`, tabela `settlements`; se faltar saldo, fica pendente e é pago na próxima venda ou pelo cron diário) → parceiro saca para chave CPF/CNPJ própria. O saque automático é opcional e fica desligado por padrão.

---

## 9. Conformidade, segurança e suporte

- **Instituição de pagamento:** Asaas Gestão Financeira Instituição de Pagamento S.A.
- **Atendimento:** Suporte integrado no app.
- **Reclamações sobre serviços financeiros:** encaminhadas pela plataforma ao Asaas, conforme o contrato de prestação de serviços.
- **Proteção de dados (LGPD):** dados pessoais e PINs ficam acessíveis só a quem participa da transação.
