CREATE OR REPLACE FUNCTION public.sync_oficio_respostas_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oficio_id UUID;
  v_count INTEGER;
BEGIN
  v_oficio_id := COALESCE(NEW.oficio_id, OLD.oficio_id);

  SELECT COUNT(*) INTO v_count
  FROM public.oficio_respostas
  WHERE oficio_id = v_oficio_id
    AND COALESCE(match_status, 'confirmado') = 'confirmado';

  IF v_count = 0 THEN
    UPDATE public.oficios
      SET total_respostas = 0,
          respondido_em = NULL,
          status = CASE
            WHEN status = 'Respondido' THEN 'Protocolado'
            ELSE status
          END
      WHERE id = v_oficio_id;
  ELSIF TG_OP <> 'DELETE' AND COALESCE(NEW.match_status, 'confirmado') = 'confirmado' THEN
    UPDATE public.oficios
      SET total_respostas = v_count,
          respondido_em = COALESCE(respondido_em, now()),
          status = CASE WHEN status IN ('Cancelado') THEN status ELSE 'Respondido' END
      WHERE id = v_oficio_id;
  ELSE
    UPDATE public.oficios
      SET total_respostas = v_count
      WHERE id = v_oficio_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;