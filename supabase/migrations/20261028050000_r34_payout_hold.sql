-- ==============================================================================
-- AÇAÍFOOD R34 — Saque suspenso quando o usuário troca a chave Pix ou o CPF/CNPJ
-- Timestamp: 20261028050000
-- Quando pix_key, pix_key_type ou cpf_cnpj que já existiam são trocados (por qualquer
-- caminho), users.payout_hold vira true e nenhum saque é pago até o admin liberar no
-- painel (depois de confirmar com o parceiro por e-mail ou suporte). O usuário não
-- consegue desfazer o bloqueio.
-- Reversão: supabase/rollback/20261028050000_r34_payout_hold_rollback.sql
-- ==============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pix_key_type text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold_reason text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold_released_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold_released_by uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payout_hold_release_note text;

CREATE OR REPLACE FUNCTION public.r34_norm_key(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IS NULL OR btrim(v) = '' THEN ''
    WHEN v ~ '^[0-9.\-/ ()+]+$' THEN regexp_replace(v, '\D', '', 'g')
    ELSE lower(btrim(v))
  END;
$$;

CREATE OR REPLACE FUNCTION public.users_payout_hold_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Pelo app (authenticated/anon) ninguém mexe no próprio bloqueio.
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.payout_hold := OLD.payout_hold;
    NEW.payout_hold_reason := OLD.payout_hold_reason;
    NEW.payout_hold_at := OLD.payout_hold_at;
    NEW.payout_hold_released_at := OLD.payout_hold_released_at;
    NEW.payout_hold_released_by := OLD.payout_hold_released_by;
    NEW.payout_hold_release_note := OLD.payout_hold_release_note;
  END IF;

  -- Qualquer troca de chave Pix, tipo da chave ou CPF/CNPJ que já existia suspende os saques,
  -- venha de onde vier (app, servidor ou painel do banco). Só o admin libera, pelo painel.
  IF (public.r34_norm_key(OLD.pix_key) <> '' AND public.r34_norm_key(NEW.pix_key) <> public.r34_norm_key(OLD.pix_key))
     OR (public.r34_norm_key(OLD.cpf_cnpj) <> '' AND public.r34_norm_key(NEW.cpf_cnpj) <> public.r34_norm_key(OLD.cpf_cnpj))
     OR (coalesce(btrim(OLD.pix_key_type), '') <> '' AND upper(coalesce(btrim(NEW.pix_key_type), '')) <> upper(btrim(OLD.pix_key_type))) THEN
    NEW.payout_hold := true;
    NEW.payout_hold_reason := 'Chave Pix ou CPF/CNPJ alterado em ' || to_char(now() AT TIME ZONE 'America/Belem', 'DD/MM/YYYY HH24:MI');
    NEW.payout_hold_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_payout_hold_guard ON public.users;
CREATE TRIGGER trg_users_payout_hold_guard
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_payout_hold_guard();

-- Colunas do bloqueio: o app não grava (o gatilho já desfaz; isto é uma segunda barreira)
DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE (payout_hold, payout_hold_reason, payout_hold_at, payout_hold_released_at, payout_hold_released_by, payout_hold_release_note) ON public.users FROM anon, authenticated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'R34: revoke de colunas ignorado: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
