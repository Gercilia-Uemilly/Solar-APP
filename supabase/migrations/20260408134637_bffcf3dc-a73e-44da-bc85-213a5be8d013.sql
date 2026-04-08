
CREATE TABLE public.atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cidadao_nome TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL DEFAULT 'WhatsApp',
  descricao_original TEXT,
  resumo_demanda TEXT,
  resposta_gerada TEXT,
  resposta_editada TEXT,
  fontes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read all atendimentos"
  ON public.atendimentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own atendimentos"
  ON public.atendimentos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own atendimentos or admin"
  ON public.atendimentos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users delete own atendimentos or admin"
  ON public.atendimentos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos;
