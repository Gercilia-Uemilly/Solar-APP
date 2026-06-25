
-- Apenas administradores podem inserir/atualizar/excluir respostas
DROP POLICY IF EXISTS "Autenticados podem inserir respostas" ON public.oficio_respostas;
DROP POLICY IF EXISTS "Autor, uploader ou admin pode atualizar" ON public.oficio_respostas;
DROP POLICY IF EXISTS "Autor, uploader ou admin pode excluir" ON public.oficio_respostas;

CREATE POLICY "Somente admin insere respostas"
  ON public.oficio_respostas FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Somente admin atualiza respostas"
  ON public.oficio_respostas FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Somente admin exclui respostas"
  ON public.oficio_respostas FOR DELETE
  USING (is_admin(auth.uid()));

-- Storage: upload e delete restritos a admins
DROP POLICY IF EXISTS "Autenticados enviam respostas-oficios" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados deletam respostas-oficios proprios" ON storage.objects;

CREATE POLICY "Admin envia respostas-oficios"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'respostas-oficios' AND is_admin(auth.uid()));

CREATE POLICY "Admin deleta respostas-oficios"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'respostas-oficios' AND is_admin(auth.uid()));
