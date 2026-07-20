DROP POLICY IF EXISTS "Users insert own oficios" ON public.oficios;
CREATE POLICY "Users insert own oficios"
  ON public.oficios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

REVOKE INSERT, UPDATE, DELETE ON public.oficios FROM anon;
REVOKE SELECT ON public.oficios FROM anon;