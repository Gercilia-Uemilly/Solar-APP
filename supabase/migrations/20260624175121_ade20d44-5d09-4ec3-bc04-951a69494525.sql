
-- Tabela de respostas
CREATE TABLE public.oficio_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio_id UUID NOT NULL REFERENCES public.oficios(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  arquivo_path TEXT,
  arquivo_nome TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type TEXT,
  sha256 TEXT,
  tipo_origem TEXT NOT NULL DEFAULT 'manual' CHECK (tipo_origem IN ('manual','whatsapp','import_excel')),
  data_resposta DATE,
  orgao_respondente TEXT,
  resumo_ia TEXT,
  conteudo_extraido TEXT,
  match_confianca NUMERIC,
  match_metodo TEXT,
  match_status TEXT DEFAULT 'confirmado' CHECK (match_status IN ('confirmado','pendente_revisao','sem_match','rejeitado')),
  uploaded_by UUID,
  uploaded_by_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oficio_respostas_oficio ON public.oficio_respostas(oficio_id);
CREATE INDEX idx_oficio_respostas_match_status ON public.oficio_respostas(match_status);
CREATE UNIQUE INDEX idx_oficio_respostas_hash ON public.oficio_respostas(oficio_id, sha256) WHERE sha256 IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficio_respostas TO authenticated;
GRANT ALL ON public.oficio_respostas TO service_role;

ALTER TABLE public.oficio_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver respostas" ON public.oficio_respostas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir respostas" ON public.oficio_respostas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by OR uploaded_by IS NULL);

CREATE POLICY "Autor, uploader ou admin pode atualizar" ON public.oficio_respostas
  FOR UPDATE TO authenticated USING (
    uploaded_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.oficios o WHERE o.id = oficio_id AND o.author_id = auth.uid())
  );

CREATE POLICY "Autor, uploader ou admin pode excluir" ON public.oficio_respostas
  FOR DELETE TO authenticated USING (
    uploaded_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.oficios o WHERE o.id = oficio_id AND o.author_id = auth.uid())
  );

CREATE TRIGGER trg_oficio_respostas_updated_at
  BEFORE UPDATE ON public.oficio_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Colunas em oficios
ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_respostas INTEGER NOT NULL DEFAULT 0;

-- Trigger para atualizar contador e status
CREATE OR REPLACE FUNCTION public.sync_oficio_respostas_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oficio_id UUID; v_count INTEGER;
BEGIN
  v_oficio_id := COALESCE(NEW.oficio_id, OLD.oficio_id);
  SELECT COUNT(*) INTO v_count FROM public.oficio_respostas
    WHERE oficio_id = v_oficio_id AND COALESCE(match_status,'confirmado') = 'confirmado';

  IF TG_OP = 'DELETE' THEN
    UPDATE public.oficios SET total_respostas = v_count WHERE id = v_oficio_id;
  ELSE
    IF v_count > 0 AND COALESCE(NEW.match_status,'confirmado') = 'confirmado' THEN
      UPDATE public.oficios
        SET total_respostas = v_count,
            respondido_em = COALESCE(respondido_em, now()),
            status = CASE WHEN status IN ('Cancelado') THEN status ELSE 'Respondido' END
        WHERE id = v_oficio_id;
    ELSE
      UPDATE public.oficios SET total_respostas = v_count WHERE id = v_oficio_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_oficio_respostas_count
  AFTER INSERT OR UPDATE OR DELETE ON public.oficio_respostas
  FOR EACH ROW EXECUTE FUNCTION public.sync_oficio_respostas_count();

-- Storage policies para bucket respostas-oficios
CREATE POLICY "Autenticados leem respostas-oficios" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'respostas-oficios');

CREATE POLICY "Autenticados enviam respostas-oficios" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'respostas-oficios');

CREATE POLICY "Autenticados deletam respostas-oficios proprios" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'respostas-oficios' AND (owner = auth.uid() OR public.is_admin(auth.uid()))
  );
