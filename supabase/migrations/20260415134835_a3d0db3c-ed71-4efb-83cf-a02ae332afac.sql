
-- Fix the reservation function: always sequential, no gap-fill backwards
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero(p_ano integer, p_user_id uuid, p_user_nome text, p_min_numero integer DEFAULT 1)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_existing INTEGER;
  v_floor INTEGER;
  v_highest INTEGER;
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

  -- Return ANY existing reservation for this user
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

  -- Find the highest number that is NOT disponivel (used or reserved by anyone)
  SELECT COALESCE(MAX(numero), v_floor - 1) INTO v_highest
  FROM oficio_numeracao
  WHERE ano = p_ano
    AND status IN ('usado', 'reservado', 'cancelado');

  v_next := GREATEST(v_highest + 1, v_floor);

  -- If this number already exists as disponivel, reserve it
  UPDATE oficio_numeracao
  SET 
    status = 'reservado',
    reservado_por = p_user_id,
    reservado_por_nome = p_user_nome,
    reservado_em = NOW(),
    origem_numero = 'sistema'
  WHERE id = (
    SELECT id FROM oficio_numeracao
    WHERE ano = p_ano AND numero = v_next AND status = 'disponivel'
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;

  IF v_numero IS NOT NULL THEN
    RETURN v_numero;
  END IF;

  -- Number doesn't exist yet, create it
  INSERT INTO oficio_numeracao (numero, ano, status, reservado_por, reservado_por_nome, reservado_em, origem_numero)
  VALUES (v_next, p_ano, 'reservado', p_user_id, p_user_nome, NOW(), 'sistema')
  ON CONFLICT DO NOTHING;

  RETURN v_next;
END;
$function$;

-- Add editing tracking columns to oficios
ALTER TABLE public.oficios 
  ADD COLUMN IF NOT EXISTS editing_by uuid,
  ADD COLUMN IF NOT EXISTS editing_by_name text,
  ADD COLUMN IF NOT EXISTS editing_since timestamptz;
