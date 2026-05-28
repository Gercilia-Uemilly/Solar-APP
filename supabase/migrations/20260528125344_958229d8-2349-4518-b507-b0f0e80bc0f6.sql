CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  url TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.error_logs TO authenticated;
GRANT SELECT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert error logs"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view error logs"
ON public.error_logs
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));