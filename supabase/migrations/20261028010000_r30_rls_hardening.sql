-- ==============================================================================
-- AÇAÍFOOD R30 — Fechamento de policies permissivas (auditoria docs/31)
-- Timestamp: 20261028010000
-- Só REMOVE permissões que o app não usa pelo navegador. As policies restritas
-- ("Granular", donos, admin) continuam e cobrem todos os acessos do app.
-- Reversão completa: supabase/rollback/20261028010000_r30_rls_hardening_rollback.sql
-- ==============================================================================

-- C1. Suporte: cada usuário só lê as próprias mensagens; admin lê tudo.
--     Gravação só pelo servidor (/api/support usa service_role).
DROP POLICY IF EXISTS "support_messages_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_all" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_update_all" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_own_or_admin" ON public.support_messages;
CREATE POLICY "support_messages_select_own_or_admin" ON public.support_messages
  FOR SELECT TO authenticated
  USING (user_id::text = auth.uid()::text OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.support_messages FROM anon, authenticated;
REVOKE SELECT ON public.support_messages FROM anon;

-- A1. Pedidos: remove leitura/alteração liberada para todos (USING true).
DROP POLICY IF EXISTS "Buyers can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update their own orders" ON public.orders;

-- A3. Pedidos não podem ser apagados pelo app (o app só oculta com is_hidden).
DROP POLICY IF EXISTS "Buyers can delete their own orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can delete their delivery orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can delete their orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
REVOKE DELETE, TRUNCATE ON public.orders FROM anon, authenticated;

-- M1. Escritas/leituras indevidas
DROP POLICY IF EXISTS "Acesso total para todos autenticados" ON public.admin_balances;   -- admin continua com as policies de admin
DROP POLICY IF EXISTS "Allow authenticated select on history" ON public.order_status_history; -- fica "History Granular Select"
DROP POLICY IF EXISTS "History Granular Insert" ON public.order_status_history;        -- histórico só pelas RPCs/servidor
DROP POLICY IF EXISTS "Order Items Insert" ON public.order_items;                       -- itens só pelo servidor (checkout)
DROP POLICY IF EXISTS "Allow authenticated select on disputes" ON public.disputes;      -- fica "Disputes Select"
DROP POLICY IF EXISTS "Allow authenticated select on print_log" ON public.print_log;    -- fica "Print Log Select"
DROP POLICY IF EXISTS "Print Log Insert" ON public.print_log;                           -- log só pela RPC log_order_print
DROP POLICY IF EXISTS "Pin Log Insert" ON public.pin_attempt_log;                       -- log só pela RPC check_delivery_pin
DROP POLICY IF EXISTS "Notification Insert" ON public.notification_queue;              -- fila só pelo servidor

-- B1. Funções que não precisam ser chamadas sem login
REVOKE EXECUTE ON FUNCTION public.anonymize_order_locations() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_order_print(uuid, text, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_order_print(uuid, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_order_locations() TO service_role;

NOTIFY pgrst, 'reload schema';
