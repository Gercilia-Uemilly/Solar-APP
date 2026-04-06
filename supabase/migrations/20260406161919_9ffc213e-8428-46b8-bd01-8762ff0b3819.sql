
CREATE TABLE public.lembretes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_por UUID NOT NULL,
  destinatarios UUID[] DEFAULT '{}',
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  recorrencia TEXT DEFAULT 'nenhuma',
  tipo TEXT NOT NULL DEFAULT 'pessoal',
  lido_por UUID[] DEFAULT '{}',
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem lembretes proprios ou destinados a eles"
ON public.lembretes FOR SELECT TO authenticated
USING (
  criado_por = auth.uid()
  OR auth.uid() = ANY(destinatarios)
);

CREATE POLICY "Usuarios criam lembretes"
ON public.lembretes FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Usuarios atualizam lembretes proprios ou destinados"
ON public.lembretes FOR UPDATE TO authenticated
USING (
  criado_por = auth.uid()
  OR auth.uid() = ANY(destinatarios)
);

CREATE POLICY "Usuarios deletam lembretes proprios"
ON public.lembretes FOR DELETE TO authenticated
USING (
  criado_por = auth.uid()
  OR is_admin(auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.lembretes;
