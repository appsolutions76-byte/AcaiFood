# AçaíFood — Como o app funciona hoje

> Espelho do código em `açaifoodV1` em 23/09/2026 (último arquivo alterado: `api/asaas/checkout/route.ts`, 22/09).
> Este documento descreve **o que o app faz de verdade**, não o que foi planejado. Onde o comportamento real tem falhas, há uma nota ⚠️ apontando para a auditoria (`03_AUDITORIA_2026-09-23.md`).

Produção: https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)

---

## 1. O que é

Marketplace web/PWA da cadeia do açaí no Pará. Liga quem compra açaí batido, quem bate e vende, quem fornece o fruto, quem entrega e quem recolhe o caroço. A plataforma recebe todos os pagamentos por Pix (Asaas), fica com uma comissão e repassa o resto aos parceiros.

## 2. Perfis (roles)

| Perfil no app | `role` no banco | Painel | O que faz |
|---|---|---|---|
| Cliente | `cliente` | `/` | Compra açaí de uma Loja/Batedeira, paga Pix, informa o PIN ao motoboy |
| Loja/Batedeira | `loja` (aceita `partner`, `batedeira`) | `/parceiros/batedeira` | Vende B2C, compra latas no B2B, pede coleta de caroço, imprime comandas |
| Fornecedor | `fornecedor` (`supplier`) | `/parceiros/fornecedor` | Vende latas de açaí (atacado) para as Lojas/Batedeiras |
| Motoboy | `motorista` (`courier`, `motoboy`) | `/parceiros/motoboy` | Entregas B2C (Loja → Cliente) |
| Caminhão/Caçamba | `motorista` (`caminhao`) | `/parceiros/caminhao` | Fretes B2B (Fornecedor → Loja) e Coletas (Loja → destino do caroço) |
| Admin | `admin` (+ `is_admin = true`) | `/admin` | Controla taxas, cidades, usuários, pedidos, saques, anúncios, suporte |

> O tipo `ecoponto` existe no código, mas não tem painel próprio: quem faz a coleta é o perfil Caminhão/Caçamba.

## 3. Páginas públicas

- `/apresentacao`: landing comercial com vídeo interativo, para atrair clientes e parceiros.
- `/parceiros`: hub que leva cada parceiro ao seu painel/cadastro.
- `/cadastro`: cadastro de qualquer perfil (nome, e-mail, senha, telefone, cidade, bairro, endereço, CPF/CNPJ, GPS). Parceiro recebe `split_enabled = false`.
- `/login`: e-mail e senha (Supabase Auth).
- `/politica-de-privacidade`: termos e LGPD, com a cláusula do Asaas como prestador BaaS.

## 4. Ativação de parceiro (taxa de adesão)

1. Depois do cadastro, o painel do parceiro passa pelo `PartnerActivationGuard`.
2. Os **primeiros 50 parceiros** cadastrados (por data de cadastro) são "fundadores" e **não pagam**. O número 50, a taxa e o liga/desliga ficam em `platform_settings.asaas_platform_wallet_id`, guardados como **JSON** nessa coluna.
3. Os demais pagam **R$ 12,90** via Pix (`/api/asaas/activation`, cobrança com `externalReference = ACTIVATE_<userId>`).
4. Em seguida é criada a **subconta Asaas** do parceiro (`/api/asaas/subaccount` ou Edge Function `asaas-create-subaccount`). A rota salva `asaas_account_id`, `asaas_wallet_id` e `asaas_account_api_key`. O status fica pendente até o Asaas aprovar os documentos (webhook `ACCOUNT_STATUS_*`; `split_enabled = true` só com `GENERAL_APPROVAL`).
   ⚠️ A rota `subaccount` já grava `split_enabled = true` assim que recebe um walletId, e manda `companyType: MEI` para todo CNPJ e `incomeValue` fixo.

## 5. Os três fluxos de pedido

### 5.1 B2C: Cliente → Loja/Batedeira → Motoboy

1. **Escolher loja e montar o carrinho.** O cliente vê as lojas, os 4 tipos de açaí de 1 L (Popular, Médio, Grosso, Branco, cada um com preço, foto, descrição e disponibilidade) e os produtos extras. O carrinho só aceita itens de **uma loja por vez**.
2. **Endereço**, em 3 opções: endereço do cadastro, GPS em tempo real, ou endereço/ponto de encontro digitado.
3. **Frete.** Distância em **linha reta (Haversine)** entre as coordenadas da loja e do destino, calculada no celular (padrão de 3 km se faltar coordenada). Valor = km × tarifa, ou tarifa fixa se a cidade estiver em modo FIXO. A loja pode **subsidiar** uma % do frete (`frete_subsidy_pct`).
4. **Criar o pedido.** O app revalida os preços do carrinho contra o banco e grava `orders` com status `PENDING`, mais `order_items` e `splits` (em centavos).
5. **Pagar.** `/api/asaas/checkout` recalcula o total no servidor (`pricingEngine`) e cria a cobrança Pix com **split** para a wallet da loja (e do motorista, se já houver um). O app mostra o QR Code/copia-e-cola (`PixModal`) e consulta `/api/asaas/status` a cada 2,5 s + Realtime.
6. **Pagamento confirmado.** O webhook do Asaas (`/api/asaas/status` POST ou Edge Function `asaas-webhook`) marca `PAID` e gera o **PIN de 4 dígitos**. O próprio app do cliente também marca `PAID` ao ver o pagamento.
7. **Loja** recebe alerta sonoro, **aceita** (`PREPARING`), imprime a comanda e **chama moto** (`READY`).
8. **Motoboy** vê o pedido no **Radar**, aceita (`accept_order_atomic` → `DELIVERING`), navega por GPS, marca retirada e chegada (`DELIVERED`).
9. **PIN.** O cliente diz o PIN e o motoboy digita (`check_delivery_pin`). Com o PIN certo o pedido vai para `RECEIVED` e os `splits` são liberados. São 5 tentativas; depois disso o pedido fica `PIN_LOCKED` e só o admin destrava ("Forçar baixa").
10. **Cancelamento** antes do PIN: `CANCELLED` + estorno automático (`/api/asaas/refund`, que lê o valor real cobrado no Asaas).

### 5.2 B2B: Loja/Batedeira → Fornecedor → Caminhão

A Loja/Batedeira faz o papel de compradora. Ela escolhe o fornecedor, adiciona latas ao "Carrinho de Abastecimento B2B" e paga por Pix. O fornecedor aceita e prepara, depois clica em **Chamar caminhão**. O caminhão aceita no Radar de Fretes, retira, entrega, e a **Loja/Batedeira diz o PIN** ao caminhoneiro. Quem pode subsidiar o frete é o fornecedor.

### 5.3 Coleta: Loja/Batedeira → Caçamba

A Loja/Batedeira pede a retirada do caroço. O valor é o frete da coleta (km ou fixo). Depois do Pix o pedido vai direto para `READY` e aparece no radar do caminhão. O caminhão confirma com o PIN da Loja/Batedeira. O caroço vai para biomassa, olarias, adubo ou ecopontos, **não volta ao fornecedor**.
⚠️ Na Coleta, o app grava o valor da coleta como `products_subtotal` **e** a distância, e o servidor soma o frete de novo, então a cobrança pode sair em dobro (auditoria C1).

## 6. Status do pedido

Oficiais no banco (`orders_status_check`):
`PENDING`, `AWAITING_PAYMENT`, `PAID`, `PREPARING`, `READY`, `SEARCHING_OPERATOR`, `DELIVERING`, `DELIVERED`, `RECEIVED`, `COMPLETED`, `PIN_LOCKED`, `DISPUTE_OPEN`, `CANCELLED`/`CANCELED`, `REFUND_REQUESTED`, `REFUNDED`, `DELIVERY_FAILED`, `CREATED`.

Na tela, o app traduz esses status para: `aguardando_pagamento`, `pendente`, `preparo`, `pronto`, `em_rota`, `aguardando_cliente`, `entregue`, `arquivado`, `cancelado`.

Cada mudança é registrada em `order_status_history`. Tentativas de PIN ficam em `pin_attempt_log` e impressões em `print_log`.

## 7. Dinheiro: como é calculado e como sai

### 7.1 Taxas (configuráveis pelo admin, global e por cidade)

| Fluxo | Comissão sobre a venda | Frete | Comissão sobre o frete |
|---|---|---|---|
| B2C | `b2c_plat` (%) | `b2c_km` R$/km ou `courier_fixed_fee` | `b2c_mot_plat` (%) |
| B2B | `b2b_plat` (%) | `b2b_km` R$/km ou `transporter_fixed_fee` | `b2b_mot_plat` (%) |
| Coleta | `col_plat` (%) | `col_km` R$/km ou `ecopoint_fixed_fee` | `col_mot_plat` (%) |

Também existem a taxa Pix do Asaas (`asaas_pix_fee_fixed`, padrão R$ 0,99), que pode ser dividida entre 1, 2 ou 3 atores (`asaas_fee_split_actors`), e a comissão combinada de **5% a 10%** sobre as vendas da Loja/Batedeira.

### 7.2 Fórmula (servidor, `lib/pricingEngine.ts`)

```
frete_total       = modo FIXO ? tarifa_fixa : km × tarifa_km
frete_loja        = frete_total × subsídio%
frete_cliente     = frete_total − frete_loja
total_cobrado     = subtotal_produtos + frete_cliente
líquido_vendedor  = subtotal × (1 − comissão_venda%) − frete_loja − parte_taxa_pix
líquido_motorista = frete_total × (1 − comissão_frete%) − parte_taxa_pix
plataforma        = o resto
```

⚠️ O carrinho usa outra cópia dessa conta (`useAppStore.calculateOrderFreight/Taxes`), com padrões diferentes (15% contra 10%). Além disso, o servidor procura a cidade em colunas que o pedido não tem, então hoje **sempre usa a tarifa global** (auditoria C2).

### 7.3 Repasse aos parceiros: há dois mecanismos ligados ao mesmo tempo

1. **Split na cobrança:** o Asaas manda a parte da loja direto para a subconta dela no momento do Pix.
2. **Saque sob aprovação:** o parceiro clica em "Saque" e o servidor cria um `withdrawal_requests` (`PENDENTE`) com o saldo calculado por `lib/partnerBalance.ts` (mínimo R$ 20). O **admin aprova** na aba Saques, ou a **varredura automática** (`/api/asaas/sweep`) aprova no horário configurado. Aí `lib/withdrawalApproval.ts` envia Pix (`/transfers`) para: chave Pix cadastrada → CPF/CNPJ → e-mail → walletId, marca os pedidos como `payout_*_done` e registra `partner_ledger`.

⚠️ Os dois juntos pagam a loja duas vezes pelo mesmo pedido (auditoria A1). A tela do motoboy/caminhão ainda chama isso de "Saque instantâneo, até 2 por dia", mas o limite é só um contador no celular e o saque depende de aprovação.

### 7.4 Legado

`/api/asaas/transfer` ("Pagar e Zerar" do admin) foi restrito a admin. A Edge Function `payout-sweep` foi desativada (só devolve aviso).

## 8. Painel Admin (`/admin`): abas

| Aba | Função |
|---|---|
| Dashboard | GMV, receita da plataforma, balanços diário/mensal/histórico (`admin_balances`), filtros por período e fluxo |
| Usuários | Lista, pausar, bloquear, excluir (encerra subconta), editar dados |
| Pedidos | Histórico completo, filtros, "Forçar baixa" (sem PIN, auditado), estorno |
| Cidades | Cadastrar cidade, ativar/pausar, taxas próprias (KM/FIXO, %, horário e liga/desliga do Pix automático) |
| Ocorrências | `incident_logs`: CANCELAMENTO, ESTORNO_PIX, ERRO_PIN, PIN_BLOQUEADO, DISPUTA, BLOQUEIO_CONTA, RECLAMACAO, OUTRO, com severidade e status |
| Ativações | Taxa de adesão, vagas de fundador, quem pagou |
| Anúncios | Banners e stories (`commercial_ads`, upload em `media-upload`) exibidos na home |
| Suporte | Chat de suporte com usuários (`support_messages`) |
| Saques | Aprovar/recusar `withdrawal_requests`, configurar pagamento automático e valor mínimo |

O admin também tem "Limpar dados" (`clear-data`) e "Zerar balanços" (`reset-balances`).

## 9. Recursos transversais

- **Realtime** (Supabase) para pedidos, com alertas sonoros (`soundAlerts`) para loja, fornecedor e motoristas.
- **Chat do pedido** (`order_messages`), com atalhos para ligar e WhatsApp.
- **Impressão térmica** (`thermalPrinter`, via `window.print` no formato de bobina): comanda de preparo e de entrega.
- **Mapa** (`MapModal`: Leaflet/OSM + rota OSRM) e botões de GPS nativo.
- **Compartilhar loja** (link/card da vitrine), tema claro/escuro, PWA com `manifest.json`.
- **Selo "Serviços financeiros Asaas"** nas telas de dinheiro.
- **Guarda de bloqueio:** usuário pausado/bloqueado não opera, e o trigger do banco impede que ele se reative sozinho.

## 10. Agendamentos e integrações externas

- **Vercel Cron** `0 22 * * *` (19h em Belém) → `/api/asaas/sweep`. ⚠️ A rota só aceita POST e o cron chama com GET, então hoje o cron não roda (auditoria B1).
- **Webhook Asaas**: pagamentos (`PAYMENT_*`), estornos, status de subconta (`ACCOUNT_STATUS_*`).
- **GitHub Actions**: um push na `main` publica todas as Edge Functions no Supabase. O front é publicado pela integração Vercel.
