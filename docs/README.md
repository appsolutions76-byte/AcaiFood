# Documentação Oficial do AçaíFood (Atualizado Pós-R12 / Outubro 2026)

Esta pasta `docs/` é a **fonte oficial de verdade** sobre o app e a arquitetura técnica da plataforma AçaíFood.

---

## 📚 Índice de Documentos Principais

| Arquivo | Descrição e Finalidade |
|---|---|
| [`01_OPERACAO_DO_APP.md`](01_OPERACAO_DO_APP.md) | **Como o app funciona:** Perfis de usuário, três fluxos de pedidos (B2C, B2B, Coleta), ciclo de status, regras de dinheiro e contingência. |
| [`02_ARQUITETURA_TECNICA.md`](02_ARQUITETURA_TECNICA.md) | **Arquitetura técnica:** Stack, organização de pastas, rotas de API Next.js, modelo de banco Supabase, RLS, RPCs e auditoria. |
| [`04_MANUAIS_DE_USO.md`](04_MANUAIS_DE_USO.md) | **Manuais de uso detalhados por perfil:** Cliente, Batedeira/Loja, Fornecedor B2B, Motoboy, Caminhoneiro e Administrador Master (`/admin`). |
| [`13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md`](13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md) | **Conformidade Contratual Asaas BaaS:** Análise cláusula por cláusula, regras KYC, aceite de termos e controles de segurança do Anexo I. |
| [`14_PROMPT_CORRECOES_R12.md`](14_PROMPT_CORRECOES_R12.md) | **Especificação R12 consolidada:** Implementação das correções de segurança, isolamento de PINs em `order_pins` e auditoria. |

---

## 🛡️ Histórico de Auditorias e Evolução

- `03_AUDITORIA_2026-09-23.md`: Sexta auditoria e decisões de modelo de repasse seguro.
- `07_AUDITORIA_FINANCEIRA_PIX_2026-09-23.md`: Diagnóstico de checkout Pix e saques.
- `08_PROMPT_HOTFIX_R9_PIX.md`: Hotfix R9 (Pix dinâmico Asaas, remoção de chaves fixas).
- `09_AUDITORIA_2026-10-02.md`: Oitava auditoria (fechamento de brechas de metadata e estorno).
- `10_REAUDITORIA_2026-10-02.md`: Reauditoria R10 e preparação para R11.
- `11_PROMPT_CORRECOES_R11.md`: Especificações de transição de status e RPCs.
- `12_AUDITORIA_POS_R11_2026-10-02.md`: Auditoria pós-R11 que fundamentou o R12 definitivo.
