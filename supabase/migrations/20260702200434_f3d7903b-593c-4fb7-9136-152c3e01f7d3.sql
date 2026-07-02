DROP INDEX IF EXISTS public.idx_oficio_respostas_hash;
CREATE INDEX IF NOT EXISTS idx_oficio_respostas_hash ON public.oficio_respostas (oficio_id, sha256) WHERE sha256 IS NOT NULL;