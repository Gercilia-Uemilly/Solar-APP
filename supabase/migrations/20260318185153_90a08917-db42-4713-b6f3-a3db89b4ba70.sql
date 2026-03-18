
-- 1. Add approval columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado_por UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP WITH TIME ZONE;

-- 2. Create mensagens table for internal chat
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  de_user_id UUID NOT NULL,
  para_user_id UUID,
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores_enviam_mensagens" ON public.mensagens
FOR INSERT TO authenticated
WITH CHECK (de_user_id = auth.uid());

CREATE POLICY "operadores_leem_mensagens" ON public.mensagens
FOR SELECT TO authenticated
USING (
  para_user_id = auth.uid() OR
  de_user_id = auth.uid() OR
  para_user_id IS NULL
);

CREATE POLICY "operadores_marcam_lidas" ON public.mensagens
FOR UPDATE TO authenticated
USING (para_user_id = auth.uid() OR para_user_id IS NULL)
WITH CHECK (para_user_id = auth.uid() OR para_user_id IS NULL);

-- Enable realtime for mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;

-- 3. Create security definer function for checking approval status
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'aprovado' FROM public.profiles WHERE id = _user_id),
    false
  );
$$;
