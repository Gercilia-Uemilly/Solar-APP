
ALTER TABLE public.oficio_status_history
  ADD COLUMN IF NOT EXISTS estimado boolean NOT NULL DEFAULT false;

-- Marca todas as entradas existentes (antes do gatilho corrigido) como estimadas
UPDATE public.oficio_status_history SET estimado = true;

-- Atualiza o gatilho para sempre gravar novas entradas como não-estimadas quando temos auth.uid()
CREATE OR REPLACE FUNCTION public.log_oficio_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_estimado boolean;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;
    v_estimado := false;
  ELSE
    v_estimado := true;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, estimado)
    VALUES (NEW.id, NULL, NEW.status,
            COALESCE(v_user, NEW.last_edited_by, NEW.author_id),
            COALESCE(v_name, NEW.last_edited_by_name, NEW.operador_nome),
            v_estimado);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, estimado)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE(v_user, NEW.last_edited_by, NEW.author_id),
            COALESCE(v_name, NEW.last_edited_by_name, NEW.operador_nome),
            v_estimado);
  END IF;

  RETURN NEW;
END;
$$;
