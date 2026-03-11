
-- Table to persist image attachments for oficios
CREATE TABLE public.oficio_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.oficio_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read anexos"
  ON public.oficio_anexos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users insert anexos"
  ON public.oficio_anexos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users delete anexos"
  ON public.oficio_anexos FOR DELETE
  TO authenticated
  USING (true);
