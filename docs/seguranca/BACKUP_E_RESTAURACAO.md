# Política e Procedimento de Backup e Restauração (PITR)

## 1. Visão Geral
A infraestrutura do AçaíFood utiliza o banco de dados gerenciado PostgreSQL no Supabase com suporte a **Point-in-Time Recovery (PITR)** e backups lógicos diários.

## 2. Estratégia de Backup

| Tipo de Backup | Frequência | Retenção | Objetivo de Tempo de Recuperação (RTO) | Objetivo de Ponto de Recuperação (RPO) |
|---|---|---|---|---|
| **Point-in-Time Recovery (WAL Logs)** | Contínuo (tempo real) | 7 dias | < 15 minutos | < 1 segundo |
| **Snapshot Diário Completo** | A cada 24 horas (03:00 UTC) | 30 dias | < 30 minutos | < 24 horas |
| **Dump Lógico Pré-Deploy (pg_dump)** | Antes de cada migration de banco | Permanente no branch do release | < 10 minutos | Ponto exato pré-migration |

## 3. Procedimento de Restauração Testado

### 3.1 Restauração via Dashboard Supabase (PITR)
1. Acessar o Dashboard Supabase do projeto de produção.
2. Navegar para `Database -> Backups -> Point in Time Recovery`.
3. Selecionar a data e horário exato anterior ao incidente (ex: `2026-10-02 18:55:00 UTC`).
4. Iniciar restauração para uma nova instância ou restaurar sobre a instância ativa após confirmação.
5. Executar testes de integridade nas tabelas `orders`, `order_pins`, `settlements`, `withdrawal_requests` e `users`.

### 3.2 Rollback de Migration Específica
Em caso de falha controlada de release ou schema:
1. Executar o script correspondente em `supabase/rollback/<migration_name>.sql`.
2. Notificar o PostgREST para recarregar o schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
3. Executar o build do frontend Next.js para validação de tipos TypeScript.
