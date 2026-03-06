
-- Allow admins to update any profile (for editing names)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile or admin"
  ON public.profiles FOR UPDATE
  USING ((auth.uid() = id) OR is_admin(auth.uid()));
