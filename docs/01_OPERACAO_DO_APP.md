# AçaíFood — Como o App Funciona (Atualizado — Novembro de 2026)

> **Documentação oficial de operação e fluxos de negócio da plataforma AçaíFood.**  
> **Produção:** https://www.acaifood.app.br (espelho: https://acai-food-mobile.vercel.app)  
> **Instituição de pagamento (BaaS):** Asaas Gestão Financeira Instituição de Pagamento S.A. (CNPJ 19.540.550/0001-21)  
> **Tomadora e titular da marca AçaíFood:** Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)

---

## 1. O que é o AçaíFood

Marketplace web e PWA oficial da cadeia do açaí no Pará e regiões de expansão. Conecta os elos produtivos e consumidores:
1. **Consumidores Finais (B2C):** Compram os 5 tipos de açaí (incluindo açaí congelado para viagem), refeições executivas/churrascos com complementos personalizados, produtos com variedades de marcas e bebidas geladas.
2. **Batedeiras Artesanais e Industriais:** Recebem pedidos com pagamento Pix Asaas já garantido, imprimem comandas térmicas (58mm/80mm), acionam entregadores autônomos sob demanda, compram frutos no B2B e solicitam caçambas para descarte sustentável de caroços.
3. **Fornecedores de Frutos (B2B):** Vendem paneiros, latas e sacas de frutos no atacado para as batedeiras e despacham cargas pesadas via caminhoneiros credenciados.
4. **Motoboys Urbanos (Logística B2C):** Visualizam entregas prontas no Radar Urbano com roteamento OSRM e navegação automatizada (redirecionamento automático ao aceitar e após confirmação de retirada), finalizando as corridas com PIN de 4 dígitos.
5. **Caminhoneiros e Caçambeiros (Logística Pesada & ESG):** Transportam cargas pesadas B2B e operam a logística reversa do descarte de caroços para ecopontos e usinas de biomassa/adubo.
6. **Administradores da Plataforma:** Gerenciam tarifas municipais, esteira de saques com titularidade estrita (BCB), monitoramento por Mapa ao Vivo, fechamento fiscal/contábil de NF-e e auditoria imutável.

---

## 2. Perfis de Usuários (Roles)

| Perfil no App | `role` no Banco | Rota Principal | Responsabilidades |
|---|---|---|---|
| **Cliente** | `cliente` | `/` | Catálogo georreferenciado, sacola, personalização de complementos/marcas, checkout Pix Asaas, rastreio em tempo real e fornecimento do PIN ao motoboy. |
| **Loja / Batedeira** | `loja` (ou `batedeira`) | `/parceiros/batedeira` | Gestão de cardápio (5 açaís, refeições, marcas), impressão de comandas, acionamento sob demanda ("Chamar Motoboy"), compras B2B, coleta ESG e saques Pix. |
| **Fornecedor** | `fornecedor` | `/parceiros/fornecedor` | Catálogo de sacas/lotes de frutos, romaneio de carga, acionamento de caminhões e recebimento atacadista. |
| **Motoboy** | `motorista` (`motoboy`) | `/parceiros/motoboy` | Radar de corridas urbanas sem espera, navegação GPS inteligente até a loja e cliente, validação do PIN de entrega e recebimento automático do frete líquido. |
| **Caminhoneiro / Caçamba** | `motorista` (`caminhao`) | `/parceiros/caminhao` | Fretes pesados B2B e coletas de resíduos, conferência de cargas e validação de PIN de descarga. |
| **Administrador Master** | `admin` (`is_admin = true`) | `/admin` | Visão geral calculada no servidor, Mapa ao Vivo, Fechamento Mensal / Notas Fiscais, simulador econômico, aprovação de saques, auditoria e governança. |

---

## 3. Modelo Financeiro (Cobrança Direta na Loja com Split Asaas)

1. **Cliente Paga à Loja (`SELLER_SPLIT`):**
   - No checkout, o Pix emitido pelo Asaas tem como beneficiário a conta Asaas da loja vendedora.
   - No mesmo Pix, o Asaas separa automaticamente a taxa de comissão da plataforma AçaíFood (split de pagamento).
2. **Saldo Reservado Durante o Pedido:**
   - O valor permanece reservado na subconta da loja durante a rota para garantir liquidez em caso de estorno autorizado.
3. **Pagamento Automático da Corrida (Pós-PIN):**
   - Assim que o motoboy valida o PIN de 4 dígitos informado pelo cliente, o app transfere o valor líquido da corrida da conta Asaas da loja para a conta Asaas do motoboy.
   - O saldo restante da venda é liberado como saldo livre para saque da batedeira.
4. **Saques com Mesma Titularidade (BCB):**
   - Qualquer parceiro solicita o saque do saldo livre diretamente para a sua conta bancária sob a mesma titularidade (mesmo CPF ou CNPJ), em total conformidade com as Resoluções BCB nº 1/2020 e nº 80/2021.

---

## 4. Fluxo Operacional Ponta a Ponta (B2C)

```
[1. CLIENTE] 
   Escolhe loja, açaí (5 tipos), refeições com acompanhamentos/marcas
   Gera Pix Asaas → Paga no banco → Pedido vai para PAID
         ↓
[2. BATEDEIRA] 
   Alerta sonoro → Clica em "Aceitar e Preparar" (PREPARING)
   Imprime comanda térmica (58mm/80mm) com itens, opções e PIN Balcão
   Açaí pronto e embalado → Clica em "Chamar Motoboy" (READY)
         ↓
[3. MOTOBOY] 
   Radar toca com ganho líquido e distância → Clica em "Aceitar Corrida"
   🚀 Redirecionamento AUTOMÁTICO para rota GPS até a batedeira
   Chega na batedeira → Retira o açaí e digita o PIN de Balcão da loja
   🏁 Redirecionamento AUTOMÁTICO para rota GPS até o cliente
   Chega no cliente → Solicita o PIN de 4 dígitos
         ↓
[4. CONCLUSÃO & FINANCEIRO] 
   Motoboy valida PIN na tela → Pedido vira RECEIVED
   App transfere o frete líquido da loja p/ o motoboy no Asaas
   Saldo livre liberado para a loja
   Cliente e batedeira podem emitir comprovante oficial Asaas
```

---

## 5. Módulos Avançados do Painel Administrativo (`/admin`)

- **Visão Geral Segura no Servidor:** Indicadores consolidados por backend (`/api/admin/dashboard-stats` e `lib/orderFinance.ts`), apresentando GMV, Receita Bruta da Plataforma e Receita Líquida (pós tarifas Asaas Pix).
- **Mapa ao Vivo (R45):** Visão geoespacial em tempo real de parceiros ativos em rotas e lojas abertas, com privacidade total do cliente (endereços não são expostos em mapa público/geral, conforme LGPD).
- **Fechamento Mensal / Notas Fiscais (R43):** Apuração contábil por competência mensal para emissão de notas fiscais de serviço e apuração de ISS.
- **Esteira de Saques Auditada:** Consulta ao Asaas em tempo real para liquidação e prevenção de duplicidade.
- **Proteção Anti-Destrutiva (R44):** Bloqueio estrito no servidor para limpeza ou redefinição de dados, exigindo credenciais e variáveis explícitas de contingência.
