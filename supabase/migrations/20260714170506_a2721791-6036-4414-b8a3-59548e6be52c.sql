
CREATE TABLE public.oficio_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio_id UUID NOT NULL REFERENCES public.oficios(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  alterado_por UUID,
  alterado_por_nome TEXT,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oficio_status_history_oficio ON public.oficio_status_history(oficio_id, alterado_em DESC);

GRANT SELECT, INSERT ON public.oficio_status_history TO authenticated;
GRANT ALL ON public.oficio_status_history TO service_role;

ALTER TABLE public.oficio_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read status history" ON public.oficio_status_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert status history" ON public.oficio_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_oficio_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome)
    VALUES (NEW.id, NULL, NEW.status,
            COALESCE(NEW.last_edited_by, NEW.author_id),
            COALESCE(NEW.last_edited_by_name, NEW.operador_nome));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE(NEW.last_edited_by, NEW.author_id),
            COALESCE(NEW.last_edited_by_name, NEW.operador_nome));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_oficio_status_change
AFTER INSERT OR UPDATE OF status ON public.oficios
FOR EACH ROW EXECUTE FUNCTION public.log_oficio_status_change();

-- Seed inicial: cria uma entrada para cada ofício existente com o status atual
INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, alterado_em)
SELECT id, NULL, status,
       COALESCE(last_edited_by, author_id),
       COALESCE(last_edited_by_name, operador_nome),
       COALESCE(last_edited_at, updated_at, created_at)
FROM public.oficios
WHERE deleted_at IS NULL;
