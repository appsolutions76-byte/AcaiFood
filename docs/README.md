# Documentação Oficial do AçaíFood (Atualizado Outubro/2026)

Esta pasta `docs/` é a **fonte oficial de verdade** sobre o app e a arquitetura técnica da plataforma AçaíFood.

---

## 📚 Índice de Documentos Atuais

| Arquivo | Descrição e Finalidade |
|---|---|
| [`01_OPERACAO_DO_APP.md`](01_OPERACAO_DO_APP.md) | **Como o app funciona:** Perfis de usuário, três fluxos de pedidos (B2C, B2B, Coleta), ciclo de status, regras de dinheiro e contingência. |
| [`02_ARQUITETURA_TECNICA.md`](02_ARQUITETURA_TECNICA.md) | **Arquitetura técnica:** Stack, organização de pastas, rotas de API Next.js, modelo de banco Supabase, RLS, RPCs e auditoria. |
| [`04_MANUAIS_DE_USO.md`](04_MANUAIS_DE_USO.md) | **Manuais de uso detalhados por perfil:** Cliente, Batedeira/Loja, Fornecedor B2B, Motoboy, Caminhoneiro e Administrador Master (`/admin`). |

---

## 🛡️ Segurança & Conformidade Bancária Asaas

- [`docs/legal/TERMOS_DE_USO_ACAI_FOOD.md`](legal/TERMOS_DE_USO_ACAI_FOOD.md): Termos de Uso oficiais da plataforma AçaíFood (Eletromecânica Baia Ltda - CNPJ 42.035.623/0001-40).
- [`docs/legal/POLITICA_DE_PRIVACIDADE_ACAI_FOOD.md`](legal/POLITICA_DE_PRIVACIDADE_ACAI_FOOD.md): Política de Privacidade e Proteção de Dados (LGPD).
- [`docs/legal/TERMOS_E_POLITICAS_ASAAS.md`](legal/TERMOS_E_POLITICAS_ASAAS.md): Referências oficiais aos termos do Asaas Gestão Financeira S.A. (BACEN).
- [`docs/legal/MANDATO_SUBCONTA_ASAAS.md`](legal/MANDATO_SUBCONTA_ASAAS.md): Instrumento de mandato para abertura e movimentação de subcontas Asaas.
- [`docs/legal/CONSENTIMENTO_PIX_ALEATORIO.md`](legal/CONSENTIMENTO_PIX_ALEATORIO.md): Consentimento para criação e uso de chave Pix aleatória (EVP).
- [`docs/seguranca/PROCESSO_DE_INCIDENTES.md`](seguranca/PROCESSO_DE_INCIDENTES.md): Protocolo de resposta a incidentes de segurança e operacionais.
- [`docs/seguranca/REGISTRO_DE_VULNERABILIDADES.md`](seguranca/REGISTRO_DE_VULNERABILIDADES.md): Registro e matriz de mitigação de vulnerabilidades.
- [`docs/seguranca/BACKUP_E_RESTAURACAO.md`](seguranca/BACKUP_E_RESTAURACAO.md): Políticas de backup contínuo (PITR) e recuperação de desastres.
- [`docs/seguranca/INVENTARIO_DE_TERCEIROS.md`](seguranca/INVENTARIO_DE_TERCEIROS.md): Inventário de terceiros críticos (Asaas, Supabase, Vercel).

---

## 📜 Histórico de Auditorias e Evolução (Imutáveis)

- `03_AUDITORIA_2026-09-23.md`: Sexta auditoria e decisões de modelo de repasse seguro.
- `05_PROMPT_MESTRE_NOVO_APP.md`: Especificação inicial do ecossistema e fluxos da cadeia do açaí.
- `06_PROMPT_CORRECOES_R8.md`: Especificações de transições de status e correções R8.
- `07_AUDITORIA_FINANCEIRA_PIX_2026-09-23.md`: Diagnóstico de checkout Pix e saques.
- `08_PROMPT_HOTFIX_R9_PIX.md`: Hotfix R9 (Pix dinâmico Asaas, remoção de chaves fixas).
- `09_AUDITORIA_2026-10-02.md`: Oitava auditoria (fechamento de brechas de metadata e estorno).
- `10_REAUDITORIA_2026-10-02.md`: Reauditoria R10 e preparação para R11.
- `11_PROMPT_CORRECOES_R11.md`: Especificações de transição de status e RPCs.
- `12_AUDITORIA_POS_R11_2026-10-02.md`: Auditoria pós-R11 que fundamentou o R12 definitivo.
- `13_CONFORMIDADE_CONTRATO_ASAAS_BAAS.md`: Conformidade Contratual Asaas BaaS (Cláusulas 1 a 12 e Anexo I).
- `14_PROMPT_CORRECOES_R12.md`: Especificação R12 consolidada (PINs isolados em `order_pins` e auditoria).
- `15_REAUDITORIA_POS_R12_2026-10-02.md`: Reauditoria pós-R12.
- `16_PROMPT_CORRECOES_R13.md`: Especificações do ciclo R13/R14.
