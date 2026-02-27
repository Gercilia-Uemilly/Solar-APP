
-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users read own oficios" ON public.oficios;

-- Create new policy: all authenticated users can read all oficios
CREATE POLICY "Authenticated users read all oficios"
ON public.oficios
FOR SELECT
TO authenticated
USING (true);
