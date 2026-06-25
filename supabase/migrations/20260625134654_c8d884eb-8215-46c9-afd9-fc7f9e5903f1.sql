ALTER TABLE public.oficio_respostas
DROP CONSTRAINT IF EXISTS oficio_respostas_match_status_check;

ALTER TABLE public.oficio_respostas
ADD CONSTRAINT oficio_respostas_match_status_check
CHECK (match_status = ANY (ARRAY[
  'confirmado'::text,
  'pendente_processamento'::text,
  'pendente_revisao'::text,
  'sem_match'::text,
  'arquivo_invalido'::text,
  'rejeitado'::text
]));