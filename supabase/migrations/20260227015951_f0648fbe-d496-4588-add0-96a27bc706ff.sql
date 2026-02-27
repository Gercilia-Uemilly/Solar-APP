
ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS ano integer,
  ADD COLUMN IF NOT EXISTS link_pdf_drive text;

-- Backfill ano from created_at
UPDATE public.oficios SET ano = EXTRACT(YEAR FROM created_at)::integer WHERE ano IS NULL;

-- Trigger to auto-set ano on insert/update
CREATE OR REPLACE FUNCTION public.set_oficio_ano()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.ano := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::integer;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_oficio_ano
  BEFORE INSERT OR UPDATE ON public.oficios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_oficio_ano();
