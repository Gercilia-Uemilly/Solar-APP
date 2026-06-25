
-- Restrict oficio_respostas SELECT to approved users
DROP POLICY IF EXISTS "Autenticados podem ver respostas" ON public.oficio_respostas;
CREATE POLICY "Aprovados podem ver respostas"
  ON public.oficio_respostas FOR SELECT
  TO authenticated
  USING (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()));

-- Restrict profiles SELECT: own row OR admin OR approved
DROP POLICY IF EXISTS "Approved users read profiles" ON public.profiles;
CREATE POLICY "Approved users read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_user_approved(auth.uid())
  );

-- Tighten storage delete for midias/oficios folder to admins only
DROP POLICY IF EXISTS "Users delete midias" ON storage.objects;
CREATE POLICY "Users delete midias"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'midias'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_admin(auth.uid())
    )
  );
