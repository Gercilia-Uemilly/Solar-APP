
CREATE OR REPLACE FUNCTION public.log_oficio_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome)
    VALUES (NEW.id, NULL, NEW.status,
            COALESCE(v_user, NEW.last_edited_by, NEW.author_id),
            COALESCE(v_name, NEW.last_edited_by_name, NEW.operador_nome));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE(v_user, NEW.last_edited_by, NEW.author_id),
            COALESCE(v_name, NEW.last_edited_by_name, NEW.operador_nome));
  END IF;

  RETURN NEW;
END;
$$;
