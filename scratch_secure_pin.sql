-- 1. Adicionar coluna temporária para validação
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provided_pin text;

-- 2. Criar a função do Trigger
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplica a restrição de validação de PIN apenas se não for ADMIN e for um usuário logado
  IF auth.role() = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    
    -- Se o status está mudando para 'RECEIVED' (Entregue) e não estava antes
    IF NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED' THEN
      
      -- Verifica se o PIN fornecido bate com o PIN original
      IF NEW.provided_pin IS NULL OR NEW.provided_pin IS DISTINCT FROM OLD.delivery_pin THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança inválido ou ausente.';
      END IF;
      
    END IF;
  END IF;
  
  -- Sempre limpa o PIN fornecido para que não fique salvo no banco
  NEW.provided_pin := NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Associar Trigger à Tabela
DROP TRIGGER IF EXISTS check_delivery_pin ON public.orders;
CREATE TRIGGER check_delivery_pin
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_pin_trigger();
