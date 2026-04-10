
-- Tabela de versões externas de ofícios
CREATE TABLE public.versoes_oficio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oficio_id UUID NOT NULL REFERENCES public.oficios(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tipo TEXT,
  descricao TEXT,
  criado_por UUID NOT NULL,
  criado_por_nome TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.versoes_oficio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read versoes"
  ON public.versoes_oficio FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users insert versoes"
  ON public.versoes_oficio FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Owner or admin delete versoes"
  ON public.versoes_oficio FOR DELETE
  TO authenticated USING (auth.uid() = criado_por OR is_admin(auth.uid()));

CREATE INDEX idx_versoes_oficio_oficio_id ON public.versoes_oficio(oficio_id);

-- Campos extras na tabela oficios
ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS arquivo_externo_url TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_externo_nome TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_externo_tipo TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_externo_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS arquivo_externo_por UUID,
  ADD COLUMN IF NOT EXISTS versao TEXT DEFAULT 'sistema';
