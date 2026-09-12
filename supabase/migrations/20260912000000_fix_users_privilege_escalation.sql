-- ==========================================================
-- AÇAÍFOOD — FIX PRIVILEGE ESCALATION ON PUBLIC.USERS (MIGRATION)
-- Timestamp: 20260912000000
-- Item P0.1 do PROMPT_CORRECOES_ANTIGRAVITY.md
-- ==========================================================

-- 1. Revogar o UPDATE geral na tabela public.users para authenticated
REVOKE UPDATE ON public.users FROM authenticated;

-- 2. Conceder UPDATE apenas para as colunas legítimas de perfil do usuário
GRANT UPDATE (
  name,
  phone,
  telefone,
  address,
  endereco,
  cidade,
  bairro,
  latitude,
  longitude,
  vehicle_type,
  is_online,
  pix_key,
  cpf_cnpj,
  frete_subsidy_pct
) ON public.users TO authenticated;

-- 3. Trigger para impedir autopromoção a role admin / partner_admin / administrador e is_admin = true
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
    -- Se o chamador não for admin, impede alteração de role para papéis administrativos
    IF lower(COALESCE(NEW.role, '')) IN ('admin', 'administrador', 'partner_admin') THEN
      NEW.role := COALESCE(NULLIF(OLD.role, ''), 'cliente');
    END IF;
    -- Impede alteração de is_admin para true
    NEW.is_admin := COALESCE(OLD.is_admin, false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

NOTIFY pgrst, 'reload schema';
