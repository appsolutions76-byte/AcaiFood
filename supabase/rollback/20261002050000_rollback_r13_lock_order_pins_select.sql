-- ROLLBACK R13 2/2: devolve a leitura direta de order_pins (filtrada pelas policies por linha)
-- e as funções de compatibilidade com p_operator_id.
GRANT SELECT ON public.order_pins TO authenticated;

CREATE OR REPLACE FUNCTION public.check_delivery_pin(p_order_id UUID, p_pin TEXT, p_operator_id UUID, p_device_info TEXT)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT public.check_delivery_pin(p_order_id, p_pin, p_device_info); $$;

CREATE OR REPLACE FUNCTION public.check_pickup_pin(p_order_id UUID, p_pin TEXT, p_operator_id UUID, p_device_info TEXT)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT public.check_pickup_pin(p_order_id, p_pin, p_device_info); $$;

REVOKE EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, uuid, text)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_delivery_pin(uuid, text, uuid, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.check_pickup_pin(uuid, text, uuid, text)   TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
