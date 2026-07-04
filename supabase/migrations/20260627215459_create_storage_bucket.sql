-- Create partner_assets bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partner_assets', 'partner_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the bucket
-- Allow public read access
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'partner_assets' );

-- Allow authenticated users to upload their own assets
-- Note: Assuming the user ID matches the start of the file path, or you can check Auth user.
CREATE POLICY "Authenticated users can upload assets" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'partner_assets' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own assets
CREATE POLICY "Authenticated users can update their own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner_assets' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own assets
CREATE POLICY "Authenticated users can delete their own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner_assets' AND
  auth.role() = 'authenticated'
);
