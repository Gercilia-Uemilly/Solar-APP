-- Enable realtime for remaining key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clippings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.base_conhecimento;

-- Indexes for scripts
CREATE INDEX IF NOT EXISTS idx_scripts_author_id ON public.scripts (author_id);
CREATE INDEX IF NOT EXISTS idx_scripts_categoria ON public.scripts (categoria);

-- Indexes for clippings
CREATE INDEX IF NOT EXISTS idx_clippings_author_id ON public.clippings (author_id);
CREATE INDEX IF NOT EXISTS idx_clippings_created_at ON public.clippings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clippings_sentimento ON public.clippings (sentimento);

-- Indexes for base_conhecimento
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_fonte ON public.base_conhecimento (fonte);
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_created_at ON public.base_conhecimento (created_at DESC);

-- Indexes for oficio_numeracao
CREATE INDEX IF NOT EXISTS idx_oficio_numeracao_ano_numero ON public.oficio_numeracao (ano, numero);
CREATE INDEX IF NOT EXISTS idx_oficio_numeracao_status ON public.oficio_numeracao (status);