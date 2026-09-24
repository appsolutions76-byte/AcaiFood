# Documentação do AçaíFood (atualizada em 23/09/2026)

Esta pasta `docs/` é agora a **única fonte de verdade** sobre o app. Ela descreve o código como está hoje.

| Arquivo | Para quê |
|---|---|
| `01_OPERACAO_DO_APP.md` | Como o app funciona: perfis, fluxos, status, dinheiro, admin |
| `02_ARQUITETURA_TECNICA.md` | Stack, pastas, rotas de API, banco, Edge Functions, variáveis, deploy |
| `03_AUDITORIA_2026-09-23.md` | Sexta auditoria: 27 achados em ordem de gravidade + a decisão de negócio pendente |
| `04_MANUAIS_DE_USO.md` | Manual de cada perfil, reflete o app real (substitui os manuais antigos) |
| `05_PROMPT_MESTRE_NOVO_APP.md` | Prompt para construir o AçaíFood do zero, já com as correções |
| `06_PROMPT_CORRECOES_R8.md` | O que funciona e o que não funciona hoje + prompt de correção do app atual (4 fases; repasse depois do PIN para subconta) |
| `07_AUDITORIA_FINANCEIRA_PIX_2026-09-23.md` | Sétima auditoria (noite de 23/09): causa do Pix recusado, novas brechas, saques |
| `08_PROMPT_HOTFIX_R9_PIX.md` | Hotfix urgente: Pix da cobrança Asaas, conciliação, brechas críticas, saques. **Aplicar antes do R8** |

---

## Limpeza da pasta do projeto

Nada foi apagado: a ferramenta usada nesta sessão cria arquivos, mas não consegue mover nem excluir. Faça a limpeza abaixo no Explorador de Arquivos (ou peça numa sessão com acesso de exclusão).

### Arquivar em `docs/historico/` (útil só como histórico de decisões)

- `Auditoria_AcaiFood.docx`, `Reauditoria_AcaiFood.docx`, `Terceira_Auditoria_AcaiFood.docx`, `Quarta_Auditoria_AcaiFood.docx`, `Quinta_Auditoria_AcaiFood.docx`
- `PROMPT_CORRECOES_ANTIGRAVITY.md` e `_R2` a `_R7.md`
- `Planejamento e Arquitetura do Projeto açaifoodV1 (1).docx` (plano original; parte está superado)

### Descartar (desatualizados, duplicados ou enganosos)

| Arquivo | Motivo |
|---|---|
| `AçaíFood.docx` | Descreve Mercado Pago; totalmente superado |
| `AcaiFood_Documentacao_Completa.docx/.html/.pdf` | Substituído por `01` + `02` |
| `MANUAL_COMPLETO_E_AUDITORIA_ACAIFOOD.md` | Promete "saque instantâneo" e "sem spoofing"; substituído por `01`/`03` |
| `MANUAIS_DE_USO_TODOS_OS_USUARIOS.md/.html/.pdf` | Substituído por `04` |
| `CICLO_DE_VIDA_FLUXOS_*.html`, `ciclo_de_vida_fluxos_operacionais_render.html`, `ciclo_de_vida_…grafico.pdf`, `…grafico1.png` | Rascunhos e versões intermediárias do mesmo diagrama |
| Na raiz: `fluxo_operacional_*.jpg`, `torre_controle_admin_master.jpg` | Duplicatas de `apps/mobile/public/` (se quiser guardar as imagens, deixe uma cópia só em `docs/img/`) |

### Scripts SQL soltos na raiz: não apagar sem conferir

`master_clean_schema.sql`, `security_patch_v2.sql`, `supabase_complete_financial_and_reset_patch.sql`, `supabase_performance_patch.sql`, `price_sync_patch.sql`.
Foram rodados à mão no SQL Editor. Antes de descartar: gere um `supabase db diff` contra a produção, transforme o resultado numa migration oficial e só então mova esses scripts para `docs/historico/sql/`.

### No site público (`apps/mobile/public/`), trocar assim que possível

`MANUAIS_DE_USO_TODOS_OS_USUARIOS.pdf` e `AcaiFood_Documentacao_Completa.pdf` estão **acessíveis a qualquer pessoa** e prometem "saque instantâneo, até 2 por dia". Substituir por um PDF gerado de `04_MANUAIS_DE_USO.md`. Isso é uma alteração no app, então não foi feita aqui.

### Código sem uso (remover numa próxima rodada de correção, não agora)

Edge Functions `debug-orders` (**urgente**: pública e expõe dados), `payout-sweep`, `remove-account`, `clear-orders`; `lib/payoutCalc.ts`; `components/BlockedUserGuard.tsx`; `components/admin/UserManagementTable.tsx`; `/api/asaas/documents` (ou criar a tela que a usa).
