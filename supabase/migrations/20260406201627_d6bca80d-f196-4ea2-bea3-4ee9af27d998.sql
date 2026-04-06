
CREATE OR REPLACE FUNCTION public.liberar_numero_ao_excluir_ou_cancelar()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Soft-delete: deleted_at was NULL and now is set
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    UPDATE oficio_numeracao
    SET status = 'disponivel',
        reservado_por = NULL,
        reservado_por_nome = NULL,
        reservado_em = NULL,
        usado_por = NULL,
        usado_por_nome = NULL,
        usado_em = NULL,
        oficio_id = NULL
    WHERE oficio_id = NEW.id
       OR (numero = NULLIF(regexp_replace(split_part(COALESCE(NEW.numero,''), '/', 1), '[^0-9]', '', 'g'), '')::int
           AND ano = COALESCE(NEW.ano, EXTRACT(YEAR FROM NOW())::int)
           AND status IN ('usado', 'reservado'));
  END IF;

  -- Status changed to Cancelado
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Cancelado') THEN
    UPDATE oficio_numeracao
    SET status = 'disponivel',
        reservado_por = NULL,
        reservado_por_nome = NULL,
        reservado_em = NULL,
        usado_por = NULL,
        usado_por_nome = NULL,
        usado_em = NULL,
        oficio_id = NULL
    WHERE oficio_id = NEW.id
       OR (numero = NULLIF(regexp_replace(split_part(COALESCE(NEW.numero,''), '/', 1), '[^0-9]', '', 'g'), '')::int
           AND ano = COALESCE(NEW.ano, EXTRACT(YEAR FROM NOW())::int)
           AND status IN ('usado', 'reservado'));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liberar_numero_oficio
  BEFORE UPDATE ON oficios
  FOR EACH ROW
  EXECUTE FUNCTION public.liberar_numero_ao_excluir_ou_cancelar();
