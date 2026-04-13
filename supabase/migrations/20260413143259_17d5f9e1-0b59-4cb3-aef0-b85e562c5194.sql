
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
  -- First: release expired reservations (>30 min)
  UPDATE oficio_numeracao
  SET status = 'disponivel',
      reservado_por = NULL,
      reservado_por_nome = NULL,
      reservado_em = NULL
  WHERE ano = p_ano
    AND status = 'reservado'
    AND reservado_em < NOW() - INTERVAL '30 minutes';

  -- Try to reuse the lowest available number that was previously reserved/skipped
  -- This catches numbers that were released or left open
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
    AND numero <= (SELECT COALESCE(MAX(numero), 0) FROM oficio_numeracao WHERE ano = p_ano AND status IN ('usado', 'reservado'))
    ORDER BY numero ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;

  -- If we found a gap number, return it
  IF v_numero IS NOT NULL THEN
    RETURN v_numero;
  END IF;

  -- No gaps found — proceed with next sequential number
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

  -- Mark any gaps below as used
  UPDATE oficio_numeracao
  SET status = 'usado', origem_numero = 'sistema'
  WHERE ano = p_ano 
    AND status = 'disponivel' 
    AND numero < v_proximo;

  -- Ensure the next number row exists
  INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
  VALUES (v_proximo, p_ano, 'disponivel', 'sistema')
  ON CONFLICT DO NOTHING;

  -- Pre-generate buffer
  SELECT COALESCE(MAX(numero), v_proximo) INTO v_max_existente
  FROM oficio_numeracao
  WHERE ano = p_ano;

  IF v_max_existente < v_proximo + 10 THEN
    INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
    SELECT gs, p_ano, 'disponivel', 'sistema'
    FROM generate_series(v_max_existente + 1, v_proximo + 10) AS gs
    ON CONFLICT DO NOTHING;
  END IF;

  -- Reserve the next available number
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
