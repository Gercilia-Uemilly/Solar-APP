
DROP POLICY "Authenticated users update oficios" ON public.oficios;
CREATE POLICY "Owner or admin can update oficios"
  ON public.oficios FOR UPDATE
  TO authenticated
  USING ((auth.uid() = author_id) OR is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = author_id) OR is_admin(auth.uid()));
