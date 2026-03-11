
-- Add soft delete columns to oficios
ALTER TABLE public.oficios
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid,
ADD COLUMN IF NOT EXISTS deleted_by_name text;
