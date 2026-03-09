
-- Add tracking columns for last editor
ALTER TABLE public.oficios 
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS last_edited_by_name text,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Fix DELETE policy: only owner or admin can delete
DROP POLICY IF EXISTS "Authenticated users delete oficios" ON public.oficios;
CREATE POLICY "Owner or admin can delete oficios"
  ON public.oficios FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- Allow all authenticated users to read profiles (needed for author display)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Authenticated users read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
