
-- Fix: always use 'sistema' as origin since planilha integration was removed
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero(p_ano integer, p_user_id uuid, p_user_nome text, p_min_numero integer DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_max_existente INTEGER;
  v_max_usado INTEGER;
  v_proximo INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero), 0) INTO v_max_existente
  FROM oficio_numeracao
  WHERE ano = p_ano;

  IF p_min_numero > v_max_existente THEN
    INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
    SELECT gs, p_ano, 'disponivel', 'sistema'
    FROM generate_series(v_max_existente + 1, p_min_numero) AS gs
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(MAX(numero), 0) INTO v_max_usado
  FROM oficio_numeracao
  WHERE ano = p_ano AND status IN ('usado', 'reservado');

  v_proximo := v_max_usado + 1;

  UPDATE oficio_numeracao
  SET status = 'usado', origem_numero = 'sistema'
  WHERE ano = p_ano 
    AND status = 'disponivel' 
    AND numero < v_proximo;

  INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
  VALUES (v_proximo, p_ano, 'disponivel', 'sistema')
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(MAX(numero), v_proximo) INTO v_max_existente
  FROM oficio_numeracao
  WHERE ano = p_ano;

  IF v_max_existente < v_proximo + 10 THEN
    INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
    SELECT gs, p_ano, 'disponivel', 'sistema'
    FROM generate_series(v_max_existente + 1, v_proximo + 10) AS gs
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE oficio_numeracao
  SET 
    status = 'reservado',
    reservado_por = p_user_id,
    reservado_por_nome = p_user_nome,
    reservado_em = NOW(),
    origem_numero = 'sistema'
  WHERE id = (
    SELECT id
    FROM oficio_numeracao
    WHERE ano = p_ano 
    AND status = 'disponivel'
    AND numero >= v_proximo
    ORDER BY numero ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;
  
  RETURN v_numero;
END;
$function$;

-- Fix existing records that were incorrectly marked as 'planilha' by the system
UPDATE oficio_numeracao SET origem_numero = 'sistema' WHERE origem_numero = 'planilha' AND ano = 2026 AND numero >= 800;
