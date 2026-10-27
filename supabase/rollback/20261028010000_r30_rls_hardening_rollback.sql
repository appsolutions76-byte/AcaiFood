-- Reversão de 20261028010000_r30_rls_hardening.sql (recria exatamente o estado anterior)
DROP POLICY IF EXISTS "support_messages_select_own_or_admin" ON public.support_messages;
CREATE POLICY "support_messages_select_all" ON public.support_messages FOR SELECT TO public USING (true);
CREATE POLICY "support_messages_insert_all" ON public.support_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "support_messages_update_all" ON public.support_messages FOR UPDATE TO public USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.support_messages TO anon, authenticated;

CREATE POLICY "Buyers can view their orders" ON public.orders FOR SELECT TO public USING (true);
CREATE POLICY "Buyers can update their own orders" ON public.orders FOR UPDATE TO public USING (true);
CREATE POLICY "Buyers can delete their own orders" ON public.orders FOR DELETE TO public USING (auth.uid() = buyer_id);
CREATE POLICY "Drivers can delete their delivery orders" ON public.orders FOR DELETE TO public USING (auth.uid() = driver_id);
CREATE POLICY "Sellers can delete their orders" ON public.orders FOR DELETE TO public USING (EXISTS (SELECT 1 FROM public.storefronts WHERE storefronts.id = orders.seller_storefront_id AND storefronts.partner_id = auth.uid()));
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO public USING (public.is_admin());
GRANT DELETE, TRUNCATE ON public.orders TO anon, authenticated;

CREATE POLICY "Acesso total para todos autenticados" ON public.admin_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated select on history" ON public.order_status_history FOR SELECT TO public USING (auth.role() = 'authenticated');
CREATE POLICY "History Granular Insert" ON public.order_status_history FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Order Items Insert" ON public.order_items FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated select on disputes" ON public.disputes FOR SELECT TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated select on print_log" ON public.print_log FOR SELECT TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Print Log Insert" ON public.print_log FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Pin Log Insert" ON public.pin_attempt_log FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Notification Insert" ON public.notification_queue FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');

GRANT EXECUTE ON FUNCTION public.anonymize_order_locations() TO anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_order_print(uuid, text, text, boolean) TO anon, PUBLIC;

NOTIFY pgrst, 'reload schema';
