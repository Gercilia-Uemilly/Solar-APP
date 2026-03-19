-- Make bucket public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Drop old policies
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar read policy" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios fazem upload de avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios atualizam proprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios deletam proprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars sao publicos" ON storage.objects;

-- Create correct policies
CREATE POLICY "Usuarios fazem upload de avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Usuarios atualizam proprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Usuarios deletam proprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars sao publicos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');