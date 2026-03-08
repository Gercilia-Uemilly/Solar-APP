-- Create public bucket for audio/media files
INSERT INTO storage.buckets (id, name, public) VALUES ('midias', 'midias', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users upload midias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'midias');

-- Allow public read
CREATE POLICY "Public read midias"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'midias');

-- Allow owners and admins to delete
CREATE POLICY "Users delete own midias"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'midias' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));