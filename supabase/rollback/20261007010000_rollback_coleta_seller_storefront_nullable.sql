-- Reversão de 20261007010000. Só volta o NOT NULL se não houver coleta sem vendedor.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_required_unless_coleta;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE seller_storefront_id IS NULL) THEN
    ALTER TABLE public.orders ALTER COLUMN seller_storefront_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Existem pedidos sem seller_storefront_id (coletas); NOT NULL não foi recolocado.';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
