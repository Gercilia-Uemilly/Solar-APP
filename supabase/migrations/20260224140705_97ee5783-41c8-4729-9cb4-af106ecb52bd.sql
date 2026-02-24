
-- Create scripts table
CREATE TABLE public.scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  tags TEXT[] DEFAULT '{}',
  favorito BOOLEAN NOT NULL DEFAULT false,
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users read all scripts" ON public.scripts FOR SELECT USING (true);
CREATE POLICY "Users insert scripts" ON public.scripts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own scripts" ON public.scripts FOR UPDATE USING (auth.uid() = author_id OR is_admin(auth.uid()));
CREATE POLICY "Users delete own scripts" ON public.scripts FOR DELETE USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add new columns to oficios for the enhanced form
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS cargo_destinatario TEXT;
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS local_demanda TEXT;
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS solicitante TEXT;
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS contato_solicitante TEXT;
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS data_geracao DATE DEFAULT CURRENT_DATE;
