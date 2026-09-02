-- ==========================================================
-- AÇAÍFOOD — PERFORMANCE & STABILITY PATCH (SQL EDITOR)
-- Execute no SQL Editor do Supabase Dashboard
-- ==========================================================

-- 1. Otimização da função is_admin() com STABLE e PARALLEL SAFE
-- Permite que o PostgreSQL guarde o resultado em cache durante a mesma query RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (role = 'ADMIN' OR role = 'admin' OR role = 'PARTNER_ADMIN')
  );
$$;

-- 2. Índices B-Tree de alta seletividade para acelerar RLS e consultas frequentes
CREATE INDEX IF NOT EXISTS idx_storefronts_partner_id 
  ON public.storefronts (partner_id);

CREATE INDEX IF NOT EXISTS idx_users_role_status 
  ON public.users (role, status);

CREATE INDEX IF NOT EXISTS idx_print_log_order_time 
  ON public.print_log (order_id, printed_at DESC);

-- Índice para acelerar o histórico e carregamento do chat em tempo real
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_order_messages_order_created 
      ON public.order_messages (order_id, created_at ASC);
  END IF;
END $$;

-- 3. Otimização de I/O e Write-Ahead Log (WAL) da replicação lógica
-- Tabelas auxiliares retornam para REPLICA IDENTITY DEFAULT, aliviando escrita em disco
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_status_history') THEN
    ALTER TABLE public.order_status_history REPLICA IDENTITY DEFAULT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'print_log') THEN
    ALTER TABLE public.print_log REPLICA IDENTITY DEFAULT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disputes') THEN
    ALTER TABLE public.disputes REPLICA IDENTITY DEFAULT;
  END IF;
END $$;

-- 4. Notificar PostgREST para recarregar o schema otimizado
NOTIFY pgrst, 'reload schema';
