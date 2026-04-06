
CREATE TABLE public.mensagem_reacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mensagem_id UUID NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mensagem_id, user_id, emoji)
);

ALTER TABLE public.mensagem_reacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem reacoes" ON public.mensagem_reacoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios criam reacoes" ON public.mensagem_reacoes
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios deletam proprias reacoes" ON public.mensagem_reacoes
FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagem_reacoes;
