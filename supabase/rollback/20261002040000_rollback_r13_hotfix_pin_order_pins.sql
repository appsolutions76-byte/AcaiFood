-- ==============================================================================
-- ROLLBACK R13 1/2
-- Atenção: este rollback NÃO devolve as funções de PIN antigas e inseguras
-- (sem checagem de quem chama) nem os PINs em texto na tabela orders.
-- Ele desfaz a sincronização automática, a leitura em lote e os ajustes do repasse.
-- Os PINs continuam em order_pins (fonte única).
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_sync_order_pins ON public.orders;
DROP FUNCTION IF EXISTS public.sync_order_pins_from_orders();
DROP FUNCTION IF EXISTS public.get_my_order_pins_bulk(uuid[]);

-- Trigger de validação: volta a exigir provided_pin (comparando com order_pins)
CREATE OR REPLACE FUNCTION public.validate_delivery_pin_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_real TEXT;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.status = 'RECEIVED' AND OLD.status IS DISTINCT FROM 'RECEIVED' THEN
      SELECT delivery_pin INTO v_real FROM public.order_pins WHERE order_id = NEW.id;
      IF COALESCE(current_setting('acaifood.pin_verified_order', true), '') <> NEW.id::text
         AND (NEW.provided_pin IS NULL OR v_real IS NULL OR trim(NEW.provided_pin) <> trim(v_real)) THEN
        RAISE EXCEPTION 'Acesso negado: PIN de segurança incorreto ou ausente.';
      END IF;
    END IF;
  END IF;
  NEW.provided_pin := NULL;
  RETURN NEW;
END;
$$;

-- Repasse: remove a criação automática (a flag settlements_enabled continua false)
DROP TRIGGER IF EXISTS trg_create_order_settlements ON public.orders;

NOTIFY pgrst, 'reload schema';
