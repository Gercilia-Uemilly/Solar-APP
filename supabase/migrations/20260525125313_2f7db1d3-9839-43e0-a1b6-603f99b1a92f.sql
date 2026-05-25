
-- 1. Avatar: remove duplicate looser policies, keep ownership-scoped ones
DROP POLICY IF EXISTS "Usuarios fazem upload de avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios atualizam proprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios deletam proprio avatar" ON storage.objects;

-- 2. Profiles: restrict SELECT to authenticated only (drop anon access)
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 3. Mensagens: restrict NULL-recipient (broadcast) to admins only
DROP POLICY IF EXISTS "operadores_leem_mensagens" ON public.mensagens;
CREATE POLICY "operadores_leem_mensagens"
ON public.mensagens FOR SELECT
TO authenticated
USING (
  (para_user_id = auth.uid())
  OR (de_user_id = auth.uid())
  OR (para_user_id IS NULL AND is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "operadores_marcam_lidas" ON public.mensagens;
CREATE POLICY "operadores_marcam_lidas"
ON public.mensagens FOR UPDATE
TO authenticated
USING (
  (para_user_id = auth.uid())
  OR (para_user_id IS NULL AND is_admin(auth.uid()))
)
WITH CHECK (
  (para_user_id = auth.uid())
  OR (para_user_id IS NULL AND is_admin(auth.uid()))
);

-- 4. oficio_numeracao: tighten UPDATE policy
DROP POLICY IF EXISTS "autenticados_reservam_numero" ON public.oficio_numeracao;
CREATE POLICY "autenticados_reservam_numero"
ON public.oficio_numeracao FOR UPDATE
TO authenticated
USING (
  status = 'disponivel'
  OR reservado_por = auth.uid()
  OR is_admin(auth.uid())
);

-- 5. Restrict midias bucket non-oficios paths to authenticated users
-- (keep oficios folder open as the user confirmed n8n bot needs it)
DROP POLICY IF EXISTS "Users upload midias" ON storage.objects;
CREATE POLICY "Users upload midias"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'midias'
  AND (
    -- n8n bot path (intentionally open)
    (storage.foldername(name))[1] = 'oficios'
    -- authenticated users to their own folder
    OR (auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
  )
);

DROP POLICY IF EXISTS "Users delete midias" ON storage.objects;
CREATE POLICY "Users delete midias"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'midias'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] = 'oficios'
    OR is_admin(auth.uid())
  )
);

-- 6. Set search_path on SECURITY DEFINER functions missing it
ALTER FUNCTION public.criar_oficio_whatsapp(text,text,text,text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.buscar_audio_tema(text) SET search_path = public;
ALTER FUNCTION public.registrar_atendimento_whatsapp(text,text,text,text) SET search_path = public;
ALTER FUNCTION public.buscar_base_conhecimento(text) SET search_path = public;
