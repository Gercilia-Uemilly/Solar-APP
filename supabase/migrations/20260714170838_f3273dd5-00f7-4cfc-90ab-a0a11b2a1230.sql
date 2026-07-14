
DELETE FROM public.oficio_status_history;

-- 1) Criação
INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, alterado_em)
SELECT o.id, NULL, 'Rascunho', o.author_id, o.operador_nome, o.created_at
FROM public.oficios o
WHERE o.deleted_at IS NULL;

-- 2) Backups (apenas os que ainda apontam para ofício existente)
INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, alterado_em)
SELECT
  b.oficio_id,
  NULL,
  b.dados->>'status',
  NULLIF(b.dados->>'last_edited_by','')::uuid,
  b.dados->>'last_edited_by_name',
  b.backup_em
FROM public.oficios_backup b
JOIN public.oficios o ON o.id = b.oficio_id AND o.deleted_at IS NULL
WHERE b.dados->>'status' IS NOT NULL;

-- 3) Estado atual
INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, alterado_em)
SELECT
  o.id, NULL, o.status,
  COALESCE(o.last_edited_by, o.author_id),
  COALESCE(o.last_edited_by_name, o.operador_nome),
  COALESCE(o.last_edited_at, o.updated_at)
FROM public.oficios o
WHERE o.deleted_at IS NULL;

-- 4) Remove entradas cujo status é igual ao anterior no mesmo ofício
DELETE FROM public.oficio_status_history h
USING (
  SELECT id,
         LAG(status_novo) OVER (PARTITION BY oficio_id ORDER BY alterado_em, id) AS prev
  FROM public.oficio_status_history
) x
WHERE h.id = x.id AND x.prev IS NOT NULL AND x.prev = h.status_novo;

-- 5) Corrige status_anterior baseado na sequência final
WITH ordered AS (
  SELECT id,
         LAG(status_novo) OVER (PARTITION BY oficio_id ORDER BY alterado_em, id) AS prev
  FROM public.oficio_status_history
)
UPDATE public.oficio_status_history h
SET status_anterior = o.prev
FROM ordered o
WHERE h.id = o.id;
