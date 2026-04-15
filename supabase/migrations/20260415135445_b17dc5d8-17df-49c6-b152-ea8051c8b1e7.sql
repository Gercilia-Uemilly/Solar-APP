
-- Trigger function to sync numeracao when oficio status changes
CREATE OR REPLACE FUNCTION public.sync_numeracao_on_oficio_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  -- Extract numeric part from oficio numero field
  IF NEW.numero IS NOT NULL AND NEW.numero != '' THEN
    v_num := CAST(REGEXP_REPLACE(NEW.numero, '[^0-9]', '', 'g') AS INTEGER);
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.ano IS NULL THEN
    RETURN NEW;
  END IF;

  -- Status mapping: Rascunho -> reservado, everything else -> usado
  IF NEW.status = 'Rascunho' THEN
    UPDATE oficio_numeracao
    SET status = 'reservado',
        oficio_id = NEW.id,
        reservado_por = COALESCE(reservado_por, NEW.author_id),
        reservado_por_nome = COALESCE(reservado_por_nome, NEW.operador_nome),
        reservado_em = COALESCE(reservado_em, NOW())
    WHERE ano = NEW.ano AND numero = v_num;
  ELSE
    UPDATE oficio_numeracao
    SET status = 'usado',
        oficio_id = NEW.id,
        usado_por = COALESCE(NEW.last_edited_by, NEW.author_id),
        usado_por_nome = COALESCE(NEW.last_edited_by_name, NEW.operador_nome),
        usado_em = COALESCE(usado_em, NOW())
    WHERE ano = NEW.ano AND numero = v_num;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS trg_sync_numeracao ON oficios;
CREATE TRIGGER trg_sync_numeracao
AFTER INSERT OR UPDATE OF status, numero ON oficios
FOR EACH ROW
EXECUTE FUNCTION public.sync_numeracao_on_oficio_change();
