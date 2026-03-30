
CREATE TABLE IF NOT EXISTS public.preferencias_usuario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tema TEXT DEFAULT 'escuro',
  cor_primaria TEXT DEFAULT '#1B3A6B',
  cor_secundaria TEXT DEFAULT '#22c55e',
  tamanho_fonte TEXT DEFAULT 'medio',
  sidebar_compacta BOOLEAN DEFAULT false,
  densidade TEXT DEFAULT 'normal',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario gerencia proprias preferencias"
ON public.preferencias_usuario FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
