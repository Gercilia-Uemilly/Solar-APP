
-- Fix: restrict oficios_backup reads to admins (contains full snapshots with PII)
DROP POLICY IF EXISTS "authenticated_select_backup" ON public.oficios_backup;
CREATE POLICY "Admins read backups" ON public.oficios_backup
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Fix: profiles - restrict reads to approved users and self
DROP POLICY IF EXISTS "Authenticated users read profiles" ON public.profiles;
CREATE POLICY "Approved users read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_user_approved(auth.uid())
);

-- Fix: scripts - restrict to authenticated only (was public)
DROP POLICY IF EXISTS "Users read all scripts" ON public.scripts;
DROP POLICY IF EXISTS "Users insert scripts" ON public.scripts;
DROP POLICY IF EXISTS "Users update own scripts" ON public.scripts;
DROP POLICY IF EXISTS "Users delete own scripts" ON public.scripts;

CREATE POLICY "Users read all scripts" ON public.scripts
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert scripts" ON public.scripts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own scripts" ON public.scripts
FOR UPDATE TO authenticated USING ((auth.uid() = author_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Users delete own scripts" ON public.scripts
FOR DELETE TO authenticated USING ((auth.uid() = author_id) OR public.is_admin(auth.uid()));

-- Fix: user_sessions - restrict to authenticated only
DROP POLICY IF EXISTS "Users insert own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users read own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Admins read all sessions" ON public.user_sessions;

CREATE POLICY "Users insert own sessions" ON public.user_sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own sessions" ON public.user_sessions
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all sessions" ON public.user_sessions
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Fix: oficio_numeracao - prevent reserving on behalf of others
DROP POLICY IF EXISTS "autenticados_reservam_numero" ON public.oficio_numeracao;
CREATE POLICY "autenticados_reservam_numero" ON public.oficio_numeracao
FOR UPDATE TO authenticated
USING (
  (status = 'disponivel') OR (reservado_por = auth.uid()) OR public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR reservado_por IS NULL
  OR reservado_por = auth.uid()
);
