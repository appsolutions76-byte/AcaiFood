-- ==========================================================
-- REALTIME PRICE SYNC & PUBLIC STOREFRONT CATALOG PATCH - AÇAÍFOOD
-- Execute este script no SQL Editor do Supabase para garantir que
-- alteração de preços/produtos por lojas e fornecedores reflita
-- instantaneamente em tempo real para todos os clientes e parceiros.
-- ==========================================================

-- 1. Garante que storefronts e products sejam publicamente legíveis por qualquer visitante/cliente
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select on storefronts" ON public.storefronts;
DROP POLICY IF EXISTS "Allow authenticated select on storefronts" ON public.storefronts;

CREATE POLICY "Allow public select on storefronts" ON public.storefronts
FOR SELECT USING (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated select on products" ON public.products;

CREATE POLICY "Allow public select on products" ON public.products
FOR SELECT USING (true);

-- 2. Adiciona a tabela products à publicação do Supabase Realtime se ainda não estiver
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'storefronts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.storefronts;
  END IF;
END $$;

-- 3. Habilita REPLICA IDENTITY FULL para capturar payloads completos no Realtime
ALTER TABLE public.storefronts REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

-- 4. Notificar a API REST do Supabase para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
