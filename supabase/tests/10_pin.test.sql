-- Testes do PIN (docs/18, Anexo A). Roda numa transação e desfaz tudo no fim.
-- Requer: 00_supabase_stub.sql + esquema + migration 20261006010000.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

CREATE FUNCTION tests.assert(p_ok BOOLEAN, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'ok: %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION tests.assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;

-- Dados
INSERT INTO public.users (id, name, role, is_admin) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'Comprador', 'cliente', false),
  ('00000000-0000-0000-0000-0000000000c1', 'Loja', 'loja', false),
  ('00000000-0000-0000-0000-0000000000d1', 'Motorista', 'motorista', false),
  ('00000000-0000-0000-0000-0000000000d2', 'Outro motorista', 'motorista', false);
INSERT INTO public.storefronts (id, partner_id, store_name) VALUES
  ('00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-0000000000c1', 'Loja Teste');
INSERT INTO public.orders (id, buyer_id, seller_storefront_id, driver_id, status, order_type) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-0000000000d1', 'READY', 'B2C'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-0000000000d1', 'DELIVERING', 'B2C');
INSERT INTO public.order_pins (order_id, delivery_pin, pickup_pin) VALUES
  ('00000000-0000-0000-0000-000000000001', '2222', '1111'),
  ('00000000-0000-0000-0000-000000000002', '3333', '4444');

-- 10. anon sem EXECUTE
SELECT tests.assert(NOT has_function_privilege('anon', 'public.check_delivery_pin(uuid,text,text)', 'EXECUTE'), '10 anon não executa check_delivery_pin');
SELECT tests.assert(NOT has_function_privilege('anon', 'public.check_pickup_pin(uuid,text,text)', 'EXECUTE'), '10 anon não executa check_pickup_pin');
SELECT tests.assert(NOT has_function_privilege('anon', 'public.get_my_order_pins_bulk(uuid[])', 'EXECUTE'), '10 anon não lê PINs');

-- 1–3. Sem login
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
DO $$ BEGIN
  BEGIN PERFORM public.check_pickup_pin('00000000-0000-0000-0000-000000000001', '4821', 't');
    PERFORM tests.assert(false, '1 anon retirada deveria ser recusada');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, '1 anon retirada recusada'); END;
  BEGIN PERFORM public.check_delivery_pin('00000000-0000-0000-0000-000000000002', '0000', 't');
    PERFORM tests.assert(false, '2 anon entrega deveria ser recusada');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, '2 anon entrega recusada'); END;
  BEGIN PERFORM * FROM public.get_my_order_pins_bulk(ARRAY['00000000-0000-0000-0000-000000000001'::uuid]);
    PERFORM tests.assert(false, '3 anon ler PINs deveria ser recusado');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM tests.assert(true, '3 anon não lê PINs'); END;
END $$;
RESET ROLE;

-- 4. Outro motorista: recusado sem gastar tentativa
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r JSONB; BEGIN
  r := public.check_delivery_pin('00000000-0000-0000-0000-000000000002', '3333', 't');
  PERFORM tests.assert((r->>'success')::boolean = false, '4 outro motorista recusado');
END $$;
RESET ROLE;
SELECT tests.assert((SELECT COALESCE(pin_attempts, 0) FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000002') = 0, '4 sem gastar tentativa');

-- 6. Quem lê qual PIN
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM public.get_my_order_pins_bulk(ARRAY['00000000-0000-0000-0000-000000000001'::uuid]);
  PERFORM tests.assert(r.delivery_pin = '2222' AND r.pickup_pin IS NULL, '6 comprador vê só o PIN de entrega');
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM public.get_my_order_pins_bulk(ARRAY['00000000-0000-0000-0000-000000000001'::uuid]);
  PERFORM tests.assert(r.pickup_pin = '1111' AND r.delivery_pin IS NULL, '6b loja vê só o PIN de retirada');
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM public.get_my_order_pins_bulk(ARRAY['00000000-0000-0000-0000-000000000001'::uuid]);
  PERFORM tests.assert(r.pickup_pin IS NULL AND r.delivery_pin IS NULL, '6c motorista não vê PIN');
END $$;

-- 5. Motorista certo, retirada errada
DO $$ DECLARE r JSONB; BEGIN
  r := public.check_pickup_pin('00000000-0000-0000-0000-000000000001', '4821', 't');
  PERFORM tests.assert((r->>'success')::boolean = false AND (r->>'error') LIKE '%1 de 5%', '5 retirada errada conta tentativa 1 de 5');
END $$;
RESET ROLE;
UPDATE public.orders SET last_pickup_pin_attempt_at = NULL WHERE id = '00000000-0000-0000-0000-000000000001';

-- 11. Retirada com o PIN real
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r JSONB; BEGIN
  r := public.check_pickup_pin('00000000-0000-0000-0000-000000000001', '1111', 't');
  PERFORM tests.assert((r->>'success')::boolean = true, '11 retirada com PIN real');
END $$;
RESET ROLE;
SELECT tests.assert((SELECT status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001') = 'DELIVERING', '11 pedido em DELIVERING');

-- 8. UPDATE direto para RECEIVED é bloqueado
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ BEGIN
  BEGIN
    UPDATE public.orders SET status = 'RECEIVED' WHERE id = '00000000-0000-0000-0000-000000000002';
    PERFORM tests.assert(false, '8 UPDATE direto deveria falhar');
  EXCEPTION WHEN raise_exception THEN PERFORM tests.assert(true, '8 UPDATE direto para RECEIVED bloqueado'); END;
END $$;

-- 7 e 12. Entrega: errado, depois certo
DO $$ DECLARE r JSONB; BEGIN
  r := public.check_delivery_pin('00000000-0000-0000-0000-000000000002', '9999', 't');
  PERFORM tests.assert((r->>'success')::boolean = false, '7 entrega com PIN errado recusada');
END $$;
RESET ROLE;
UPDATE public.orders SET last_pin_attempt_at = NULL WHERE id = '00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true), set_config('request.jwt.claim.role', 'authenticated', true);
DO $$ DECLARE r JSONB; BEGIN
  r := public.check_delivery_pin('00000000-0000-0000-0000-000000000002', '3333', 't');
  PERFORM tests.assert((r->>'success')::boolean = true, '12 entrega com PIN real');
END $$;
RESET ROLE;
SELECT tests.assert((SELECT status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000002') = 'RECEIVED', '12 pedido em RECEIVED');

-- 9. Admin pode forçar RECEIVED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true), set_config('request.jwt.claim.role', 'authenticated', true);
UPDATE public.orders SET status = 'RECEIVED' WHERE id = '00000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT tests.assert((SELECT status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001') = 'RECEIVED', '9 admin forçou RECEIVED');

ROLLBACK;
