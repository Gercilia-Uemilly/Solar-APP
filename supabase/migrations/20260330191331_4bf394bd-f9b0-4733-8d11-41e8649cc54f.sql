
-- Add origem_numero column to oficio_numeracao
ALTER TABLE public.oficio_numeracao ADD COLUMN IF NOT EXISTS origem_numero text NOT NULL DEFAULT 'sistema';

-- Update the reservar_proximo_numero function to accept an optional min_numero parameter
-- This allows the hybrid edge function to pass the max from Google Sheets
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero(p_ano integer, p_user_id uuid, p_user_nome text, p_min_numero integer DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero INTEGER;
  v_max_existente INTEGER;
BEGIN
  -- Get the max existing number in the table for this year
  SELECT COALESCE(MAX(numero), 0) INTO v_max_existente
  FROM oficio_numeracao
  WHERE ano = p_ano;

  -- If p_min_numero (from Google Sheets) is higher, insert missing rows up to that point
  IF p_min_numero > v_max_existente THEN
    INSERT INTO oficio_numeracao (numero, ano, status, origem_numero)
    SELECT gs, p_ano, 'disponivel', 'planilha'
    FROM generate_series(v_max_existente + 1, p_min_numero) AS gs
    ON CONFLICT DO NOTHING;
  END IF;

  -- Now reserve the next available number
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
    ORDER BY numero ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING numero INTO v_numero;
  RETURN v_numero;
END;
$$;
