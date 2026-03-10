
-- Table for numbering control
CREATE TABLE IF NOT EXISTS public.oficio_numeracao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  status TEXT NOT NULL DEFAULT 'disponivel',
  reservado_por UUID,
  reservado_por_nome TEXT,
  reservado_em TIMESTAMP WITH TIME ZONE,
  usado_por UUID,
  usado_por_nome TEXT,
  usado_em TIMESTAMP WITH TIME ZONE,
  oficio_id UUID,
  UNIQUE(numero, ano)
);

-- Pre-populate with numbers 1-999 for 2026
INSERT INTO public.oficio_numeracao (numero, ano, status)
SELECT generate_series(1, 999), 2026, 'disponivel'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.oficio_numeracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados_veem_numeracao"
ON public.oficio_numeracao FOR SELECT
TO authenticated USING (true);

CREATE POLICY "autenticados_reservam_numero"
ON public.oficio_numeracao FOR UPDATE
TO authenticated
USING (status = 'disponivel' OR reservado_por = auth.uid() OR status = 'reservado');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.oficio_numeracao;

-- RPC: Reserve next available number atomically
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero(
  p_ano INTEGER,
  p_user_id UUID,
  p_user_nome TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE oficio_numeracao
  SET 
    status = 'reservado',
    reservado_por = p_user_id,
    reservado_por_nome = p_user_nome,
    reservado_em = NOW()
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

-- RPC: Release a reserved number
CREATE OR REPLACE FUNCTION public.liberar_numero(
  p_numero INTEGER,
  p_ano INTEGER,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE oficio_numeracao
  SET 
    status = 'disponivel',
    reservado_por = NULL,
    reservado_por_nome = NULL,
    reservado_em = NULL
  WHERE numero = p_numero
  AND ano = p_ano
  AND reservado_por = p_user_id
  AND status = 'reservado';
  RETURN FOUND;
END;
$$;

-- RPC: Mark a number as used
CREATE OR REPLACE FUNCTION public.usar_numero(
  p_numero INTEGER,
  p_ano INTEGER,
  p_user_id UUID,
  p_user_nome TEXT,
  p_oficio_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE oficio_numeracao
  SET 
    status = 'usado',
    usado_por = p_user_id,
    usado_por_nome = p_user_nome,
    usado_em = NOW(),
    oficio_id = p_oficio_id
  WHERE numero = p_numero
  AND ano = p_ano
  AND (status = 'reservado' OR status = 'disponivel');
  RETURN FOUND;
END;
$$;

-- RPC: Release expired reservations (older than 30 min)
CREATE OR REPLACE FUNCTION public.liberar_reservas_expiradas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE oficio_numeracao
  SET 
    status = 'disponivel',
    reservado_por = NULL,
    reservado_por_nome = NULL,
    reservado_em = NULL
  WHERE status = 'reservado'
  AND reservado_em < NOW() - INTERVAL '30 minutes';
END;
$$;

-- RPC: Reset numbering for a new year
CREATE OR REPLACE FUNCTION public.resetar_numeracao_anual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO oficio_numeracao (numero, ano, status)
  SELECT generate_series(1, 999), EXTRACT(YEAR FROM NOW())::INTEGER, 'disponivel'
  ON CONFLICT DO NOTHING;
END;
$$;
