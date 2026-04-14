
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero(p_ano integer, p_user_id uuid, p_user_nome text, p_min_numero integer DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_existing INTEGER;
  v_floor INTEGER;
  v_max_num INTEGER;
  v_next INTEGER;
BEGIN
  -- Floor: for 2026+, never assign below 800
  IF p_ano >= 2026 THEN
    v_floor := GREATEST(800, p_min_numero);
  ELSE
    v_floor := p_min_numero;
  END IF;

  -- Release expired reservations (>30 min)
  UPDATE oficio_numeracao
  SET status = 'disponivel',
      reservado_por = NULL,
      reservado_por_nome = NULL,
      reservado_em = NULL
  WHERE ano = p_ano
    AND status = 'reservado'
    AND reservado_em < NOW() - INTERVAL '30 minutes';

  -- If this user already has an active reservation, return that number
  SELECT numero INTO v_existing
  FROM oficio_numeracao
  WHERE ano = p_ano
    AND status = 'reservado'
    AND reservado_por = p_user_id
  ORDER BY reservado_em DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Try to reserve the LOWEST available number >= floor
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
      AND numero >= v_floor
    ORDER BY numero ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;

  IF v_numero IS NOT NULL THEN
    RETURN v_numero;
  END IF;

  -- No available number found — create the next one after the current max
  SELECT COALESCE(MAX(numero), v_floor - 1) INTO v_max_num
  FROM oficio_numeracao
  WHERE ano = p_ano;

  v_next := GREATEST(v_max_num + 1, v_floor);

  INSERT INTO oficio_numeracao (numero, ano, status, reservado_por, reservado_por_nome, reservado_em, origem_numero)
  VALUES (v_next, p_ano, 'reservado', p_user_id, p_user_nome, NOW(), 'sistema');

  RETURN v_next;
END;
$function$;
