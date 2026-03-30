-- Fix: allow authenticated users to upload to oficios/ path in midias bucket
DROP POLICY IF EXISTS "Users upload own midias" ON storage.objects;

CREATE POLICY "Users upload midias" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'midias' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] = 'oficios'
  )
);

-- Also allow delete for oficios/ path
DROP POLICY IF EXISTS "Users delete own midias" ON storage.objects;

CREATE POLICY "Users delete midias" ON storage.objects
FOR DELETE USING (
  bucket_id = 'midias' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] = 'oficios'
    OR is_admin(auth.uid())
  )
);