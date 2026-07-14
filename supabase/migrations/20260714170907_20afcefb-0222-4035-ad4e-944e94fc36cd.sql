
-- Adiciona uma entrada com o status atual caso ele não seja igual ao último registrado
INSERT INTO public.oficio_status_history (oficio_id, status_anterior, status_novo, alterado_por, alterado_por_nome, alterado_em)
SELECT
  o.id,
  last_h.status_novo,
  o.status,
  COALESCE(o.last_edited_by, o.author_id),
  COALESCE(o.last_edited_by_name, o.operador_nome),
  GREATEST(COALESCE(o.updated_at, o.created_at), COALESCE(o.last_edited_at, o.created_at))
FROM public.oficios o
LEFT JOIN LATERAL (
  SELECT status_novo FROM public.oficio_status_history
  WHERE oficio_id = o.id
  ORDER BY alterado_em DESC, id DESC
  LIMIT 1
) last_h ON true
WHERE o.deleted_at IS NULL
  AND (last_h.status_novo IS NULL OR last_h.status_novo <> o.status);
