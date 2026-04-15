
-- Improved trigger: any non-Rascunho status = usado
CREATE OR REPLACE FUNCTION public.sync_numeracao_on_oficio_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  IF NEW.numero IS NOT NULL AND NEW.numero != '' THEN
    v_num := NULLIF(REGEXP_REPLACE(SPLIT_PART(NEW.numero, '/', 1), '[^0-9]', '', 'g'), '')::INTEGER;
  ELSE
    RETURN NEW;
  END IF;

  IF v_num IS NULL OR NEW.ano IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Rascunho' THEN
    UPDATE oficio_numeracao
    SET status = 'reservado',
        oficio_id = NEW.id,
        reservado_por = COALESCE(reservado_por, NEW.author_id),
        reservado_por_nome = COALESCE(reservado_por_nome, NEW.operador_nome),
        reservado_em = COALESCE(reservado_em, NOW())
    WHERE ano = NEW.ano AND numero = v_num;
  ELSE
    -- Any status other than Rascunho = usado
    UPDATE oficio_numeracao
    SET status = 'usado',
        oficio_id = NEW.id,
        usado_por = COALESCE(NEW.last_edited_by, NEW.author_id),
        usado_por_nome = COALESCE(NEW.last_edited_by_name, NEW.operador_nome),
        usado_em = COALESCE(usado_em, NOW())
    WHERE ano = NEW.ano AND numero = v_num;

    -- If no row was updated, create it
    IF NOT FOUND THEN
      INSERT INTO oficio_numeracao (numero, ano, status, oficio_id, usado_por, usado_por_nome, usado_em, origem_numero)
      VALUES (v_num, NEW.ano, 'usado', NEW.id, COALESCE(NEW.last_edited_by, NEW.author_id),
              COALESCE(NEW.last_edited_by_name, NEW.operador_nome), NOW(), 'sistema')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_numeracao ON oficios;
CREATE TRIGGER trg_sync_numeracao
AFTER INSERT OR UPDATE OF status, numero ON oficios
FOR EACH ROW
EXECUTE FUNCTION public.sync_numeracao_on_oficio_change();
