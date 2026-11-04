-- ==============================================================================
-- AÇAÍFOOD R45 — Hora da última posição do usuário (mapa ao vivo do admin).
-- Só ADICIONA uma coluna; nada existente muda. Gravada pelo servidor (/api/user/location).
-- Não é exposta ao app (sem GRANT para anon/authenticated); só o admin lê pelo servidor.
-- Timestamp: 20261104010000
-- Reversão: supabase/rollback/20261104010000_r45_users_location_updated_at_rollback.sql
-- ==============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

NOTIFY pgrst, 'reload schema';
