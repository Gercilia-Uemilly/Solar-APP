
-- Habilita busca por similaridade de texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices trigram para acelerar buscas ILIKE no Banco de Informações (sugestões em tempo real)
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_titulo_trgm
  ON public.base_conhecimento USING gin (titulo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_descricao_trgm
  ON public.base_conhecimento USING gin (descricao gin_trgm_ops);

-- Acelera buscas de ofícios por endereço/local
CREATE INDEX IF NOT EXISTS idx_oficios_endereco_trgm
  ON public.oficios USING gin (endereco_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_oficios_local_demanda_trgm
  ON public.oficios USING gin (local_demanda gin_trgm_ops);

-- Índice parcial otimizado para listagem principal (deleted_at IS NULL ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_oficios_ativos_created_at
  ON public.oficios (created_at DESC) WHERE deleted_at IS NULL;

-- Esvaziar a lixeira (excluir definitivamente ofícios com deleted_at preenchido)
DELETE FROM public.oficios WHERE deleted_at IS NOT NULL;
