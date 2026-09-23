# AçaíFood — Manuais de uso (versão que reflete o app atual)

> Substitui `MANUAIS_DE_USO_TODOS_OS_USUARIOS.*` e o manual mestre antigo. Principal mudança: **saque não é instantâneo**, é uma **solicitação aprovada pelo administrador** (ou paga automaticamente no horário configurado, se o admin ligar essa opção).
> Site: https://www.acaifood.app.br

---

## 1. Cliente

1. **Cadastre-se** em `/cadastro` (nome, e-mail, senha, telefone, cidade, bairro, endereço) e permita o GPS.
2. **Escolha uma loja** na tela inicial. Cada loja mostra o açaí de 1 litro (Popular, Médio, Grosso, Branco) e produtos extras. O carrinho aceita itens de **uma loja por vez**.
3. **Informe onde receber:** endereço do cadastro, sua localização GPS atual, ou um endereço/ponto de encontro digitado. O frete é calculado pela distância até a loja (ou é um valor fixo, se sua cidade usar frete fixo). Algumas lojas pagam parte do frete para você.
4. **Pague por Pix.** Aparece o QR Code e o copia-e-cola. A confirmação é automática em poucos segundos.
5. **Acompanhe** o pedido (pago → em preparo → pronto → a caminho → chegou) e fale com a loja ou o entregador pelo chat, ligação ou WhatsApp.
6. **PIN de 4 dígitos:** aparece no seu pedido depois do pagamento. **Só diga o PIN ao entregador quando o açaí estiver na sua mão.** O PIN é o que libera o pagamento da loja e do entregador.
7. **Cancelar:** antes da entrega com PIN, você pode cancelar e o Pix é estornado automaticamente.

## 2. Loja / Batedeira

**Ativação:** as primeiras 50 lojas/parceiros são fundadores (grátis). Depois disso há uma taxa única de R$ 12,90 por Pix. Em seguida, envie os dados para a sua subconta Asaas. Enquanto o Asaas não aprovar, o recebimento automático fica pendente.

**Vendas (B2C)**
- Configure o cardápio base (preço, foto, descrição e disponibilidade de cada tipo de açaí) e os produtos extras.
- Novo pedido pago toca um alerta. **Aceite** para mandar ao preparo e imprima a comanda (impressora térmica/bobina).
- Com o açaí pronto, toque **Chamar moto**. O pedido vai para o radar dos motoboys.
- Opcional: **subsídio de frete**, uma % do frete que a loja paga no lugar do cliente (sai do seu repasse).

**Compras de fruto (B2B):** em "Abastecimento B2B", escolha o fornecedor, adicione latas ao carrinho e pague por Pix. Quando o caminhão chegar, **informe o seu PIN** ao caminhoneiro para confirmar o recebimento.

**Coleta de caroço:** solicite a coleta, pague o frete da caçamba e informe o PIN ao motorista na retirada. O caroço vai para biomassa, olarias, adubo ou ecopontos.

**Dinheiro:** a plataforma retém a comissão sobre as vendas (definida pelo admin, entre 5% e 10%), o subsídio de frete que você escolheu e a parte da taxa Pix. Para receber, toque em **Solicitar saque** (mínimo R$ 20). A solicitação fica **pendente até o administrador aprovar** ou até o horário do pagamento automático. O Pix vai para a chave/CPF/CNPJ cadastrado no seu perfil.

## 3. Fornecedor (atacado B2B)

1. Defina o **preço da lata** e a disponibilidade.
2. Pedido pago pela Loja/Batedeira: **aceite**, separe e imprima.
3. Toque **Chamar caminhão**.
4. O caminhoneiro confirma a entrega com o PIN da Loja/Batedeira compradora.
5. Opcional: subsídio de frete. Saque: igual ao da Loja/Batedeira (solicitação + aprovação).

## 4. Motoboy (entregas B2C)

1. Fique **Online** para ver o **Radar de corridas**, com distância e ganho líquido.
2. **Aceite.** Só um motoboy consegue aceitar cada corrida.
3. Use **GPS p/ retirada**, marque a **retirada** e depois **GPS p/ entrega**.
4. Na porta, peça o **PIN ao cliente** e digite. São 5 tentativas; depois o pedido bloqueia e só o suporte libera.
5. **Ganhos:** corridas confirmadas com PIN entram no seu saldo. Toque em **Solicitar saque**: o valor vai para aprovação do administrador (não é imediato). *(A tela ainda mostra "saque instantâneo / 2 por dia"; isso será corrigido.)*

## 5. Caminhão / Caçamba

- **Radar de fretes** com dois tipos: **B2B** (latas do fornecedor até a Loja/Batedeira) e **Coleta** (caroço da Loja/Batedeira até o destino).
- O ganho é por km ou valor fixo, conforme a cidade.
- Aceite, use os botões de GPS, e no destino peça o **PIN** ao responsável.
- Saque: solicitação + aprovação, como os demais.

## 6. Administrador (`/admin`)

| Aba | Para que serve |
|---|---|
| Dashboard | Volume, receita da plataforma, balanços diário/mensal/histórico |
| Usuários | Pausar, bloquear, excluir, editar |
| Pedidos | Histórico, filtros, **Forçar baixa** (entrega sem PIN em caso excepcional, fica registrada), estornos |
| Cidades | Criar cidade, ativar/pausar, taxas próprias (km ou fixo, % da plataforma, horário e liga/desliga do Pix automático) |
| Ocorrências | Registrar e acompanhar incidentes (PIN, estorno, disputa, reclamação…) |
| Ativações | Taxa de adesão e vagas de fundador |
| Anúncios | Banners e stories da tela inicial |
| Suporte | Conversas de suporte |
| Saques | **Aprovar ou recusar** saques; configurar o pagamento automático, o horário e o valor mínimo |

⚠️ Enquanto os itens críticos da auditoria não forem corrigidos: **mantenha o pagamento automático desligado** e confira cada saque contra os pedidos entregues com PIN antes de aprovar.
