-- Indexes for performance on oficios table
CREATE INDEX IF NOT EXISTS idx_oficios_created_at ON public.oficios (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oficios_status ON public.oficios (status);
CREATE INDEX IF NOT EXISTS idx_oficios_author_id ON public.oficios (author_id);
CREATE INDEX IF NOT EXISTS idx_oficios_deleted_at ON public.oficios (deleted_at);
CREATE INDEX IF NOT EXISTS idx_oficios_deleted_at_created_at ON public.oficios (deleted_at, created_at DESC);

-- Enable realtime for oficios table
ALTER PUBLICATION supabase_realtime ADD TABLE public.oficios;