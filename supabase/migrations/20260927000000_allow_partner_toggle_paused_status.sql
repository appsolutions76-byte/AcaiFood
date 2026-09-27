-- ==========================================================
-- AÇAÍFOOD — PERMITIR ABERTURA/FECHAMENTO DE LOJA (PAUSED/ACTIVE)
-- Timestamp: 20260927000000
-- ==========================================================

-- 1. Atualiza a função prevent_role_self_escalation
-- Permite que parceiros e motoristas alternem livremente entre 'active' (aberto/online) e 'paused' (fechado/offline),
-- bloqueando apenas a autorreativação de contas com punição administrativa ('blocked'/'suspended').
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_is_admin boolean := false;
BEGIN
  -- Service role sempre pode alterar qualquer campo
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
    -- 1. Impede auto-atribuição de privilégios de administrador
    IF lower(COALESCE(NEW.role, '')) IN ('admin', 'administrador', 'partner_admin') THEN
      NEW.role := COALESCE(NULLIF(OLD.role, ''), 'cliente');
    END IF;

    -- 2. Impede alteração de is_admin para true
    NEW.is_admin := COALESCE(OLD.is_admin, false);

    -- 3. Impede auto-reativação apenas se a conta estiver sob punição administrativa (bloqueada/suspensa)
    IF lower(COALESCE(OLD.status, '')) IN ('blocked', 'bloqueado', 'suspended', 'suspenso')
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
