
-- 1. Fix all numbers that have oficio_id but are marked as 'disponivel' → mark as 'usado'
UPDATE oficio_numeracao
SET status = 'usado', usado_em = COALESCE(usado_em, reservado_em, NOW())
WHERE ano = 2026
  AND oficio_id IS NOT NULL
  AND status = 'disponivel';

-- 2. Replace the function to also skip numbers that have oficio_id
CREATE OR REPLACE FUNCTION reservar_proximo_numero(
  p_ano INTEGER,
  p_user_id UUID,
  p_user_nome TEXT,
  p_min_numero INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
  v_existing INTEGER;
  v_floor INTEGER;
  v_max_num INTEGER;
  v_next INTEGER;
BEGIN
  IF p_ano >= 2026 THEN
    v_floor := GREATEST(800, p_min_numero);
  ELSE
    v_floor := p_min_numero;
  END IF;

  -- Release expired reservations only if no oficio linked
  UPDATE oficio_numeracao
  SET status = 'disponivel',
      reservado_por = NULL,
      reservado_por_nome = NULL,
      reservado_em = NULL
  WHERE ano = p_ano
    AND status = 'reservado'
    AND oficio_id IS NULL
    AND reservado_em < NOW() - INTERVAL '30 minutes';

  -- Return existing reservation for this user (only if no oficio linked)
  SELECT numero INTO v_existing
  FROM oficio_numeracao
  WHERE ano = p_ano
    AND status = 'reservado'
    AND reservado_por = p_user_id
    AND oficio_id IS NULL
  ORDER BY reservado_em DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Reserve LOWEST available number that has NO oficio_id
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
      AND oficio_id IS NULL
      AND numero >= v_floor
    ORDER BY numero ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;

  IF v_numero IS NOT NULL THEN
    RETURN v_numero;
  END IF;

  -- Create next number after current max
  SELECT COALESCE(MAX(numero), v_floor - 1) INTO v_max_num
  FROM oficio_numeracao
  WHERE ano = p_ano;

  v_next := GREATEST(v_max_num + 1, v_floor);

  INSERT INTO oficio_numeracao (numero, ano, status, reservado_por, reservado_por_nome, reservado_em, origem_numero)
  VALUES (v_next, p_ano, 'reservado', p_user_id, p_user_nome, NOW(), 'sistema');

  RETURN v_next;
END;
$$;
