
-- Drop the admin-only ALL policy on base_conhecimento
DROP POLICY IF EXISTS "Admins manage base_conhecimento" ON public.base_conhecimento;

-- Allow all authenticated users to insert
CREATE POLICY "Authenticated users insert base_conhecimento"
ON public.base_conhecimento
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update
CREATE POLICY "Authenticated users update base_conhecimento"
ON public.base_conhecimento
FOR UPDATE
TO authenticated
USING (true);

-- Allow all authenticated users to delete
CREATE POLICY "Authenticated users delete base_conhecimento"
ON public.base_conhecimento
FOR DELETE
TO authenticated
USING (true);

-- Also update oficios policies so all authenticated users can edit/delete any oficio
DROP POLICY IF EXISTS "Users delete own oficios" ON public.oficios;
DROP POLICY IF EXISTS "Users update own oficios" ON public.oficios;

CREATE POLICY "Authenticated users update oficios"
ON public.oficios
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users delete oficios"
ON public.oficios
FOR DELETE
TO authenticated
USING (true);
