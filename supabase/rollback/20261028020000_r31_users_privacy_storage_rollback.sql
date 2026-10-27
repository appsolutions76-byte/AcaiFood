-- Reversão do R31 (volta exatamente ao estado anterior)
DROP POLICY IF EXISTS "Allow authenticated select on users" ON public.users;
CREATE POLICY "Allow authenticated select on users" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "users_select_related" ON public.users;
DROP FUNCTION IF EXISTS public.can_view_user(uuid);

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
  CREATE POLICY "Authenticated users can upload assets" ON storage.objects
    FOR INSERT WITH CHECK ((bucket_id = 'partner_assets'::text) AND (auth.role() = 'authenticated'::text));
  DROP POLICY IF EXISTS "Authenticated users can update their own assets" ON storage.objects;
  CREATE POLICY "Authenticated users can update their own assets" ON storage.objects
    FOR UPDATE USING ((bucket_id = 'partner_assets'::text) AND (auth.role() = 'authenticated'::text));
  DROP POLICY IF EXISTS "Authenticated users can delete their own assets" ON storage.objects;
  CREATE POLICY "Authenticated users can delete their own assets" ON storage.objects
    FOR DELETE USING ((bucket_id = 'partner_assets'::text) AND (auth.role() = 'authenticated'::text));
  UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL
   WHERE id IN ('commercials', 'logos', 'banners', 'products', 'partner_assets');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'R31 rollback storage: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
