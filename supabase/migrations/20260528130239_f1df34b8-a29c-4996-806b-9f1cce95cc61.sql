
-- 1. Restrict midias bucket uploads to authenticated users only
DROP POLICY IF EXISTS "Users upload midias" ON storage.objects;
CREATE POLICY "Users upload midias"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'midias'
  AND (
    (storage.foldername(name))[1] = 'oficios'
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- 2. Add explicit UPDATE policy for midias (owner or admin only)
DROP POLICY IF EXISTS "Users update midias" ON storage.objects;
CREATE POLICY "Users update midias"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'midias'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'midias'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR is_admin(auth.uid())
  )
);

-- 3. Fix oficio_numeracao UPDATE policy: prevent non-admin from clearing
-- another user's reservation. Only the current holder (or admin) can mutate
-- a reserved row; available rows can be claimed by any authenticated user.
DROP POLICY IF EXISTS autenticados_reservam_numero ON public.oficio_numeracao;
CREATE POLICY autenticados_reservam_numero
ON public.oficio_numeracao
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid())
  OR status = 'disponivel'
  OR reservado_por = auth.uid()
)
WITH CHECK (
  is_admin(auth.uid())
  OR reservado_por = auth.uid()
);
