
CREATE TABLE public.base_conhecimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  palavras_chave TEXT[] DEFAULT '{}',
  orgao TEXT,
  bairro TEXT,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  link TEXT,
  fonte TEXT DEFAULT 'SOS Uberlândia',
  categoria TEXT DEFAULT 'Notícia',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users read base_conhecimento"
  ON public.base_conhecimento FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete
CREATE POLICY "Admins manage base_conhecimento"
  ON public.base_conhecimento FOR ALL
  USING (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_base_conhecimento_updated_at
  BEFORE UPDATE ON public.base_conhecimento
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
