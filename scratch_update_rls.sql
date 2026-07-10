-- 1. Modify the check constraint on the status column in the orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'));

-- 2. Update SELECT policy for drivers so they can see unassigned orders
DROP POLICY IF EXISTS "Drivers can view their delivery orders" ON public.orders;
CREATE POLICY "Drivers can view their delivery orders" 
ON public.orders FOR SELECT USING (
  auth.uid() = driver_id OR 
  (status IN ('READY', 'PREPARING') AND driver_id IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'COURIER'))
);

-- 3. Add UPDATE policies for the orders table to allow status changes
DROP POLICY IF EXISTS "Buyers can update their own orders" ON public.orders;
CREATE POLICY "Buyers can update their own orders" 
ON public.orders FOR UPDATE USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can update their orders" ON public.orders;
CREATE POLICY "Sellers can update their orders" 
ON public.orders FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.storefronts 
    WHERE storefronts.id = orders.seller_storefront_id AND storefronts.partner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Drivers can update their delivery orders" ON public.orders;
CREATE POLICY "Drivers can update their delivery orders" 
ON public.orders FOR UPDATE USING (
  driver_id IS NULL OR auth.uid() = driver_id
);
