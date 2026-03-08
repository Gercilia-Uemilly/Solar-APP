-- Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

-- Ensure authenticated users can still read their own avatars via signed URLs
-- (existing upload/delete policies should remain)