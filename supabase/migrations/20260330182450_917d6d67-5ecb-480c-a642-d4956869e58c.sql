
-- Protocol columns on oficios
ALTER TABLE oficios ADD COLUMN IF NOT EXISTS numero_protocolo TEXT;
ALTER TABLE oficios ADD COLUMN IF NOT EXISTS protocolado_em TIMESTAMP WITH TIME ZONE;

-- Protocol number generator
CREATE OR REPLACE FUNCTION gerar_numero_protocolo(p_ano INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM oficios
  WHERE EXTRACT(YEAR FROM protocolado_em) = p_ano
  AND numero_protocolo IS NOT NULL;
  RETURN 'GVF-' || p_ano || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  oficio_id UUID,
  criada_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve proprias notificacoes"
ON notificacoes FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oficios_status ON oficios(status);
CREATE INDEX IF NOT EXISTS idx_oficios_author_id ON oficios(author_id);
CREATE INDEX IF NOT EXISTS idx_oficios_created_at ON oficios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(user_id, lida);
