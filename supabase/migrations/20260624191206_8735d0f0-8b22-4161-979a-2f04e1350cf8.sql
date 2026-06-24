
CREATE OR REPLACE FUNCTION public.sync_oficio_respostas_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_oficio_id UUID; v_count INTEGER;
BEGIN
  v_oficio_id := COALESCE(NEW.oficio_id, OLD.oficio_id);
  SELECT COUNT(*) INTO v_count FROM public.oficio_respostas
    WHERE oficio_id = v_oficio_id AND COALESCE(match_status,'confirmado') = 'confirmado';

  IF TG_OP = 'DELETE' THEN
    UPDATE public.oficios
      SET total_respostas = v_count,
          respondido_em = CASE WHEN v_count = 0 THEN NULL ELSE respondido_em END,
          status = CASE
            WHEN v_count = 0 AND status = 'Respondido' THEN 'Protocolado'
            ELSE status
          END
      WHERE id = v_oficio_id;
  ELSE
    IF v_count > 0 AND COALESCE(NEW.match_status,'confirmado') = 'confirmado' THEN
      UPDATE public.oficios
        SET total_respostas = v_count,
            respondido_em = COALESCE(respondido_em, now()),
            status = CASE WHEN status IN ('Cancelado') THEN status ELSE 'Respondido' END
        WHERE id = v_oficio_id;
    ELSE
      UPDATE public.oficios SET total_respostas = v_count WHERE id = v_oficio_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Apaga vínculos incorretos do import por ZIP onde o número do arquivo não bate com o número do ofício.
DELETE FROM public.oficio_respostas r
USING public.oficios o
WHERE o.id = r.oficio_id
  AND r.tipo_origem = 'manual'
  AND (regexp_match(r.arquivo_nome, '^(\d+)[.\-_ ]2026'))[1] IS NOT NULL
  AND (regexp_match(r.arquivo_nome, '^(\d+)[.\-_ ]2026'))[1] IS DISTINCT FROM (regexp_match(o.numero, '(\d+)/2026'))[1];
