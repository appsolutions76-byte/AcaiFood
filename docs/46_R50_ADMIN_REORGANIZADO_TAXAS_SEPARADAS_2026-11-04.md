# R50 — Painel admin reorganizado e taxas de vendas x transporte separadas — 2026-11-04

## O que mudou
Antes eram 13 abas soltas (14 com a Conciliação antiga). Agora são 7 grupos, cada um com subabas:

| Aba | Subabas |
|---|---|
| 📊 Visão Geral | Resumo · Mapa ao vivo |
| 🛒 Pedidos | Histórico de pedidos · Ocorrências |
| 👥 Parceiros | Usuários · Ativações · Subcontas Asaas e contas vinculadas |
| 💰 Financeiro | Saques · Notas do mês · Repasses dos pedidos · Conta da plataforma (· Conciliação Pix antiga, só com "funções antigas") |
| 🎧 Suporte | Atendimento |
| 📢 Anúncios | Comerciais & anúncios |
| ⚙️ Configurações | Pagamentos (modelo de cobrança, tarifa nos estornos, validação de saques) · Cidades e taxas · Simulador · Auditoria (log, SLA, requisições ao Asaas) |

A antiga aba "Conformidade" foi desmontada: cada bloco foi para a subaba do seu assunto.
O aviso de saldo baixo da conta da plataforma leva para Financeiro → Conta da plataforma.

## Taxas separadas
- Visão Geral: bloco "Receita da AçaíFood" com Taxas de vendas, Taxas de transporte, Receita bruta (valor das notas),
  Tarifa Asaas da plataforma e Receita líquida. Rota /api/admin/dashboard-stats passou a devolver
  comissaoVendas, comissaoFrete e tarifaAsaasPlataforma.
- Notas do mês: cards "Taxas de vendas", "Taxas de transporte", "Valor total das notas", "Tarifa Asaas da plataforma",
  "Líquido na conta"; tabela com colunas "Taxa vendas" e "Taxa transporte" antes de "Valor da nota" (somam no agrupamento
  por CPF/CNPJ); faixa "Competência: <mês>" com botões Mês anterior / Mês atual.
- Saques: sem os cards repetidos de volume e receita (ficam na Visão Geral).

## Sem mudança
Nenhum cálculo, regra de pagamento ou banco mudou. Só organização de tela e dois campos novos na rota de estatísticas.

## Arquivos
app/admin/page.tsx, components/admin/AdminComplianceSection.tsx (prop view), components/admin/AdminAccountLinksSection.tsx
(prop show), components/admin/AdminWithdrawalsSection.tsx (prop showRevenueCards), components/admin/AdminFiscalCloseSection.tsx,
components/AdminManualModal.tsx, app/api/admin/dashboard-stats/route.ts, app/api/asaas/subaccount/route.ts (texto).
