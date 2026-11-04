# R43 — Fechamento Mensal / Notas Fiscais (2026-11-04)

Nova aba no Admin: **🧾 Fechamento / Notas**. Somente leitura (não mexe em pagamentos). Sem migration.

## O que mostra

- Escolha do mês (qualquer mês; nos primeiros 10 dias abre no mês anterior).
- Filtro por tipo: Batedeiras, Motoboys, Fornecedores, Caminhões ou Todos; busca por nome, CPF/CNPJ, e-mail ou cidade.
- Uma linha por parceiro: nome, CPF/CNPJ, pedidos, vendas ou fretes, **comissão cobrada** (base sugerida da nota),
  tarifa Pix Asaas paga pelo parceiro, frete pago pela loja e repasse líquido.
- Totais do mês: comissão de vendas, comissão de frete, comissão total, tarifa Asaas, receita líquida da plataforma.
- Exportar CSV para o contador (separador `;`, abre no Excel).

## Regras

- Competência = data de conclusão do pedido (`received_at`), horário de Belém (UTC-3).
- Só pedidos concluídos (`RECEIVED`/`COMPLETED`); cancelados e estornados ficam fora.
- Valores do `pricing_snapshot` gravado no pagamento. Pedidos antigos sem snapshot: estimativa pelos
  percentuais gravados no pedido (marcados como "estimado").
- Consulta no servidor (`/api/admin/fiscal-close`, só admin), sem o limite de 200 pedidos da tela.
- Vendedor = dono da vitrine do pedido (batedeira na B2C, fornecedor na B2B); entregador = motorista do pedido.

## Arquivos

- `apps/mobile/src/app/api/admin/fiscal-close/route.ts` (novo)
- `apps/mobile/src/components/admin/AdminFiscalCloseSection.tsx` (novo)
- `apps/mobile/src/app/admin/page.tsx` (aba nova)

Qual valor usar na nota (comissão bruta ou outro critério) deve ser confirmado com o contador.
