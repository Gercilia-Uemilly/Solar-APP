DROP POLICY IF EXISTS "Authenticated users upload midias" ON storage.objects;

CREATE POLICY "Users upload own midias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'midias'
  AND auth.uid()::text = (storage.foldername(name))[1]
);