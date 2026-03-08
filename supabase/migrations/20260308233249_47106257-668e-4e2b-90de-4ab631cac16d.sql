
CREATE TABLE public.clippings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_publicacao timestamp with time zone DEFAULT now(),
  fonte text NOT NULL DEFAULT 'Instagram',
  tipo text NOT NULL DEFAULT 'Post',
  titulo text NOT NULL,
  descricao text,
  link text,
  tema text,
  sentimento text NOT NULL DEFAULT 'neutro',
  respondido boolean NOT NULL DEFAULT false,
  estrategico boolean NOT NULL DEFAULT false,
  observacoes text,
  author_id uuid NOT NULL,
  author_nome text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clippings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users read clippings"
  ON public.clippings FOR SELECT TO authenticated
  USING (true);

-- Users insert own clippings
CREATE POLICY "Users insert own clippings"
  ON public.clippings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Users update own or admin updates any
CREATE POLICY "Users update own clippings"
  ON public.clippings FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- Users delete own or admin deletes any
CREATE POLICY "Users delete own clippings"
  ON public.clippings FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- Auto update updated_at
CREATE TRIGGER update_clippings_updated_at
  BEFORE UPDATE ON public.clippings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
