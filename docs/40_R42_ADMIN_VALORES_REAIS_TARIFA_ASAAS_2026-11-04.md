# R42 — Admin mostra os valores reais do pedido (com tarifa Pix Asaas) (2026-11-04)

Sem mudança de banco e sem mudança em pagamentos/repasses: só exibição no painel Admin.

## Problema

O Histórico de Pedidos, a Ficha, os totais do painel, o CSV e o PDF recalculavam os valores na hora
com as taxas atuais e ignoravam a tarifa Pix do Asaas (R$ 0,99 rateada em R$ 0,33 por ator).

Exemplo — pedido #0d8532 (04/11/2026), açaí R$ 8,50, frete R$ 3,00 com 50% pago pela loja:

| | Tela antes | Real (gravado no pagamento) |
|---|---|---|
| Repasse loja | R$ 6,36 | R$ 6,03 |
| Repasse motoboy | R$ 2,94 | R$ 2,61 |
| Receita app | R$ 0,70 | R$ 0,37 líquido (0,70 − 0,33) |
| Tarifa Asaas | — | R$ 0,99 |
| Cliente pagou | — | R$ 10,00 |

## Correção

- `calculateOrderTaxes` usa o `pricing_snapshot` do pedido (valores congelados pelo servidor) quando existe;
  pedidos antigos sem snapshot continuam com a estimativa (e a Ficha avisa isso).
- Novos campos: tarifa Asaas total e rateio (vendedor, entregador, plataforma), receita líquida do app,
  frete pago pela loja e total pago pelo cliente.
- "Receita App" (painel, histórico, Financeiro) passa a ser **líquida** da parte Asaas da plataforma.
- Totais do relatório somam só pedidos **concluídos** (cancelados/estornados não têm repasse).
- CSV ganha colunas: Comissão App Bruta, Tarifa Pix Asaas, Receita App Líquida.

## Arquivos

- `apps/mobile/src/store/useAppStore.ts` (mapeia `pricing_snapshot` e `asaas_fee_amount`; `calculateOrderTaxes`)
- `apps/mobile/src/app/admin/page.tsx`
- `apps/mobile/src/components/admin/AdminWithdrawalsSection.tsx` (texto do card de receita)
