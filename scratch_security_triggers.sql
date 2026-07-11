-- ==========================================
-- 8. TRIGGERS DE SEGURANÇA E ANTIFRAUDE
-- ==========================================

-- 8.1 Prevenir Escalonamento de Privilégios (Tabela users)
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplica a trava apenas para usuários do aplicativo (não afeta o sistema/service_role)
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    -- Bloqueia tentativa de criar ou virar ADMIN
    IF (NEW.role = 'ADMIN') THEN
      RAISE EXCEPTION 'Acesso negado: Tentativa de escalonamento de privilégios para ADMIN.';
    END IF;
    -- Bloqueia tentativa de alterar a própria role depois de criado
    IF (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) THEN
       RAISE EXCEPTION 'Acesso negado: Você não tem permissão para alterar seu nível de acesso.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_user_role ON public.users;
CREATE TRIGGER trigger_protect_user_role
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_role();


-- 8.2 Blindagem Financeira de Pedidos (Tabela orders)
CREATE OR REPLACE FUNCTION public.protect_order_financials()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplica a trava apenas para usuários do aplicativo (não afeta Edge Functions ou Admins)
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    -- Se o usuário tentar alterar qualquer coluna financeira do pedido, a transação falha
    IF (NEW.products_subtotal IS DISTINCT FROM OLD.products_subtotal) OR
       (NEW.delivery_distance_km IS DISTINCT FROM OLD.delivery_distance_km) OR
       (NEW.applied_platform_fee_percent IS DISTINCT FROM OLD.applied_platform_fee_percent) OR
       (NEW.applied_delivery_fee_per_km IS DISTINCT FROM OLD.applied_delivery_fee_per_km) OR
       (NEW.applied_delivery_platform_fee_percent IS DISTINCT FROM OLD.applied_delivery_platform_fee_percent) THEN
       
       RAISE EXCEPTION 'Acesso negado: Usuários não podem alterar valores financeiros do pedido. Apenas o servidor tem essa permissão.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_order_financials ON public.orders;
CREATE TRIGGER trigger_protect_order_financials
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_order_financials();
