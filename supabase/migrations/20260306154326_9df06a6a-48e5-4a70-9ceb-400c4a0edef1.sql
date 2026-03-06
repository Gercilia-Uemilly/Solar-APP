
-- Table to track suggestion interactions for learning
CREATE TABLE public.suggestion_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL, -- 'oficio', 'base_conhecimento'
  source_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'accepted', 'ignored'
  context_assunto TEXT,
  context_bairro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestion_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own interactions" ON public.suggestion_interactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add modelo flag to base_conhecimento for admin prioritization
ALTER TABLE public.base_conhecimento ADD COLUMN IF NOT EXISTS modelo BOOLEAN NOT NULL DEFAULT false;

-- Index for faster suggestion queries
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_fonte ON public.base_conhecimento(fonte);
CREATE INDEX IF NOT EXISTS idx_suggestion_interactions_source ON public.suggestion_interactions(source_id, action);
