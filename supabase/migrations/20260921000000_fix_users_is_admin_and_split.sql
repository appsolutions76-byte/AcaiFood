-- ==========================================================
-- AÇAÍFOOD — FIX USERS IS_ADMIN COLUMN AND TRIGGER (MIGRATION)
-- Timestamp: 20260921000000
-- ==========================================================

-- 1. Adiciona a coluna is_admin se não existir na tabela public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Atualiza os registros existentes definindo is_admin = true para roles administrativas
UPDATE public.users
SET is_admin = TRUE
WHERE lower(COALESCE(role, '')) IN ('admin', 'administrador', 'partner_admin');

-- 3. Atualiza o trigger prevent_role_self_escalation para manipular is_admin com segurança
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_is_admin boolean := false;
BEGIN
  -- Service role sempre pode alterar colunas restritas
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Checa se quem está chamando já é admin no banco
  BEGIN
    SELECT public.is_admin() INTO v_caller_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_caller_is_admin := false;
  END;

  IF NOT v_caller_is_admin THEN
    -- 1. Se o chamador não for admin, impede alteração de role para papéis administrativos
    IF lower(COALESCE(NEW.role, '')) IN ('admin', 'administrador', 'partner_admin') THEN
      NEW.role := COALESCE(NULLIF(OLD.role, ''), 'cliente');
    END IF;

    -- 2. Impede alteração de is_admin para true
    NEW.is_admin := COALESCE(OLD.is_admin, false);

    -- 3. Impede auto-reativação ou alteração de status se a conta estiver bloqueada/pausada/suspensa
    IF lower(COALESCE(OLD.status, '')) IN ('blocked', 'bloqueado', 'paused', 'pausado', 'suspended', 'suspenso')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

NOTIFY pgrst, 'reload schema';
