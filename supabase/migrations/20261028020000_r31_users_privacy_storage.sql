-- ==============================================================================
-- AÇAÍFOOD R31 — Privacidade dos usuários (A2) e armazenamento (M2) (auditoria docs/31)
-- Timestamp: 20261028020000
-- A2: antes, qualquer usuário logado lia telefone, endereço e GPS de TODOS os usuários.
--     Agora cada um vê: o próprio perfil; lojas e fornecedores (dados comerciais);
--     quem participa de um pedido com ele (cliente, loja, fornecedor, motorista);
--     lojas/fornecedores veem os entregadores; entregadores veem o cliente dos
--     pedidos disponíveis no radar; admin vê todos.
-- M2: ninguém grava arquivos pelo navegador (uploads só pelo servidor); limites de tamanho.
-- Reversão completa: supabase/rollback/20261028020000_r31_users_privacy_storage_rollback.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.can_view_user(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    target = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.users t WHERE t.id = target
               AND upper(t.role) IN ('PARTNER', 'SUPPLIER', 'LOJA', 'FORNECEDOR'))
    OR (
      EXISTS (SELECT 1 FROM public.users t WHERE t.id = target AND upper(t.role) IN ('COURIER', 'MOTORISTA', 'MOTOBOY'))
      AND EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND upper(me.role) IN ('PARTNER', 'SUPPLIER', 'LOJA', 'FORNECEDOR'))
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
      WHERE (o.buyer_id = target OR o.driver_id = target OR sf.partner_id = target)
        AND (o.buyer_id = auth.uid() OR o.driver_id = auth.uid() OR sf.partner_id = auth.uid())
    )
    OR (
      EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND upper(me.role) IN ('COURIER', 'MOTORISTA', 'MOTOBOY'))
      AND EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = target AND o.driver_id IS NULL
                  AND upper(o.status) IN ('READY', 'PREPARING'))
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "users_select_related" ON public.users;
CREATE POLICY "users_select_related" ON public.users
  FOR SELECT TO authenticated
  USING (public.can_view_user(id));

DROP POLICY IF EXISTS "Allow authenticated select on users" ON public.users;

-- M2. Armazenamento: o app só envia arquivos pelo servidor (service_role).
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update their own assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete their own assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'R31: policies de storage não alteradas: %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'commercials';
  UPDATE storage.buckets
     SET file_size_limit = 5242880,
         allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
   WHERE id IN ('logos', 'banners', 'products', 'partner_assets');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'R31: limites dos buckets não alterados: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
