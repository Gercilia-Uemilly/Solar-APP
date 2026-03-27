-- Allow all authenticated users to INSERT backups (for auto-versioning)
CREATE POLICY "authenticated_insert_backup"
ON public.oficios_backup
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to SELECT backups (so any operator can view history)
CREATE POLICY "authenticated_select_backup"
ON public.oficios_backup
FOR SELECT
TO authenticated
USING (true);

-- Drop the admin-only SELECT policy since we're opening to all authenticated
DROP POLICY IF EXISTS "admin_ve_backups" ON public.oficios_backup;