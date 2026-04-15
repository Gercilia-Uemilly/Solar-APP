
-- Drop all old triggers to avoid conflicts
DROP TRIGGER IF EXISTS trg_sync_numeracao ON oficios;
DROP TRIGGER IF EXISTS trg_liberar_numero_excluir ON oficios;
DROP FUNCTION IF EXISTS public.liberar_numero_ao_excluir_ou_cancelar() CASCADE;

-- Unified trigger: oficio is the SINGLE source of truth
CREATE OR REPLACE FUNCTION public.sync_numeracao_on_oficio_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_num INTEGER;
  v_was_rascunho BOOLEAN;
BEGIN
  -- Extract number
  IF NEW.numero IS NOT NULL AND NEW.numero != '' THEN
    v_num := NULLIF(REGEXP_REPLACE(SPLIT_PART(NEW.numero, '/', 1), '[^0-9]', '', 'g'), '')::INTEGER;
  ELSE
    RETURN NEW;
  END IF;

  IF v_num IS NULL OR NEW.ano IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the OLD status was Rascunho (for delete logic)
  IF TG_OP = 'UPDATE' AND OLD IS NOT NULL THEN
    v_was_rascunho := (OLD.status = 'Rascunho');
  ELSE
    v_was_rascunho := (NEW.status = 'Rascunho');
  END IF;

  -- ═══════════════════════════════════════════
  -- CASE 1: Soft-deleted
  -- ═══════════════════════════════════════════
  IF NEW.deleted_at IS NOT NULL THEN
    IF v_was_rascunho OR (OLD IS NOT NULL AND OLD.status = 'Rascunho') THEN
      -- Rascunho excluído → número volta para DISPONÍVEL (reaproveitável)
      UPDATE oficio_numeracao
      SET status = 'disponivel',
          oficio_id = NULL,
          reservado_por = NULL, reservado_por_nome = NULL, reservado_em = NULL,
          usado_por = NULL, usado_por_nome = NULL, usado_em = NULL
      WHERE ano = NEW.ano AND numero = v_num;
    ELSE
      -- Ofício finalizado excluído → número fica CANCELADO (nunca volta)
      UPDATE oficio_numeracao
      SET status = 'cancelado',
          oficio_id = NEW.id
      WHERE ano = NEW.ano AND numero = v_num;
    END IF;
    RETURN NEW;
  END IF;

  -- ═══════════════════════════════════════════
  -- CASE 2: Cancelado
  -- ═══════════════════════════════════════════
  IF NEW.status = 'Cancelado' THEN
    UPDATE oficio_numeracao
    SET status = 'cancelado',
        oficio_id = NEW.id
    WHERE ano = NEW.ano AND numero = v_num;
    RETURN NEW;
  END IF;

  -- ═══════════════════════════════════════════
  -- CASE 3: Rascunho → reservado
  -- ═══════════════════════════════════════════
  IF NEW.status = 'Rascunho' THEN
    -- Try update existing row
    UPDATE oficio_numeracao
    SET status = 'reservado',
        oficio_id = NEW.id,
        reservado_por = COALESCE(NEW.author_id, reservado_por),
        reservado_por_nome = COALESCE(NEW.operador_nome, reservado_por_nome),
        reservado_em = COALESCE(reservado_em, NOW())
    WHERE ano = NEW.ano AND numero = v_num;

    IF NOT FOUND THEN
      INSERT INTO oficio_numeracao (numero, ano, status, oficio_id, reservado_por, reservado_por_nome, reservado_em, origem_numero)
      VALUES (v_num, NEW.ano, 'reservado', NEW.id, NEW.author_id, NEW.operador_nome, NOW(), 'sistema')
      ON CONFLICT (ano, numero) DO UPDATE
      SET status = 'reservado', oficio_id = NEW.id,
          reservado_por = COALESCE(NEW.author_id, oficio_numeracao.reservado_por),
          reservado_por_nome = COALESCE(NEW.operador_nome, oficio_numeracao.reservado_por_nome),
          reservado_em = COALESCE(oficio_numeracao.reservado_em, NOW());
    END IF;
    RETURN NEW;
  END IF;

  -- ═══════════════════════════════════════════
  -- CASE 4: Any final status → usado
  -- (Exportado, Salvo no Drive, Impresso, Protocolado, Respondido, Atendido, Finalizado)
  -- ═══════════════════════════════════════════
  UPDATE oficio_numeracao
  SET status = 'usado',
      oficio_id = NEW.id,
      usado_por = COALESCE(NEW.last_edited_by, NEW.author_id),
      usado_por_nome = COALESCE(NEW.last_edited_by_name, NEW.operador_nome),
      usado_em = COALESCE(usado_em, NOW())
  WHERE ano = NEW.ano AND numero = v_num;

  IF NOT FOUND THEN
    INSERT INTO oficio_numeracao (numero, ano, status, oficio_id, usado_por, usado_por_nome, usado_em, origem_numero)
    VALUES (v_num, NEW.ano, 'usado', NEW.id,
            COALESCE(NEW.last_edited_by, NEW.author_id),
            COALESCE(NEW.last_edited_by_name, NEW.operador_nome),
            NOW(), 'sistema')
    ON CONFLICT (ano, numero) DO UPDATE
    SET status = 'usado', oficio_id = NEW.id,
        usado_por = COALESCE(NEW.last_edited_by, NEW.author_id, oficio_numeracao.usado_por),
        usado_por_nome = COALESCE(NEW.last_edited_by_name, NEW.operador_nome, oficio_numeracao.usado_por_nome),
        usado_em = COALESCE(oficio_numeracao.usado_em, NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on ALL relevant changes
CREATE TRIGGER trg_sync_numeracao
AFTER INSERT OR UPDATE OF status, numero, deleted_at ON oficios
FOR EACH ROW
EXECUTE FUNCTION public.sync_numeracao_on_oficio_change();

-- Unique constraint: one number per year (prevent duplicates)
-- First clean up: if there are duplicates, keep the one with an oficio_id
DELETE FROM oficio_numeracao a
USING oficio_numeracao b
WHERE a.ano = b.ano AND a.numero = b.numero
  AND a.id != b.id
  AND (a.oficio_id IS NULL OR (b.oficio_id IS NOT NULL AND a.oficio_id IS NOT NULL AND a.id > b.id));

-- Add unique constraint
ALTER TABLE oficio_numeracao DROP CONSTRAINT IF EXISTS uq_numeracao_ano_numero;
ALTER TABLE oficio_numeracao ADD CONSTRAINT uq_numeracao_ano_numero UNIQUE (ano, numero);
