DROP POLICY IF EXISTS "authenticated_insert_backup" ON public.oficios_backup;

CREATE POLICY "Only admins insert backups"
ON public.oficios_backup
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));