
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  motivo text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts (identifier);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert login attempts"
  ON public.login_attempts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins read login attempts"
  ON public.login_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
