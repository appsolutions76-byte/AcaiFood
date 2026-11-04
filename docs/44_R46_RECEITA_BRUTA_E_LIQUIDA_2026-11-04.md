# R46 — Receita bruta ao lado da líquida no Admin (2026-11-04)

Só exibição; sem banco e sem mudança em pagamentos.

- **Bruta** = comissões cobradas (venda + frete).
- **Líquida** = bruta − parte da tarifa Pix Asaas paga pela plataforma.

Onde aparece: Visão Geral (cartão Receita), Histórico de Pedidos (cartão e PDF do relatório) e Financeiro & Repasses
(cartão Receita AçaíFood). O Fechamento / Notas já mostrava as duas.

Arquivos: apps/mobile/src/app/admin/page.tsx, apps/mobile/src/components/admin/AdminWithdrawalsSection.tsx
