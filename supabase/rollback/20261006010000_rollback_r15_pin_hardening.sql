-- ==============================================================================
-- ROLLBACK de 20261006010000_r15_pin_hardening.sql
--
-- ATENÇÃO: NÃO volta as funções check_*_pin para a versão de 03/10 (PIN mestre
-- 4821/9354, aceite sem PIN e acesso anônimo). Aquela versão é a falha.
-- Este rollback só desliga a trava do trigger, caso ela bloqueie algum fluxo
-- legítimo que não foi previsto. As funções seguras continuam valendo.
-- Se uma função de PIN falhar em produção, corrigir PARA FRENTE (nova migration).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
