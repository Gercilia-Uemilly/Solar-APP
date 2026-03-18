
-- ══════════════════════════════════════════════
-- 1. AUDIT LOG TABLE
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_nome TEXT,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id UUID,
  detalhes JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ve_audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "usuarios_inserem_logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════
-- 2. OFICIOS BACKUP TABLE
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.oficios_backup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oficio_id UUID NOT NULL,
  dados JSONB NOT NULL,
  backup_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.oficios_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ve_backups"
ON public.oficios_backup FOR SELECT TO authenticated
USING (is_admin(auth.uid()));

-- ══════════════════════════════════════════════
-- 3. MODELOS DE OFÍCIO TABLE
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.modelos_oficio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  secretaria TEXT,
  assunto TEXT,
  conteudo TEXT,
  criado_por UUID NOT NULL,
  criado_por_nome TEXT,
  publico BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modelos_oficio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_veem_modelos_publicos"
ON public.modelos_oficio FOR SELECT TO authenticated
USING (publico = true OR criado_por = auth.uid());

CREATE POLICY "operadores_criam_modelos"
ON public.modelos_oficio FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "criador_edita_modelo"
ON public.modelos_oficio FOR UPDATE TO authenticated
USING (criado_por = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "criador_deleta_modelo"
ON public.modelos_oficio FOR DELETE TO authenticated
USING (criado_por = auth.uid() OR is_admin(auth.uid()));

-- ══════════════════════════════════════════════
-- 4. PRAZO E COBRANÇA COLUMNS ON OFICIOS
-- ══════════════════════════════════════════════
ALTER TABLE public.oficios
ADD COLUMN IF NOT EXISTS prazo_resposta DATE,
ADD COLUMN IF NOT EXISTS status_resposta TEXT DEFAULT 'aguardando',
ADD COLUMN IF NOT EXISTS cobrado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cobrado_por UUID;

-- ══════════════════════════════════════════════
-- 5. BACKUP FUNCTION
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.backup_diario_oficios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO oficios_backup (oficio_id, dados)
  SELECT id, row_to_json(oficios.*)::jsonb
  FROM oficios
  WHERE updated_at >= NOW() - INTERVAL '24 hours'
    AND deleted_at IS NULL;

  DELETE FROM oficios_backup
  WHERE backup_em < NOW() - INTERVAL '30 days';
END;
$$;

-- ══════════════════════════════════════════════
-- 6. VERIFICAR PRAZOS FUNCTION
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.verificar_prazos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE oficios SET status_resposta = 'vencido'
  WHERE prazo_resposta < CURRENT_DATE
    AND status_resposta = 'aguardando'
    AND deleted_at IS NULL;
END;
$$;

-- ══════════════════════════════════════════════
-- 7. INDEXES
-- ══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_audit_log_criado_em ON public.audit_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_modelos_oficio_criado_por ON public.modelos_oficio (criado_por);
CREATE INDEX IF NOT EXISTS idx_oficios_prazo_resposta ON public.oficios (prazo_resposta) WHERE prazo_resposta IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oficios_status_resposta ON public.oficios (status_resposta) WHERE status_resposta IS NOT NULL;

-- Enable realtime for audit_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modelos_oficio;
